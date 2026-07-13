import type { AgentDecision, AgentRunner, DecideInput } from "./AgentRunner";
import { parseDecision } from "./parse";

/**
 * Runner alternativo que fala HTTP diretamente com o Ollama local
 * (localhost:11434), usando `format` = JSON schema para forçar saída
 * estruturada. Mesmo contrato de saída dos runners de CLI.
 */
export class OllamaRunner implements AgentRunner {
  readonly name = "ollama";

  constructor(
    private readonly host: string,
    private readonly model: string,
    /** Teto de tokens de saída por turno (num_predict). */
    private readonly numPredict = 512,
  ) {}

  async healthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.host}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async decide(input: DecideInput): Promise<AgentDecision> {
    const res = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(input.timeoutMs ?? 60_000),
      body: JSON.stringify({
        // `input.model` (CivilizationDefinition.model) sobrepõe o modelo
        // padrão do runner — permite um modelo diferente por civilização.
        model: input.model ?? this.model,
        stream: false,
        format: input.schema, // JSON schema → Ollama força JSON válido
        keep_alive: "30m",
        options: { temperature: 0.8, num_predict: this.numPredict },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`ollama respondeu ${res.status}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content ?? "";
    input.onToken?.(content);
    return parseDecision(content);
  }
}
