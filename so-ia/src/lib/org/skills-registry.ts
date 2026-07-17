import { skillDescriptions } from "@/lib/data/skills";

export interface SkillRecord {
  id: string;
  descricao: string;
  origem: "catalogo" | "gerada";
  criadaEm?: string;
}

// Snapshot of the ids that shipped pre-written in the institutional catalog,
// captured once at module load — before any onboarding run can call
// ensureSkill and mutate skillDescriptions with organization-specific skills.
const catalogIds = new Set(Object.keys(skillDescriptions));
const generatedMeta = new Map<string, { criadaEm: string }>();

/** Registers a skill the first time it's needed by a synthesized agent. Idempotent. */
export function ensureSkill(id: string, descricaoFallback: string): SkillRecord {
  if (!skillDescriptions[id]) {
    skillDescriptions[id] = descricaoFallback;
    generatedMeta.set(id, { criadaEm: new Date().toISOString() });
  }
  return getSkill(id)!;
}

export function getSkill(id: string): SkillRecord | undefined {
  const descricao = skillDescriptions[id];
  if (!descricao) return undefined;
  const meta = generatedMeta.get(id);
  return {
    id,
    descricao,
    origem: catalogIds.has(id) ? "catalogo" : "gerada",
    criadaEm: meta?.criadaEm,
  };
}

export function listSkills(): SkillRecord[] {
  return Object.keys(skillDescriptions)
    .map((id) => getSkill(id)!)
    .sort((a, b) => a.id.localeCompare(b.id));
}
