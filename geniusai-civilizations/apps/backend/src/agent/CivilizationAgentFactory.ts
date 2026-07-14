import { z } from "zod";
import { ADVISOR_ROLES, CIV_IDS, TECHS } from "@geniusai/shared";
import type { CivilizationDefinition } from "@geniusai/shared";
import type { CivId, World } from "../engine/types";
import { logger as backendLogger } from "../logger";
import type { AgentRunner } from "./AgentRunner";
import { answerCivilizationQuestion } from "./answerQuestion";
import { runCivilizationTurn } from "./runTurn";
import type { RunTurnOptions, TurnResult } from "./runTurn";

// ── Validação (§7.2: "validar identidade, atributos e limites") ────────────

const CivIdSchema = z.enum([...CIV_IDS] as [CivId, ...CivId[]]);

const CivilizationDefinitionSchema = z.object({
  id: CivIdSchema,
  name: z.string().trim().min(1).max(40),
  adjective: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "cor deve ser hex #rrggbb"),
  leaderName: z.string().trim().min(1).max(40),
  personality: z.array(z.string().trim().min(1).max(60)).min(1).max(6),
  priorities: z.array(z.enum(["military", "science", "economy", "culture", "diplomacy"])).min(1).max(5),
  riskTolerance: z.number().min(0).max(1),
  diplomacyStyle: z.enum(["peaceful", "balanced", "aggressive"]),
  startingTechnologies: z.array(z.string()),
  startingResources: z.object({
    food: z.number().finite().nonnegative(),
    gold: z.number().finite().nonnegative(),
    science: z.number().finite().nonnegative(),
  }),
  model: z.string().trim().min(1).max(200).optional(),
  /** Conselheiros ativos (Fase 14, §16 — opcional, por civilização). */
  advisors: z.array(z.enum(ADVISOR_ROLES)).max(ADVISOR_ROLES.length).optional(),
});

export class InvalidCivilizationDefinitionError extends Error {}

/**
 * Valida uma `CivilizationDefinition` (identidade, atributos e limites —
 * PRD §7.2). Também confere que `startingTechnologies` só referencia
 * tecnologias que existem de verdade no catálogo (`@geniusai/shared`).
 */
export function validateCivilizationDefinition(def: unknown): CivilizationDefinition {
  const parsed = CivilizationDefinitionSchema.safeParse(def);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new InvalidCivilizationDefinitionError(
      `definição de civilização inválida: ${issue.path.join(".") || "(raiz)"} — ${issue.message}`,
    );
  }
  for (const tech of parsed.data.startingTechnologies) {
    if (!TECHS[tech]) {
      throw new InvalidCivilizationDefinitionError(`tecnologia inicial desconhecida: "${tech}"`);
    }
  }
  return parsed.data as CivilizationDefinition;
}

// ── Logger estruturado (§7.2: "logger" no contexto do agente) ──────────────

export interface AgentLogEntry {
  gameId: string;
  civ: CivId;
  tick: number;
  operation: "decide" | "answerQuestion";
  durationMs: number;
  errorCode?: string;
}

export interface AgentLogger {
  log(entry: AgentLogEntry): void;
}

/**
 * Logger padrão: delega ao logger estruturado do backend (`../logger`), que
 * já resolve o formato pretty/json (RNF-003) — uma linha por operação do
 * agente, correlacionável por `gameId`/`civilizationId`/`tick`.
 */
export const consoleAgentLogger: AgentLogger = {
  log(entry) {
    const level = entry.errorCode ? "warn" : "info";
    backendLogger[level](`agente ${entry.civ} · ${entry.operation}`, {
      gameId: entry.gameId,
      civilizationId: entry.civ,
      tick: entry.tick,
      operation: entry.operation,
      durationMs: entry.durationMs,
      errorCode: entry.errorCode,
    });
  },
};

// ── Contexto e agente (§7.3) ────────────────────────────────────────────────

