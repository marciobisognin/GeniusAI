import type { ProviderConfig } from "@genius/canon";
import { describe, expect, it } from "vitest";
import { AnthropicAdapter } from "../src/anthropicAdapter.js";
import { createAdapter, MissingSecretError } from "../src/factory.js";
import { OllamaAdapter } from "../src/ollamaAdapter.js";
import { OpenAIChatAdapter } from "../src/openaiChatAdapter.js";
import { OpenAICodexAdapter } from "../src/openaiCodexAdapter.js";
import { OpenAICompatibleAdapter } from "../src/openaiCompatibleAdapter.js";

function baseConfig(overrides: Partial<ProviderConfig>): ProviderConfig {
  return { id: "p1", tipo: "ollama", nome: "Teste", ...overrides };
}

describe("createAdapter — fábrica do Hub de Provedores", () => {
  it("constrói cada tipo com a classe correta", () => {
    const resolve = () => "valor-secreto";
    expect(createAdapter(baseConfig({ tipo: "anthropic", apiKeyRef: "X" }), resolve)).toBeInstanceOf(AnthropicAdapter);
    expect(createAdapter(baseConfig({ tipo: "openai-chat", apiKeyRef: "X" }), resolve)).toBeInstanceOf(OpenAIChatAdapter);
    expect(createAdapter(baseConfig({ tipo: "openai-codex" }), resolve)).toBeInstanceOf(OpenAICodexAdapter);
    expect(createAdapter(baseConfig({ tipo: "ollama" }), resolve)).toBeInstanceOf(OllamaAdapter);
    expect(
      createAdapter(baseConfig({ tipo: "openai-compatible", baseUrl: "http://x" }), resolve),
    ).toBeInstanceOf(OpenAICompatibleAdapter);
  });

  it("lança MissingSecretError quando apiKeyRef não resolve (anthropic/openai-chat exigem chave)", () => {
    const resolveVazio = () => undefined;
    expect(() => createAdapter(baseConfig({ tipo: "anthropic", apiKeyRef: "FALTANDO" }), resolveVazio)).toThrow(
      MissingSecretError,
    );
    expect(() => createAdapter(baseConfig({ tipo: "openai-chat" }), resolveVazio)).toThrow(MissingSecretError);
  });

  it("openai-compatible exige baseUrl mas não exige apiKey", () => {
    expect(() => createAdapter(baseConfig({ tipo: "openai-compatible" }))).toThrow(/exige baseUrl/);
    expect(
      createAdapter(baseConfig({ tipo: "openai-compatible", baseUrl: "http://localhost:1234" })),
    ).toBeInstanceOf(OpenAICompatibleAdapter);
  });

  it("ollama não exige nenhum segredo — funciona 100% local", () => {
    expect(createAdapter(baseConfig({ tipo: "ollama" }))).toBeInstanceOf(OllamaAdapter);
  });

  it("usa envSecretResolver por padrão (lê de process.env de verdade)", () => {
    process.env.GENIUS_TEST_SECRET = "chave-real-do-ambiente";
    const adapter = createAdapter(baseConfig({ tipo: "anthropic", apiKeyRef: "GENIUS_TEST_SECRET" }));
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
    delete process.env.GENIUS_TEST_SECRET;
  });
});
