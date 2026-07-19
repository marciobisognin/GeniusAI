import type { CompletionInput, CompletionOutput, LLMProviderAdapter } from "./adapter.js";
import { timeoutSignal } from "./adapter.js";

export interface OpenAIChatAdapterOptions {
  apiKey: string;
  model?: string;
  /** Override para testes/proxies compatíveis (padrão: https://api.openai.com/v1). */
  baseUrl?: string;
}

/** ChatGPT/GPT via API oficial da OpenAI. */
export class OpenAIChatAdapter implements LLMProviderAdapter {
  readonly name = "openai-chat";
  private readonly baseUrl: string;

  constructor(private readonly options: OpenAIChatAdapterOptions) {
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
  }

  async healthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.options.apiKey}` },
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
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model ?? this.options.model ?? "gpt-4o-mini",
        max_tokens: input.maxTokens ?? 1024,
        messages,
      }),
      signal: timeoutSignal(input.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`OpenAIChatAdapter: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return { text: json.choices[0]?.message.content ?? "", raw: json };
  }
}
