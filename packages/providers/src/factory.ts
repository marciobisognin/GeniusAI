import type { ProviderConfig } from "@genius/canon";
import type { LLMProviderAdapter } from "./adapter.js";
import { AnthropicAdapter } from "./anthropicAdapter.js";
import { OllamaAdapter } from "./ollamaAdapter.js";
import { OpenAIChatAdapter } from "./openaiChatAdapter.js";
import { OpenAICodexAdapter } from "./openaiCodexAdapter.js";
import { OpenAICompatibleAdapter } from "./openaiCompatibleAdapter.js";

/**
 * Resolve `apiKeyRef` (nome de variável de ambiente — nunca a chave em
 * texto puro no `ProviderConfig`) para o valor real. Padrão: `process.env`;
 * o chamador pode injetar outra fonte (ex.: keychain do SO, quando o app
 * virar Tauri).
 */
export type SecretResolver = (ref: string) => string | undefined;

export const envSecretResolver: SecretResolver = (ref) => process.env[ref];

export class MissingSecretError extends Error {
  constructor(providerId: string, ref: string) {
    super(`Provedor "${providerId}": apiKeyRef "${ref}" não encontrado (variável de ambiente ausente).`);
  }
}

export function createAdapter(
  config: ProviderConfig,
  resolveSecret: SecretResolver = envSecretResolver,
): LLMProviderAdapter {
  function requireSecret(): string {
    if (!config.apiKeyRef) {
      throw new MissingSecretError(config.id, "(nenhum apiKeyRef configurado)");
    }
    const value = resolveSecret(config.apiKeyRef);
    if (!value) throw new MissingSecretError(config.id, config.apiKeyRef);
    return value;
  }

  switch (config.tipo) {
    case "anthropic":
      return new AnthropicAdapter({ apiKey: requireSecret(), model: config.model, baseUrl: config.baseUrl });
    case "openai-chat":
      return new OpenAIChatAdapter({ apiKey: requireSecret(), model: config.model, baseUrl: config.baseUrl });
    case "openai-codex":
      return new OpenAICodexAdapter({ cmd: config.cmd });
    case "ollama":
      return new OllamaAdapter({ host: config.baseUrl ?? "http://localhost:11434", model: config.model });
    case "openai-compatible":
      if (!config.baseUrl) throw new Error(`Provedor "${config.id}": openai-compatible exige baseUrl.`);
      return new OpenAICompatibleAdapter({
        baseUrl: config.baseUrl,
        apiKey: config.apiKeyRef ? resolveSecret(config.apiKeyRef) : undefined,
        model: config.model ?? "default",
      });
    default: {
      const exhaustive: never = config.tipo;
      throw new Error(`Tipo de provedor desconhecido: ${exhaustive}`);
    }
  }
}
