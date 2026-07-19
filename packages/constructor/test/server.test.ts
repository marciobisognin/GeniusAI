import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer, type ConstructorServer } from "../src/server.js";

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

  it("todas as dez entidades do canon têm rota registrada", async () => {
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
    ];
    for (const path of paths) {
      const res = await server.app.inject({ method: "GET", url: `/${path}` });
      expect(res.statusCode, `rota /${path} deveria responder 200`).toBe(200);
    }
  });
});