export interface CivilizationAgentContext {
  gameId: string;
  civilization: CivilizationDefinition;
  runner: AgentRunner;
  logger?: AgentLogger;
}

export interface CivilizationAgent {
  readonly civilizationId: CivId;
  readonly definition: CivilizationDefinition;
  decide(world: World, opts?: RunTurnOptions): Promise<TurnResult>;
  answerQuestion(world: World, question: string): Promise<string>;
  /**
   * Resumo público curto do turno — síntese LOCAL (sem chamar o runner) das
   * ações escolhidas, para uso em UI/log onde uma consulta extra ao modelo
   * seria desperdício.
   */
  summarizeTurn(result: TurnResult): Promise<string>;
}

const ACTION_LABEL: Record<string, string> = {
  build: "construiu",
  research: "iniciou pesquisa",
  move_army: "moveu um exército",
  attack: "atacou",
  retreat_army: "recuou um exército",
  recruit: "recrutou um exército",
  set_diplomacy: "mudou a diplomacia",
  propose_trade: "propôs comércio",
  propose_alliance: "propôs aliança",
  respond_proposal: "respondeu a uma proposta",
  set_strategy: "atualizou a estratégia",
};

/**
 * Monta UM agente de civilização (§7 do PRD — "Agente Construtor"): valida a
 * definição, conecta runner/memória (a memória continua isolada por partida
 * via `agent/memory.ts`, chaveada por `gameId`+`civId` — o agente nunca
 * escolhe o caminho) e devolve um objeto com `decide`/`answerQuestion`/
 * `summarizeTurn`.
 *
 * Segurança (§7.6), já garantida pela arquitetura existente e preservada
 * aqui: o agente não recebe caminhos locais nem escolhe `gameId`
 * (`snapshotForCiv` só expõe estado de jogo); só pode emitir ações do
 * `ACTION_TOOLS` registrado (validadas por zod em `coerceActions` e de novo
 * pelo motor); não acessa a memória de outra civilização (`snapshotForCiv`
 * inclui `you.memory`, nunca a de `others`); falha do runner sempre cai no
 * fallback seguro de `runCivilizationTurn` (passa o turno, partida continua).
 */
export function createCivilizationAgent(ctx: CivilizationAgentContext): CivilizationAgent {
  const definition = validateCivilizationDefinition(ctx.civilization);
  const logger = ctx.logger ?? consoleAgentLogger;

  return {
    civilizationId: definition.id,
    definition,

    async decide(world, opts = {}) {
      const start = Date.now();
      const result = await runCivilizationTurn(world, definition.id, ctx.runner, {
        ...opts,
        model: opts.model ?? definition.model,
        advisors: opts.advisors ?? definition.advisors,
      });
      logger.log({
        gameId: ctx.gameId,
        civ: definition.id,
        tick: world.tick + 1,
        operation: "decide",
        durationMs: Date.now() - start,
        errorCode: result.passed ? "TURN_PASSED" : undefined,
      });
      return result;
    },

    async answerQuestion(world, question) {
      const start = Date.now();
      try {
        const text = await answerCivilizationQuestion(world, definition, ctx.runner, question);
        logger.log({
          gameId: ctx.gameId,
          civ: definition.id,
          tick: world.tick,
          operation: "answerQuestion",
          durationMs: Date.now() - start,
        });
        return text;
      } catch (err) {
        logger.log({
          gameId: ctx.gameId,
          civ: definition.id,
          tick: world.tick,
          operation: "answerQuestion",
          durationMs: Date.now() - start,
          errorCode: "ASK_FAILED",
        });
        throw err;
      }
    },

    async summarizeTurn(result) {
      if (result.passed) return `${definition.name} passou o turno.`;
      if (result.decision.actions.length === 0) return `${definition.name} observou o mundo, sem agir.`;
      const verbs = result.decision.actions.map((a) => ACTION_LABEL[a.tool] ?? a.tool);
      return `${definition.name}: ${verbs.join(", ")}.`;
    },
  };
}
