import type { Config } from "../config";
import type { AgentRunner } from "./AgentRunner";
import { CliAgentRunner } from "./CliAgentRunner";
import { OllamaRunner } from "./OllamaRunner";

export type { AgentRunner, AgentDecision, AgentAction, DecideInput } from "./AgentRunner";
export * from "./actions";
export * from "./prompt";
export * from "./runTurn";
export * from "./memory";

/** Extrai o texto do modelo do envelope JSON do `claude -p --output-format json`. */
function unwrapClaudeEnvelope(stdout: string): string {
  try {
    const env = JSON.parse(stdout) as { result?: unknown };
    if (typeof env.result === "string") return env.result;
  } catch {
    // não era um envelope JSON — usa a saída como veio
  }
  return stdout;
}

/** Cria o runner conforme a configuração (env RUNNER + AGENT_CMD). */
export function createRunner(cfg: Config): AgentRunner {
  const cmd = cfg.agentCmd;

  switch (cfg.runner) {
    case "ollama":
      return new OllamaRunner(cfg.ollamaHost, cfg.model);

    case "codex":
      return new CliAgentRunner({
        name: "codex",
        cmd: cmd ?? "codex",
        decideArgs: ["exec"],
        healthArgs: ["--version"],
      });

    case "opencode":
      return new CliAgentRunner({
        name: "opencode",
        cmd: cmd ?? "opencode",
        decideArgs: ["run"],
        healthArgs: ["--version"],
      });

    case "claude":
    default:
      return new CliAgentRunner({
        name: "claude",
        cmd: cmd ?? "claude",
        decideArgs: ["-p", "--output-format", "json"],
        healthArgs: ["--version"],
        unwrap: unwrapClaudeEnvelope,
      });
  }
}
