import { afterEach, describe, expect, it } from "vitest";
import { AnthropicAdapter } from "../src/anthropicAdapter.js";
import { startMockServer, type MockServer } from "./mockServer.js";

describe("AnthropicAdapter — servidor HTTP real, sem chave de verdade", () => {
  let server: MockServer;

  afterEach(async () => {
    await server?.close();
  });

  it("envia x-api-key e anthropic-version corretamente", async () => {
    server = await startMockServer((req, res) => {
      if (req.url === "/models") res.writeHead(200).end("{}");
      else res.writeHead(500).end();
    });
    const adapter = new AnthropicAdapter({ apiKey: "sk-ant-fake", baseUrl: server.url });
    await adapter.healthy();
    expect(server.requests[0].headers["x-api-key"]).toBe("sk-ant-fake");
    expect(server.requests[0].headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("healthy() false em erro de rede", async () => {
    const adapter = new AnthropicAdapter({ apiKey: "sk-ant-fake", baseUrl: "http://127.0.0.1:1" });
    await expect(adapter.healthy()).resolves.toBe(false);
  });

  it("complete() extrai o bloco de texto da resposta", async () => {
    server = await startMockServer((req, res) => {
      if (req.url === "/messages") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(
          JSON.stringify({ content: [{ type: "text", text: "resposta real do mock" }] }),
        );
      }
    });
    const adapter = new AnthropicAdapter({ apiKey: "sk-ant-fake", baseUrl: server.url, model: "claude-sonnet-4-5" });
    const result = await adapter.complete({ prompt: "diga oi", system: "seja direto" });
    expect(result.text).toBe("resposta real do mock");

    const sentBody = JSON.parse(server.requests[0].body);
    expect(sentBody.model).toBe("claude-sonnet-4-5");
    expect(sentBody.system).toBe("seja direto");
  });
});
