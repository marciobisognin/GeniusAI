import http from "node:http";
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
});
