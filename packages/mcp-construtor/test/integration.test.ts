import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServer } from "@genius/constructor";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHttpClient, runTool, type ConstructorClient } from "../src/tools.js";
import { createConstructorServer } from "../src/server.js";

/**
 * Integração contra o Super Construtor **de verdade** — Fastify no ar, SQLite
 * real. Testar contra um dublê provaria que o cliente fala com o dublê; o que
 * precisa ser provado é que a política se sustenta contra a API real.
 */
describe("MCP do Super Construtor contra o servidor real", () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  let client: ConstructorClient;
  let baseUrl: string;

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await runTool(name, args, client);
    return { payload: JSON.parse(result.content[0].text), isError: result.isError === true };
  }

  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-construtor-"));
    server = await buildServer({ dbPath: join(dir, "test.sqlite3") });
    await server.app.listen({ port: 0, host: "127.0.0.1" });
    baseUrl = `http://127.0.0.1:${(server.app.server.address() as { port: number }).port}`;
    client = createHttpClient(baseUrl);
  }, 30_000);

  afterAll(async () => {
    await server?.app.close();
  });

  it("responde à checagem de saúde", async () => {
    const { payload } = await call("constructor_health");
    expect(payload.status).toBe("ok");
  });

  it("registra as ferramentas no servidor MCP", () => {
    expect(createConstructorServer(client)).toBeTruthy();
  });

  it("lista entidades legíveis", async () => {
    const { payload } = await call("constructor_list", { entity: "agents" });
    expect(Array.isArray(payload)).toBe(true);
  });

  it("recusa listar provedores — a entidade nem existe na superfície", async () => {
    const { payload, isError } = await call("constructor_list", { entity: "providers" });
    expect(isError).toBe(true);
    expect(payload.error).toBeTruthy();
  });

  it("reaproveita antes de criar", async () => {
    const { payload } = await call("constructor_match_agent", {
      area: "Licitações e Contratos",
      titulo: "Coordenação de Contratos",
      responsabilidades: ["fiscalizar contratos"],
    });
    expect(payload).toBeTruthy();
  });

  it("busca na memória sem quebrar quando o índice está vazio", async () => {
    const { payload } = await call("constructor_memory_search", { query: "contrato", k: 3 });
    expect(payload).toBeTruthy();
  });

  describe("o portão da autonomia, ponta a ponta", () => {
    async function seedAgent(autonomia: string) {
      const agent = (await client.post("/agents", {
        id: `agent-${autonomia.toLowerCase()}-${Date.now()}`,
        nome: `Agente ${autonomia}`,
        autonomia,
      })) as { id: string };
      const node = (await client.post("/canvas-nodes", {
        id: `node-${agent.id}`,
        kind: "agent",
        refId: agent.id,
        position: { x: 0, y: 0 },
      })) as { id: string };
      return { agent, node };
    }

    it("recusa executar um agente A1 — e diz por quê", async () => {
      const { node } = await seedAgent("A1");
      const { payload } = await call("constructor_execute", {
        canvasNodeId: node.id,
        taskDescription: "redigir parecer",
      });
      expect(payload.status).toBe("recusado");
      expect(payload.autonomia).toBe("A1");
      expect(payload.motivo).toContain("aprovação humana");
    });

    it("recusa executar quando o nó não existe", async () => {
      const { isError } = await call("constructor_execute", {
        canvasNodeId: "inexistente",
        taskDescription: "x",
      });
      expect(isError).toBe(true);
    });

    it("um agente A4 passa do portão de autonomia", async () => {
      const { node } = await seedAgent("A4");
      const { payload, isError } = await call("constructor_execute", {
        canvasNodeId: node.id,
        taskDescription: "consolidar relatório",
      });
      // Sem provedor configurado no nó, o Construtor recusa depois do portão —
      // o que importa aqui é que a política de autonomia não barrou.
      if (isError) {
        expect(payload.error).not.toContain("aprovação humana");
      } else {
        expect(payload.status).toBe("iniciado");
      }
    });
  });

  it("ferramenta desconhecida vira erro legível", async () => {
    const { payload, isError } = await call("constructor_inexistente");
    expect(isError).toBe(true);
    expect(payload.error).toContain("desconhecida");
  });

  it("erro de rede vira erro de ferramenta, não queda", async () => {
    const offline = createHttpClient("http://127.0.0.1:1");
    const result = await runTool("constructor_health", {}, offline);
    expect(result.isError).toBe(true);
  });
});
