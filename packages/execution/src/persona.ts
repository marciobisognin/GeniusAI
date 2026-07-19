import type { Agent } from "@genius/canon";

/** Monta o prompt de sistema a partir da persona do Agent — a "DNA" mínima hoje disponível no canon. */
export function buildPersonaPrompt(agent: Agent): string {
  let prompt = `Você é ${agent.nome}`;
  if (agent.area) prompt += `, atuando na área de ${agent.area}`;
  prompt += `.`;
  if (agent.descricao) prompt += ` ${agent.descricao}`;
  if (agent.skills.length > 0) prompt += ` Suas habilidades incluem: ${agent.skills.join(", ")}.`;
  prompt += ` Responda de forma direta e profissional, adequada ao seu papel.`;
  return prompt;
}

/**
 * Autonomia como gatilho de aprovação (v0 honesto): o sistema ainda não tem
 * detecção real de "ação externa" a partir do texto livre do modelo — em vez
 * de fingir isso, usa a habilitação (A0–A5) já existente no canon como proxy
 * declarado. A0–A2 sempre pausam para aprovação humana antes de "concluído"
 * (coerente com so-ia: ato vinculado trava em A2); A3+ completa direto.
 */
export const AUTONOMY_REQUIRES_APPROVAL = new Set(["A0", "A1", "A2"]);

export function requiresApproval(autonomia: string): boolean {
  return AUTONOMY_REQUIRES_APPROVAL.has(autonomia);
}
