import { Skill, type LearningFlow } from "@genius/canon";

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface MaybePromoteSkillInput {
  agentId: string;
  tags: string[];
  /** Todos os LearningFlows já gravados (o novo incluso) — a contagem é feita aqui, não pelo chamador. */
  existingFlows: LearningFlow[];
  existingSkills: Skill[];
  /** A partir de quantas repetições bem-sucedidas propor a skill. */
  threshold?: number;
}

/**
 * "Propõe" = cria a `Skill` diretamente com `origem: "gerada"` (mesmo
 * conceito de `so-ia/src/lib/org/skills-registry.ts`, porém alimentada por
 * uso real). v0 honesto: não existe ainda uma fila de revisão humana
 * separada — a skill nasce visível na Biblioteca e pode ser removida se
 * não fizer sentido, do mesmo jeito que qualquer entidade "gerada".
 */
export function maybePromoteSkill(input: MaybePromoteSkillInput): Skill | null {
  const threshold = input.threshold ?? 3;
  const existingNames = new Set(input.existingSkills.map((s) => s.nome.toLowerCase()));

  for (const tag of input.tags) {
    if (!tag || existingNames.has(tag.toLowerCase())) continue;
    const count = input.existingFlows.filter(
      (f) => f.agentOrSkillOrigin === input.agentId && f.tags.includes(tag),
    ).length;
    if (count >= threshold) {
      return Skill.parse({
        id: `gerada-${slugify(tag)}-${Date.now().toString(36)}`,
        nome: tag,
        descricao: `Skill promovida automaticamente: ${count} execuções aprovadas do agente "${input.agentId}" repetiram este padrão.`,
        origem: "gerada",
      });
    }
  }
  return null;
}
