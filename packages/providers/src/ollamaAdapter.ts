import type { CompletionInput, CompletionOutput, LLMProviderAdapter } from "./adapter.js";
import { timeoutSignal } from "./adapter.js";

export interface OllamaAdapterOptions {
  /** Ex.: http://localhost:11434 */
  host: string;
  model?: string;
  numPredict?: number;
}

/**
 * Fala HTTP direto com um Ollama local — mesmo protocolo do
 * `OllamaRunner` de `geniusai-civilizations/apps/backend/src/agent/OllamaRunner.ts`,
 * generalizado para o contrato neutro `LLMProviderAdapter` (sem o JSON
 * Schema de ações específico daquele domínio).
 */
export class OllamaAdapter implements LLMProviderAdapter {
  readonly name = "ollama";

  constructor(private readonly options: OllamaAdapterOptions) {}

  async healthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.options.host}/api/tags`, { signal: timeoutSignal() });
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const res = await fetch(`${this.options.host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model ?? this.options.model ?? "llama3",
        prompt: input.prompt,
        system: input.system,
        stream: false,
        options: { num_predict: input.maxTokens ?? this.options.numPredict ?? 512 },
      }),
      signal: timeoutSignal(input.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`OllamaAdapter: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { response: string };
    return { text: json.response, raw: json };
  }
}
