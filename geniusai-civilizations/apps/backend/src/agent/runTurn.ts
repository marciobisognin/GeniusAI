import type { AgentRunner } from "./AgentRunner";
import type { CivDecision, CivId, World } from "../engine/types";
import { RESPONSE_JSON_SCHEMA, coerceActions } from "./actions";
import { buildSystemPrompt, buildTurnPrompt } from "./prompt";

export interface RunTurnOptions {
  onToken?: (chunk: string) => void;
  timeoutMs?: number;
}

export interface TurnResult {
  /** Decisão validada, pronta para o World Engine aplicar. */
  decision: CivDecision;
  /** Justificativa do agente (para a UI). */
  reasoning: string;
  /** true se o runner falhou 2× e o turno foi "passado" (ações vazias). */
  passed: boolean;
  /** Nº de tentativas usadas (1 ou 2). */
  attempts: number;
  /** Erros de validação/execução (feedback p/ o próximo turno). */
  errors: string[];
}

/**
 * Executa o turno de decisão de UMA civilização:
 * monta os prompts → chama o runner → valida (zod) → devolve ações válidas.
 *
 * Robustez (conforme o PRD): se o runner FALHA (exceção — ex.: saída não-JSON,
 * timeout), re-pergunta 1×; se falhar de novo, "passa o turno" (ações vazias).
 * Ações estruturalmente válidas porém ilegais no jogo NÃO derrubam o turno —
 * são descartadas aqui (com erro registrado) e/ou rejeitadas pelo motor.
 */
export async function runCivilizationTurn(
  world: World,
  civId: CivId,
  runner: AgentRunner,
  opts: RunTurnOptions = {},
): Promise<TurnResult> {
  const civ = world.civilizations[civId];
  const system = buildSystemPrompt(civ.persona, civId);
  const baseUser = buildTurnPrompt(world, civId);

  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const user =
      attempt === 1
        ? baseUser
        : `${baseUser}\n\nSua resposta anterior foi inválida (${lastError}). Responda APENAS com um JSON válido no schema { "reasoning", "actions" }.`;

    try {
      const decision = await runner.decide({
        system,
        user,
        schema: RESPONSE_JSON_SCHEMA,
        onToken: opts.onToken,
        timeoutMs: opts.timeoutMs,
      });
      const { valid, errors } = coerceActions(decision.actions);
      return {
        decision: { civ: civId, actions: valid },
        reasoning: decision.reasoning,
        passed: false,
        attempts: attempt,
        errors,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    decision: { civ: civId, actions: [] },
    reasoning: "(turno passado — o runner não produziu uma resposta válida)",
    passed: true,
    attempts: 2,
    errors: [lastError],
  };
}
