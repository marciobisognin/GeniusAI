import type { CivilizationDefinition } from "@geniusai/shared";
import type { World } from "../engine/types";
import { RESPONSE_JSON_SCHEMA } from "./actions";
import type { AgentRunner } from "./AgentRunner";
import { snapshotForCiv } from "./prompt";
import { MAX_PUBLIC_REASONING_CHARS, clampPublicReasoning } from "./runTurn";

/**
 * "Pergunte à civilização" (RF-032): consulta o agente real em modo
 * SOMENTE LEITURA — mesmo runner e mesmo formato de resposta dos turnos de
 * jogo, mas sem produzir ações e sem tocar no estado do mundo ou na memória
 * estratégica (o chamador nunca aplica `actions`, nunca avança o tick).
 */
export async function answerCivilizationQuestion(
  world: World,
  definition: CivilizationDefinition,
  runner: AgentRunner,
  question: string,
  timeoutMs = 30_000,
): Promise<string> {
  const civ = world.civilizations[definition.id];
  const snapshot = snapshotForCiv(world, definition.id);
  const system = [
    `Você é a voz da civilização "${definition.name}" (${definition.leaderName}) em uma simulação observável.`,
    `Personalidade: ${civ.persona}`,
    `Um observador humano fará uma pergunta. Responda em primeira pessoa, em português,`,
    `com 2 a 4 frases (no máximo ${MAX_PUBLIC_REASONING_CHARS} caracteres), coerente com o estado atual`,
    `do mundo e com sua memória estratégica.`,
    `Isto é apenas uma conversa: NÃO escolha ações de jogo.`,
    `Responda ESTRITAMENTE com um JSON { "reasoning": string, "actions": [] } — a resposta vai em "reasoning".`,
  ].join("\n");
  const user = [
    `Estado atual (tick ${world.tick}):`,
    JSON.stringify(snapshot),
    ``,
    `Pergunta do observador: ${JSON.stringify(question)}`,
  ].join("\n");

  const decision = await runner.decide({
    system,
    user,
    schema: RESPONSE_JSON_SCHEMA,
    timeoutMs,
    model: definition.model,
  });
  const text = clampPublicReasoning(decision.reasoning.trim());
  if (!text) throw new Error("o agente respondeu vazio");
  return text;
}
