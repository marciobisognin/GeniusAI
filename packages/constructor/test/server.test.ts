import http from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer, type ConstructorServer } from "../src/server.js";

/** Servidor HTTP real — só para simular "há um Ollama respondendo aqui", sem depender de rede externa. */
function startFakeOllama(): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/api/tags") res.writeHead(200).end("{}");
      else res.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

describe("servidor do Super Construtor (Fastify)", () => {
  let server: ConstructorServer;

  beforeEach(() => {
    server = buildServer({ dbPath: ":memory:" });
  });

  afterEach(async () => {
    await server.app.close();
  });

  it("GET /health responde ok", async () => {
    const res = await server.app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /agents num banco vazio responde []", async () => {
    const res = await server.app.inject({ method: "GET", url: "/agents" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("POST /agents cria e GET /agents/:id lê de volta", async () => {
    const created = await server.app.inject({
      method: "POST",
      url: "/agents",
      payload: { id: "a1", nome: "Agente de Qualificação de Leads", area: "Vendas" },
    });
    expect(created.statusCode).toBe(201);

    const fetched = await server.app.inject({ method: "GET", url: "/agents/a1" });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().nome).toBe("Agente de Qualificação de Leads");
  });

  it("POST /agents com entidade inválida responde 400", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: "/agents",
      payload: { nome: "sem id" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /agents/:id inexistente responde 404", async () => {
    const res = await server.app.inject({ method: "GET", url: "/agents/fantasma" });
    expect(res.statusCode).toBe(404);
  });

  it("PATCH /squads/:id atualiza parcialmente", async () => {
    await server.app.inject({
      method: "POST",
      url: "/squads",
      payload: { id: "s1", nome: "Squad Original", agentIds: [] },
    });
    const patched = await server.app.inject({
      method: "PATCH",
      url: "/squads/s1",
      payload: { nome: "Squad Renomeado" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().nome).toBe("Squad Renomeado");
  });

  it("DELETE /companies/:id remove", async () => {
    await server.app.inject({
      method: "POST",
      url: "/companies",
      payload: { id: "c1", nome: "Instituto Exemplo" },
    });
    const deleted = await server.app.inject({ method: "DELETE", url: "/companies/c1" });
    expect(deleted.statusCode).toBe(204);
    const missing = await server.app.inject({ method: "GET", url: "/companies/c1" });
    expect(missing.statusCode).toBe(404);
  });

  it("todas as doze entidades do canon têm rota registrada", async () => {
    const paths = [
      "agents",
      "squads",
      "companies",
      "mind-clones",
      "providers",
      "tasks",
      "runs",
      "approvals",
      "learning-flows",
      "memory-chunks",
      "canvas-nodes",
      "canvas-edges",
    ];
    for (const path of paths) {
      const res = await server.app.inject({ method: "GET", url: `/${path}` });
      expect(res.statusCode, `rota /${path} deveria responder 200`).toBe(200);
    }
  });

  it("persiste a posição de um CanvasNode e permite reler após update", async () => {
    const created = await server.app.inject({
      method: "POST",
      url: "/canvas-nodes",
      payload: { id: "cn1", kind: "note", title: "Nota", position: { x: 100, y: 200 } },
    });
    expect(created.statusCode).toBe(201);

    const moved = await server.app.inject({
      method: "PATCH",
      url: "/canvas-nodes/cn1",
      payload: { position: { x: 300, y: 400 } },
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().position).toEqual({ x: 300, y: 400 });

    const fetched = await server.app.inject({ method: "GET", url: "/canvas-nodes/cn1" });
    expect(fetched.json().position).toEqual({ x: 300, y: 400 });
  });

  it("conecta dois CanvasNodes por um CanvasEdge", async () => {
    await server.app.inject({
      method: "POST",
      url: "/canvas-nodes",
      payload: { id: "cn1", kind: "agent", position: { x: 0, y: 0 } },
    });
    await server.app.inject({
      method: "POST",
      url: "/canvas-nodes",
      payload: { id: "cn2", kind: "squad", position: { x: 200, y: 0 } },
    });
    const edge = await server.app.inject({
      method: "POST",
      url: "/canvas-edges",
      payload: { id: "ce1", source: "cn1", target: "cn2" },
    });
    expect(edge.statusCode).toBe(201);

    const list = await server.app.inject({ method: "GET", url: "/canvas-edges" });
    expect(list.json()).toHaveLength(1);
  });

  it("responde CORS para origem cruzada (app do canvas em outra porta)", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://localhost:5173" },
    });
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("POST /providers/:id/health-check chama o provedor de verdade e persiste o resultado", async () => {
    const fakeOllama = await startFakeOllama();
    try {
      await server.app.inject({
        method: "POST",
        url: "/providers",
        payload: { id: "prov1", tipo: "ollama", nome: "Ollama local", baseUrl: fakeOllama.url },
      });

      const checked = await server.app.inject({ method: "POST", url: "/providers/prov1/health-check" });
      expect(checked.statusCode).toBe(200);
      expect(checked.json().healthy).toBe(true);
      expect(checked.json().lastCheckedAt).toBeDefined();

      const fetched = await server.app.inject({ method: "GET", url: "/providers/prov1" });
      expect(fetched.json().healthy).toBe(true);
    } finally {
      await fakeOllama.close();
    }
  });

  it("POST /providers/:id/health-check com provedor inalcançável persiste healthy:false", async () => {
    await server.app.inject({
      method: "POST",
      url: "/providers",
      payload: { id: "prov2", tipo: "ollama", nome: "Ollama inexistente", baseUrl: "http://127.0.0.1:1" },
    });
    const checked = await server.app.inject({ method: "POST", url: "/providers/prov2/health-check" });
    expect(checked.json().healthy).toBe(false);
  });

  it("POST /providers/:id/health-check com provedor inexistente responde 404", async () => {
    const res = await server.app.inject({ method: "POST", url: "/providers/fantasma/health-check" });
    expect(res.statusCode).toBe(404);
  });

  it("POST /providers/:id/health-check responde 400 quando falta apiKeyRef (anthropic/openai-chat exigem chave)", async () => {
    await server.app.inject({
      method: "POST",
      url: "/providers",
      payload: { id: "prov3", tipo: "anthropic", nome: "Claude sem chave" },
    });
    const checked = await server.app.inject({ method: "POST", url: "/providers/prov3/health-check" });
    expect(checked.statusCode).toBe(400);
    expect(checked.json().error).toBe("adapter_error");
  });

  it("POST /library/import roda contra os arquivos REAIS do monorepo e persiste com diff", async () => {
    const first = await server.app.inject({ method: "POST", url: "/library/import" });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.totalAgentes).toBeGreaterThan(20); // 12 so-ia + 8 foresight + 4 civilizations
    expect(firstBody.totalSquads).toBe(7);
    expect(firstBody.agentesNovos.length).toBe(firstBody.totalAgentes);
    expect(firstBody.agentesExistentes).toHaveLength(0);

    const listed = await server.app.inject({ method: "GET", url: "/agents" });
    expect(listed.json()).toHaveLength(firstBody.totalAgentes);

    // Rodar de novo é idempotente: tudo que já existia agora é "existente", nada duplica.
    const second = await server.app.inject({ method: "POST", url: "/library/import" });
    const secondBody = second.json();
    expect(secondBody.agentesNovos).toHaveLength(0);
    expect(secondBody.agentesExistentes.length).toBe(firstBody.totalAgentes);

    const listedAgain = await server.app.inject({ method: "GET", url: "/agents" });
    expect(listedAgain.json()).toHaveLength(firstBody.totalAgentes); // sem duplicatas
  });
});

describe("Etapa 4 — Super Construtor (reaproveitar/criar, Packs, pasta packs/)", () => {
  let server: ConstructorServer;
  let packsDir: string;

  beforeEach(async () => {
    packsDir = await mkdtemp(path.join(tmpdir(), "genius-packs-test-"));
    server = buildServer({ dbPath: ":memory:", packsDir });
  });

  afterEach(async () => {
    await server.app.close();
    await rm(packsDir, { recursive: true, force: true });
  });

  it("POST /agents/match sugere reaproveitar quando há sobreposição suficiente", async () => {
    await server.app.inject({
      method: "POST",
      url: "/agents",
      payload: {
        id: "agente-atesto-nf",
        nome: "Agente de Atesto de Nota Fiscal",
        area: "Orçamento e Finanças",
        descricao: "Confere NF contra empenho.",
        skills: ["ler-nota-fiscal", "conferir-nf-contra-empenho"],
      },
    });

    const res = await server.app.inject({
      method: "POST",
      url: "/agents/match",
      payload: { titulo: "Fiscal de Nota Fiscal", area: "Finanças", responsabilidades: ["conferir nota fiscal"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().candidate?.id).toBe("agente-atesto-nf");
    expect(res.json().draft).toBeDefined(); // sempre traz o draft, mesmo quando reaproveita
  });

  it("POST /agents/match não sugere nada e devolve um draft coerente quando não há candidato", async () => {
    const res = await server.app.inject({
      method: "POST",
      url: "/agents/match",
      payload: { titulo: "Especialista em Apicultura", responsabilidades: ["cuidar de colmeias"] },
    });
    expect(res.json().candidate).toBeNull();
    expect(res.json().draft.nome).toBe("Agente de Especialista em Apicultura");
    expect(res.json().draft.origem).toBe("gerado");
  });

  it("POST /squads/match segue o mesmo padrão para squads", async () => {
    await server.app.inject({
      method: "POST",
      url: "/squads",
      payload: { id: "tpl-financas", nome: "Squad de Orçamento e Finanças", area: "Orçamento e Finanças", descricao: "Atesto e conciliação." },
    });
    const res = await server.app.inject({
      method: "POST",
      url: "/squads/match",
      payload: { titulo: "Financeiro", area: "Orçamento e Finanças" },
    });
    expect(res.json().candidate?.id).toBe("tpl-financas");
  });

  it("export-pack → import-pack por HTTP: critério de aceite da Etapa 4 de ponta a ponta", async () => {
    await server.app.inject({ method: "POST", url: "/agents", payload: { id: "a1", nome: "Agente Um" } });
    await server.app.inject({ method: "POST", url: "/squads", payload: { id: "s1", nome: "Squad Um", agentIds: ["a1"] } });
    await server.app.inject({ method: "POST", url: "/companies", payload: { id: "origem", nome: "Empresa Origem", squadIds: ["s1"] } });
    await server.app.inject({ method: "POST", url: "/companies", payload: { id: "destino", nome: "Empresa Destino", squadIds: [] } });

    const exported = await server.app.inject({ method: "POST", url: "/companies/origem/export-pack" });
    expect(exported.statusCode).toBe(200);
    const pack = exported.json();
    expect(pack.agents).toHaveLength(1);

    const imported = await server.app.inject({
      method: "POST",
      url: "/companies/destino/import-pack",
      payload: pack,
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json().company.squadIds).toEqual(["s1"]);

    const destinoCompany = await server.app.inject({ method: "GET", url: "/companies/destino" });
    expect(destinoCompany.json().squadIds).toEqual(["s1"]);
  });

  it("export-pack de Company inexistente responde 404", async () => {
    const res = await server.app.inject({ method: "POST", url: "/companies/fantasma/export-pack" });
    expect(res.statusCode).toBe(404);
  });

  it("import-pack com corpo inválido (não é um Pack) responde 400", async () => {
    await server.app.inject({ method: "POST", url: "/companies", payload: { id: "c1", nome: "Empresa" } });
    const res = await server.app.inject({ method: "POST", url: "/companies/c1/import-pack", payload: { nada: "a ver" } });
    expect(res.statusCode).toBe(400);
  });

  it("GET /packs/available lê a pasta packs/ de verdade (arquivo real em disco, não mock)", async () => {
    await writeFile(
      path.join(packsDir, "pack-teste.json"),
      JSON.stringify({ id: "pack-teste", nome: "Pack de Teste", versao: "1.0.0", agents: [], squads: [] }),
    );
    await writeFile(path.join(packsDir, "invalido.json"), "{ isto não é json válido");
    await writeFile(path.join(packsDir, "README.md"), "# ignorado, não é .json");

    const res = await server.app.inject({ method: "GET", url: "/packs/available" });
    expect(res.statusCode).toBe(200);
    const files = res.json();
    expect(files).toHaveLength(2); // README.md não entra

    const valido = files.find((f: { filename: string }) => f.filename === "pack-teste.json");
    expect(valido).toMatchObject({ valid: true, nome: "Pack de Teste" });

    const invalido = files.find((f: { filename: string }) => f.filename === "invalido.json");
    expect(invalido.valid).toBe(false);
  });

  it("POST /packs/import lê um arquivo real da pasta packs/ e importa na Company", async () => {
    await writeFile(
      path.join(packsDir, "pack-real.json"),
      JSON.stringify({
        id: "pack-real",
        nome: "Pack Real",
        versao: "1.0.0",
        agents: [{ id: "a1", nome: "Agente do Pack" }],
        squads: [{ id: "s1", nome: "Squad do Pack", agentIds: ["a1"] }],
      }),
    );
    await server.app.inject({ method: "POST", url: "/companies", payload: { id: "c1", nome: "Empresa", squadIds: [] } });

    const res = await server.app.inject({
      method: "POST",
      url: "/packs/import",
      payload: { filename: "pack-real.json", companyId: "c1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().squadsNovos).toEqual(["s1"]);

    const agentsListed = await server.app.inject({ method: "GET", url: "/agents" });
    expect(agentsListed.json().map((a: { id: string }) => a.id)).toContain("a1");
  });
});
