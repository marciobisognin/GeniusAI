import { afterEach, describe, expect, it } from "vitest";
import { OllamaAdapter } from "../src/ollamaAdapter.js";
import { startMockServer, type MockServer } from "./mockServer.js";

describe("OllamaAdapter — mesmo protocolo do OllamaRunner do civilizations", () => {
  let server: MockServer;

  afterEach(async () => {
    await server?.close();
  });

  it("healthy() usa GET /api/tags", async () => {
    server = await startMockServer((req, res) => {
      if (req.url === "/api/tags") res.writeHead(200).end("{}");
      else res.writeHead(500).end();
    });
    const adapter = new OllamaAdapter({ host: server.url });
    await expect(adapter.healthy()).resolves.toBe(true);
  });

  it("healthy() false quando não há Ollama rodando (conexão recusada)", async () => {
    const adapter = new OllamaAdapter({ host: "http://127.0.0.1:1" });
    await expect(adapter.healthy()).resolves.toBe(false);
  });

  it("complete() chama /api/generate com stream:false e num_predict", async () => {
    server = await startMockServer((req, res) => {
      if (req.url === "/api/generate") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ response: "resposta local" }));
      }
    });
    const adapter = new OllamaAdapter({ host: server.url, model: "llama3", numPredict: 256 });
    const result = await adapter.complete({ prompt: "oi" });
    expect(result.text).toBe("resposta local");

    const sentBody = JSON.parse(server.requests[0].body);
    expect(sentBody.model).toBe("llama3");
    expect(sentBody.stream).toBe(false);
    expect(sentBody.options.num_predict).toBe(256);
  });
});
