import { RESPONSE_JSON_SCHEMA } from "../agent/actions";
import type { AgentRunner } from "../agent/AgentRunner";
import type { GameEvent } from "../engine/types";

const NARRATOR_SYSTEM = [
  `Você é o narrador desta simulação de civilizações.`,
  `Receberá um lote de eventos do motor de simulação (JSON) e deve escrever`,
  `UMA frase curta, em português, estilo manchete de jornal, destacando o`,
  `evento mais interessante do lote (guerra, traição, aliança, descoberta...).`,
  `Se os eventos forem rotineiros (só crescimento/renda), pode retornar uma`,
  `frase vazia.`,
  ``,
  `Responda ESTRITAMENTE com o mesmo formato JSON usado pelos agentes:`,
  `{ "reasoning": "<sua manchete ou vazio>", "actions": [] }`,
  `O campo "actions" deve ser sempre um array vazio — você narra, não age.`,
].join("\n");

/**
 * Gera uma manchete curta para o lote de eventos de um tick, reaproveitando
 * o mesmo AgentRunner/schema/parse dos agentes de civilização (o "reasoning"
 * vira a narração; "actions" é ignorado). Decorativo: qualquer falha do
 * runner é engolida e devolve null — o narrador nunca derruba um tick.
 */
export async function narrate(
  runner: AgentRunner,
  events: GameEvent[],
  timeoutMs = 30_000,
): Promise<string | null> {
  const narratable = events.filter((e) => e.type !== "tick_started");
  if (narratable.length === 0) return null;

  try {
    const res = await runner.decide({
      system: NARRATOR_SYSTEM,
      user: JSON.stringify(narratable),
      schema: RESPONSE_JSON_SCHEMA,
      timeoutMs,
    });
    const text = res.reasoning.trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
