import type { AdvisorRecommendation, AdvisorRole } from "@geniusai/shared";
import type { AgentRunner } from "./AgentRunner";
import type { CivDecision, CivId, World } from "../engine/types";
import { RESPONSE_JSON_SCHEMA, coerceActions } from "./actions";
import { consultAdvisors, DEFAULT_ADVISOR_TIMEOUT_MS } from "./advisors";
import { buildSystemPrompt, buildTurnPrompt } from "./prompt";

export interface RunTurnOptions {
  onToken?: (chunk: string) => void;
  timeoutMs?: number;
  /** Override de modelo (ver `DecideInput.model` — CivilizationDefinition.model). */
  model?: string;
  /** Conselheiros ativos desta civilização (Fase 14, §16 — RF-9/RF-10). */
  advisors?: AdvisorRole[];
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
  /** Recomendações da corte usadas nesta decisão ([] se sem conselheiros). */
  advisorRecommendations: AdvisorRecommendation[];
}

/**
 * Teto de caracteres da justificativa PÚBLICA de um turno (PRD §7.6:
 * "respostas devem incluir justificativa curta, nunca cadeia de pensamento
 * interna"). Defesa em profundidade — o prompt já pede 1–3 frases — contra
 * um runner que despeje um raciocínio longo demais na UI/timeline/trace.
 */
export const MAX_PUBLIC_REASONING_CHARS = 480;

/** Trunca a justificativa pública, preservando palavras inteiras. */
export function clampPublicReasoning(text: string): string {
  if (text.length <= MAX_PUBLIC_REASONING_CHARS) return text;
  return `${text.slice(0, MAX_PUBLIC_REASONING_CHARS).replace(/\s+\S*$/, "")}…`;
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

  // Corte de conselheiros (Fase 14, §16): roda ANTES do agente principal
  // decidir, com seu próprio orçamento de tempo (fração do timeout do
  // turno) — nunca deixa o conselho estourar o tempo da decisão em si.
  const advisorRecommendations = opts.advisors?.length
    ? await consultAdvisors(world, civId, opts.advisors, runner, {
        timeoutMs: opts.timeoutMs ? Math.min(opts.timeoutMs, DEFAULT_ADVISOR_TIMEOUT_MS) : DEFAULT_ADVISOR_TIMEOUT_MS,
        model: opts.model,
      })
    : [];
  const baseUser = buildTurnPrompt(world, civId, advisorRecommendations);

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
        model: opts.model,
      });
      const { valid, errors } = coerceActions(decision.actions);
      return {
        decision: { civ: civId, actions: valid },
        reasoning: clampPublicReasoning(decision.reasoning),
        passed: false,
        attempts: attempt,
        errors,
        advisorRecommendations,
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
    advisorRecommendations,
  };
}
