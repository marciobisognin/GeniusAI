import type { CompletionInput, CompletionOutput, LLMProviderAdapter } from "./adapter.js";
import { timeoutSignal } from "./adapter.js";

export interface AnthropicAdapterOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  apiVersion?: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_API_VERSION = "2023-06-01";

/** API oficial da Anthropic (Claude). */
export class AnthropicAdapter implements LLMProviderAdapter {
  readonly name = "anthropic";
  private readonly baseUrl: string;
  private readonly apiVersion: string;

  constructor(private readonly options: AnthropicAdapterOptions) {
    this.baseUrl = options.baseUrl ?? "https://api.anthropic.com/v1";
    this.apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.options.apiKey,
      "anthropic-version": this.apiVersion,
    };
  }

  async healthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: this.headers(),
        signal: timeoutSignal(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: input.model ?? this.options.model ?? DEFAULT_MODEL,
        max_tokens: input.maxTokens ?? 1024,
        system: input.system,
        messages: [{ role: "user", content: input.prompt }],
      }),
      signal: timeoutSignal(input.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`AnthropicAdapter: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    const text = json.content.find((block) => block.type === "text")?.text ?? "";
    return { text, raw: json };
  }
}
