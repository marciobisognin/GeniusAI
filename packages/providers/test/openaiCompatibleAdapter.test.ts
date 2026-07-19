import { afterEach, describe, expect, it } from "vitest";
import { OpenAICompatibleAdapter } from "../src/openaiCompatibleAdapter.js";
import { startMockServer, type MockServer } from "./mockServer.js";

describe("OpenAICompatibleAdapter — cobre OpenRouter/vLLM/LM Studio/Groq com um único adapter", () => {
  let server: MockServer;

  afterEach(async () => {
    await server?.close();
  });

  it("funciona sem apiKey (ex.: LM Studio local)", async () => {
    server = await startMockServer((req, res) => {
      if (req.url === "/models") res.writeHead(200).end("{}");
    });
    const adapter = new OpenAICompatibleAdapter({ baseUrl: server.url, model: "local-model" });
    await expect(adapter.healthy()).resolves.toBe(true);
    expect(server.requests[0].headers.authorization).toBeUndefined();
  });

  it("envia Authorization quando apiKey é fornecida (ex.: OpenRouter)", async () => {
    server = await startMockServer((req, res) => {
      if (req.url === "/chat/completions") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        );
      }
    });
    const adapter = new OpenAICompatibleAdapter({ baseUrl: server.url, apiKey: "or-fake-key", model: "meta/llama" });
    await adapter.complete({ prompt: "oi" });
    expect(server.requests[0].headers.authorization).toBe("Bearer or-fake-key");
  });
});
