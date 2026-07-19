import { afterEach, describe, expect, it } from "vitest";
import { OpenAIChatAdapter } from "../src/openaiChatAdapter.js";
import { startMockServer, type MockServer } from "./mockServer.js";

describe("OpenAIChatAdapter — servidor HTTP real, sem chave de verdade", () => {
  let server: MockServer;

  afterEach(async () => {
    await server?.close();
  });

  it("healthy() usa GET /models e não gasta tokens", async () => {
    server = await startMockServer((req, res) => {
      if (req.method === "GET" && req.url === "/models") {
        res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
      } else {
        res.writeHead(500).end();
      }
    });
    const adapter = new OpenAIChatAdapter({ apiKey: "sk-fake", baseUrl: server.url });
    await expect(adapter.healthy()).resolves.toBe(true);
    expect(server.requests[0].headers.authorization).toBe("Bearer sk-fake");
  });

  it("healthy() retorna false para chave inválida (401)", async () => {
    server = await startMockServer((_req, res) => res.writeHead(401).end("unauthorized"));
    const adapter = new OpenAIChatAdapter({ apiKey: "sk-invalida", baseUrl: server.url });
    await expect(adapter.healthy()).resolves.toBe(false);
  });

  it("healthy() retorna false quando o servidor está fora do ar", async () => {
    const adapter = new OpenAIChatAdapter({ apiKey: "sk-fake", baseUrl: "http://127.0.0.1:1" });
    await expect(adapter.healthy()).resolves.toBe(false);
  });

  it("complete() envia system+prompt e parseia a resposta real", async () => {
    server = await startMockServer((req, res) => {
      if (req.url === "/chat/completions") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(
          JSON.stringify({ choices: [{ message: { content: "olá do mock" } }] }),
        );
      }
    });
    const adapter = new OpenAIChatAdapter({ apiKey: "sk-fake", baseUrl: server.url, model: "gpt-4o-mini" });
    const result = await adapter.complete({ system: "Seja breve", prompt: "Diga oi" });
    expect(result.text).toBe("olá do mock");

    const sentBody = JSON.parse(server.requests[0].body);
    expect(sentBody.model).toBe("gpt-4o-mini");
    expect(sentBody.messages).toEqual([
      { role: "system", content: "Seja breve" },
      { role: "user", content: "Diga oi" },
    ]);
  });

  it("complete() lança erro legível quando o provedor responde com falha", async () => {
    server = await startMockServer((_req, res) => res.writeHead(429).end("rate limited"));
    const adapter = new OpenAIChatAdapter({ apiKey: "sk-fake", baseUrl: server.url });
    await expect(adapter.complete({ prompt: "oi" })).rejects.toThrow(/429/);
  });
});
