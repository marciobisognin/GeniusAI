import { Agent, Squad } from "@genius/canon";

/**
 * Porte fiel do algoritmo de `so-ia/src/lib/org/matching.ts` (para agentes)
 * e `so-ia/src/lib/org/squad-registry.ts` (para squads) — mesma
 * tokenização, mesmas stopwords, mesmos limiares. Generalizado para operar
 * sobre qualquer lista de candidatos (aqui, o que já está no Super
 * Construtor), não só o catálogo fixo do so-ia.
 *
 * Estas funções são puras: nunca gravam no banco. A decisão de persistir o
 * resultado (reaproveitar = não faz nada, já existe; criar = grava o draft)
 * é sempre do chamador — mantém "reaproveitar ou criar" como uma sugestão
 * revisável, nunca uma gravação automática.
 */

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "para", "com", "em", "no", "na",
  "nos", "nas", "um", "uma", "que", "por", "ao", "aos", "à", "às", "sobre", "entre", "seu",
  "sua", "seus", "suas", "ou", "se", "é", "ser", "gestao", "gestão",
]);

function tokenize(text: string): Set<string> {
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ");
  return new Set(normalized.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  const denom = Math.min(a.size, b.size) || 1;
  return shared / denom;
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface RoleSpec {
  titulo: string;
  area?: string;
  responsabilidades?: string[];
}

export interface MatchResult<T> {
  candidate: T | null;
  score: number;
}

/** Limiar idêntico ao de `so-ia/src/lib/org/matching.ts` (`MATCH_THRESHOLD`). */
const AGENT_MATCH_THRESHOLD = 0.34;
/** Limiar idêntico ao de `so-ia/src/lib/org/squad-registry.ts` (`findSquadTemplate`). */
const SQUAD_MATCH_THRESHOLD = 0.5;

function agentCorpus(agent: Pick<Agent, "nome" | "descricao" | "area" | "skills">): Set<string> {
  return tokenize(
    [agent.nome, agent.descricao, agent.area ?? "", ...agent.skills.map((s) => s.replace(/-/g, " "))].join(" "),
  );
}

function roleCorpus(spec: RoleSpec): Set<string> {
  return tokenize([spec.titulo, spec.area ?? "", ...(spec.responsabilidades ?? [])].join(" "));
}

/** Busca, entre os agentes já cadastrados, um compatível com o papel descrito. */
export function matchAgent(spec: RoleSpec, candidates: Agent[]): MatchResult<Agent> {
  const target = roleCorpus(spec);
  let best: { agent: Agent; score: number } | null = null;
  for (const agent of candidates) {
    const score = overlapScore(target, agentCorpus(agent));
    if (!best || score > best.score) best = { agent, score };
  }
  if (best && best.score >= AGENT_MATCH_THRESHOLD) {
    return { candidate: best.agent, score: best.score };
  }
  return { candidate: null, score: best?.score ?? 0 };
}

/** Sintetiza um novo agente sob medida — só deve ser persistido quando `matchAgent` não encontrar candidato. */
export function synthesizeAgentDraft(spec: RoleSpec): Agent {
  const responsabilidades = spec.responsabilidades ?? [];
  const skills = responsabilidades.map(slugify).filter(Boolean);
  return Agent.parse({
    id: `gerado-${slugify(spec.titulo)}-${Date.now().toString(36)}`,
    nome: `Agente de ${spec.titulo}`,
    area: spec.area,
    descricao:
      responsabilidades.length > 0
        ? `Criado sob medida para apoiar "${spec.titulo}" em: ${responsabilidades.join("; ")}.`
        : `Criado sob medida para apoiar a função de ${spec.titulo}, sem correspondência no catálogo.`,
    skills: skills.length > 0 ? skills : [slugify(spec.titulo)],
    origem: "gerado",
  });
}

function squadCorpus(squad: Pick<Squad, "nome" | "area" | "descricao">): Set<string> {
  return tokenize([squad.nome, squad.area ?? "", squad.descricao].join(" "));
}

/** Busca, entre os squads já cadastrados, um compatível com a área/responsabilidades descritas. */
export function matchSquad(spec: RoleSpec, candidates: Squad[]): MatchResult<Squad> {
  const target = roleCorpus(spec);
  let best: { squad: Squad; score: number } | null = null;
  for (const squad of candidates) {
    const score = overlapScore(target, squadCorpus(squad));
    if (!best || score > best.score) best = { squad, score };
  }
  if (best && best.score >= SQUAD_MATCH_THRESHOLD) {
    return { candidate: best.squad, score: best.score };
  }
  return { candidate: null, score: best?.score ?? 0 };
}

/** Sintetiza um novo squad — mesma convenção de `createSquadTemplate` do so-ia (origem "criado", desempenho inicial 0.75). */
export function synthesizeSquadDraft(spec: RoleSpec): Squad {
  const responsabilidades = spec.responsabilidades ?? [];
  return Squad.parse({
    id: `criado-${slugify(spec.area ?? spec.titulo)}-${Date.now().toString(36)}`,
    nome: `Squad de ${spec.area ?? spec.titulo}`,
    area: spec.area ?? spec.titulo,
    descricao:
      responsabilidades.length > 0
        ? `Criado para cobrir: ${responsabilidades.join("; ")}.`
        : `Criado para a área ${spec.area ?? spec.titulo}.`,
    desempenho: 0.75,
    origem: "criado",
    agentIds: [],
  });
}
