import type { AgentDecision } from "./AgentRunner";

/**
 * Extrai o primeiro objeto JSON de uma saída possivelmente ruidosa
 * (modelos locais / CLIs às vezes cercam com texto ou ``` ). Estratégia
 * simples e robusta o bastante para a Fase 0: pega do primeiro "{" ao
 * último "}" e faz parse.
 *
 * A validação estrita por schema (zod) do payload de ações entra na Fase 2,
 * quando o schema de ações do jogo estiver definido.
 */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("nenhum objeto JSON encontrado na saída do runner");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export function parseDecision(raw: string): AgentDecision {
  const obj = extractJson(raw) as Record<string, unknown>;
  const reasoning = typeof obj.reasoning === "string" ? obj.reasoning : "";
  const actions = Array.isArray(obj.actions)
    ? (obj.actions as AgentDecision["actions"])
    : [];
  return { reasoning, actions, raw };
}
