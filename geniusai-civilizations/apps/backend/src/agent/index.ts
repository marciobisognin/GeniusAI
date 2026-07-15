import type { Config } from "../config";
import type { AgentRunner } from "./AgentRunner";
import { CliAgentRunner } from "./CliAgentRunner";
import { MockRunner } from "./MockRunner";
import { OllamaRunner } from "./OllamaRunner";

export type { AgentRunner, AgentDecision, AgentAction, DecideInput } from "./AgentRunner";
export * from "./actions";
export * from "./prompt";
export * from "./runTurn";
export * from "./memory";
export * from "./answerQuestion";
export {
  createCivilizationAgent,
  validateCivilizationDefinition,
  InvalidCivilizationDefinitionError,
  consoleAgentLogger,
} from "./CivilizationAgentFactory";
export type {
  CivilizationAgent,
  CivilizationAgentContext,
  AgentLogger,
  AgentLogEntry,
} from "./CivilizationAgentFactory";

/** Cria o runner conforme a configuração (env RUNNER + AGENT_CMD). */
export function createRunner(cfg: Config): AgentRunner {
  const cmd = cfg.agentCmd;

  switch (cfg.runner) {
    case "mock":
      return new MockRunner();

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
      // Fase 19 (§19 — RF-18/RF-19): --system-prompt substitui o prompt
      // padrão do Claude Code pela persona da civilização (em vez de
      // concatená-la no stdin e pagar o system prompt de agente de
      // codificação inteiro); stream-json + include-partial-messages dá
      // onToken de verdade (deltas reais do modelo), não um blob só no fim.
      return new CliAgentRunner({
        name: "claude",
        cmd: cmd ?? "claude",
        decideArgs: ["-p", "--output-format", "stream-json", "--include-partial-messages", "--verbose"],
        healthArgs: ["--version"],
        systemPromptFlag: "--system-prompt",
        streamJsonLines: true,
      });
  }
}
