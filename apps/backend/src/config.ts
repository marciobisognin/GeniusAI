export type RunnerKind = "claude" | "codex" | "opencode" | "ollama";

export interface Config {
  runner: RunnerKind;
  /** Override do binário do CLI de agente (opcional). */
  agentCmd?: string;
  /** Modelo usado pelo runner ollama (e por CLIs que aceitem seleção). */
  model: string;
  /** Endpoint do Ollama, quando RUNNER=ollama. */
  ollamaHost: string;
  /** Porta do servidor HTTP/WebSocket do backend. */
  port: number;
  /** Liga o narrador de eventos (manchete por tick) — decorativo, off por padrão. */
  narrator: boolean;
}

const VALID_RUNNERS: RunnerKind[] = ["claude", "codex", "opencode", "ollama"];

export function loadConfig(): Config {
  const runnerEnv = (process.env.RUNNER ?? "claude").toLowerCase();
  const runner = (VALID_RUNNERS as string[]).includes(runnerEnv)
    ? (runnerEnv as RunnerKind)
    : "claude";

  return {
    runner,
    agentCmd: process.env.AGENT_CMD,
    model: process.env.MODEL ?? "qwen2.5:14b",
    ollamaHost: process.env.OLLAMA_HOST ?? "http://localhost:11434",
    port: Number(process.env.PORT ?? 8787),
    narrator: process.env.NARRATOR === "true",
  };
}
