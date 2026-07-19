import type { CompletionInput, CompletionOutput, LLMProviderAdapter } from "./adapter.js";
import { timeoutSignal } from "./adapter.js";

export interface OpenAICompatibleAdapterOptions {
  /** Ex.: https://openrouter.ai/api/v1, http://localhost:1234/v1 (LM Studio), http://localhost:8000/v1 (vLLM). */
  baseUrl: string;
  /** Alguns servidores locais (LM Studio) não exigem chave. */
  apiKey?: string;
  model: string;
}

/**
 * Genérico para qualquer endpoint compatível com a API da OpenAI — cobre
 * OpenRouter, vLLM, LM Studio, Groq e a maioria dos LLMs open-source
 * servidos localmente, sem precisar de um adapter por provedor.
 */
export class OpenAICompatibleAdapter implements LLMProviderAdapter {
  readonly name = "openai-compatible";

  constructor(private readonly options: OpenAICompatibleAdapterOptions) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.options.apiKey) headers.Authorization = `Bearer ${this.options.apiKey}`;
    return headers;
  }

  async healthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.options.baseUrl}/models`, {
        headers: this.headers(),
        signal: timeoutSignal(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const messages = [
      ...(input.system ? [{ role: "system", content: input.system }] : []),
      { role: "user", content: input.prompt },
    ];
    const res = await fetch(`${this.options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: input.model ?? this.options.model,
        max_tokens: input.maxTokens ?? 1024,
        messages,
      }),
      signal: timeoutSignal(input.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`OpenAICompatibleAdapter: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return { text: json.choices[0]?.message.content ?? "", raw: json };
  }
}
