import { CIV_IDS, DEFAULT_CIVILIZATIONS } from "@geniusai/shared";
import type { CivilizationDefinition } from "@geniusai/shared";
import type { CivId, World } from "../engine/types";
import type { AgentLogger, CivilizationAgent } from "../agent/CivilizationAgentFactory";
import { createCivilizationAgent } from "../agent/CivilizationAgentFactory";
import type { AgentRunner } from "../agent/AgentRunner";
import type { RunTurnOptions, TurnResult } from "../agent/runTurn";

export interface AgentOrchestratorOptions {
  gameId: string;
  runner: AgentRunner;
  /** Sobrescreve civilizações específicas do catálogo padrão (parcial). */
  definitions?: Partial<Record<CivId, CivilizationDefinition>>;
  logger?: AgentLogger;
}

export class UnknownCivilizationError extends Error {
  constructor(civId: string) {
    super(`civilização não registrada no orquestrador: ${civId}`);
  }
}

/**
 * Registro vivo dos agentes de UMA partida (§7.4 do PRD — "Fluxo de
 * criação"): cria um `CivilizationAgent` por civilização via
 * `CivilizationAgentFactory` e os mantém acessíveis por `CivId`.
 *
 * "Restaurar o agente ao carregar uma partida" (§7.2) acontece de forma
 * natural aqui: o orquestrador é recriado a cada `createGameLoop` (nova
 * partida OU partida carregada de save) a partir das MESMAS definições —
 * os agentes são objetos leves e sem estado próprio (a memória de longo
 * prazo vive em `World.civilizations[*].memory`, já restaurada pelo save).
 */
export class AgentOrchestrator {
  readonly definitions: Record<CivId, CivilizationDefinition>;
  private readonly agents: Map<CivId, CivilizationAgent> = new Map();

  constructor(opts: AgentOrchestratorOptions) {
    this.definitions = { ...DEFAULT_CIVILIZATIONS, ...opts.definitions };
    for (const id of CIV_IDS) {
      this.agents.set(
        id,
        createCivilizationAgent({
          gameId: opts.gameId,
          civilization: this.definitions[id],
          runner: opts.runner,
          logger: opts.logger,
        }),
      );
    }
  }

  getAgent(civId: CivId): CivilizationAgent {
    const agent = this.agents.get(civId);
    if (!agent) throw new UnknownCivilizationError(civId);
    return agent;
  }

  decide(civId: CivId, world: World, opts?: RunTurnOptions): Promise<TurnResult> {
    return this.getAgent(civId).decide(world, opts);
  }

  answerQuestion(civId: CivId, world: World, question: string): Promise<string> {
    return this.getAgent(civId).answerQuestion(world, question);
  }
}

export function createAgentOrchestrator(opts: AgentOrchestratorOptions): AgentOrchestrator {
  return new AgentOrchestrator(opts);
}
