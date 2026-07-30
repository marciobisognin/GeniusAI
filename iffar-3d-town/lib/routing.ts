// Motor de classificação e roteamento institucional, compartilhado entre o
// Nirvana Bridge (nirvana-bridge.ts, que anima a cena 3D) e o motor real de
// geração de conteúdo (tools/real-engine.ts, que gera o artefato de
// verdade). Extraído de nirvana-bridge.ts para não duplicar a lógica entre
// os dois processos — ambos precisam da MESMA cadeia de unidades reais.
import { readFileSync, existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export interface OrgUnit {
  id: string;
  slug: string;
  nome: string;
  parent: string | null;
  cargo?: string;
  funcao?: string;
}

export interface RoutingRule {
  tema: string;
  keywords: string[];
  prioridade: number;
  cadeia_sistemica: string[];
  cadeia_campus: string[];
  base_legal: string[];
  // Temas de alcance institucional (ex.: o PDI) não se referem a UM campus
  // específico no briefing — precisam da contribuição de todos eles. Nesse
  // caso cadeia_campus é resolvida dentro da subárvore de CADA campus, não
  // só do primeiro mencionado no texto.
  broadcast_all_campi?: boolean;
}

export interface RoutingConfig {
  version: number;
  default_route: {
    nome: string;
    cadeia_sistemica: string[];
    base_legal: string[];
  };
  rules: RoutingRule[];
}

export interface Competencia {
  artigo: number;
  unidade_titulo: string;
  slug: string;
  resumo: string;
  total_incisos: number;
}

export interface OrgChartData {
  units: OrgUnit[];
  unitsById: Map<string, OrgUnit>;
  childrenByParent: Map<string, OrgUnit[]>;
  campusUnits: OrgUnit[];
}

// Campi são as unidades de primeiro nível diferentes da Reitoria ("1.1"),
// nunca uma lista hardcoded.
const CAMPUS_ROOT_RE = /^1\.\d+$/;

export function loadOrgChart(orgChartPath: string): OrgChartData {
  const raw = readFileSync(orgChartPath, "utf8");
  const doc = parseYaml(raw) as { units: OrgUnit[] };
  const units = doc.units;
  const unitsById = new Map<string, OrgUnit>(units.map((u) => [u.id, u]));
  const childrenByParent = new Map<string, OrgUnit[]>();
  for (const u of units) {
    if (!u.parent) continue;
    const siblings = childrenByParent.get(u.parent) ?? [];
    siblings.push(u);
    childrenByParent.set(u.parent, siblings);
  }
  const campusUnits = units.filter((u) => CAMPUS_ROOT_RE.test(u.id) && u.id !== "1.1");
  return { units, unitsById, childrenByParent, campusUnits };
}

export function loadRouting(routingPath: string): RoutingConfig {
  const raw = readFileSync(routingPath, "utf8");
  return parseYaml(raw) as RoutingConfig;
}

export function loadCompetencias(competenciasPath: string): Competencia[] | null {
  if (!existsSync(competenciasPath)) return null;
  const raw = readFileSync(competenciasPath, "utf8");
  const doc = parseYaml(raw) as { competencias: Competencia[] };
  return doc.competencias;
}

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectCampus(normalizedProblem: string, campusUnits: OrgUnit[]): OrgUnit | null {
  for (const campus of campusUnits) {
    const campusName = normalize(campus.nome.replace(/^Campus\s+/i, ""));
    if (campusName && normalizedProblem.includes(campusName)) {
      return campus;
    }
  }
  return null;
}

export function classify(
  problem: string,
  routing: RoutingConfig,
  campusUnits: OrgUnit[],
): { rule: RoutingRule | null; campus: OrgUnit | null } {
  const normalized = normalize(problem);
  const campus = detectCampus(normalized, campusUnits);

  let best: RoutingRule | null = null;
  let bestScore = 0;
  for (const rule of routing.rules) {
    const matches = rule.keywords.filter((kw) => normalized.includes(normalize(kw))).length;
    if (matches === 0) continue;
    const score = matches * rule.prioridade;
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }
  return { rule: best, campus };
}

const NAME_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em"]);

function significantWords(nome: string): Set<string> {
  return new Set(
    normalize(nome)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 0 && !NAME_STOPWORDS.has(w)),
  );
}

function findChildByName(
  parentId: string,
  nomeAlvo: string,
  childrenByParent: Map<string, OrgUnit[]>,
): OrgUnit | null {
  const alvo = normalize(nomeAlvo);
  const candidates = childrenByParent.get(parentId) ?? [];

  const exact = candidates.find((c) => normalize(c.nome) === alvo);
  if (exact) return exact;

  // estrutura reduzida (Arts. 114-120): campi menores combinam diretorias/
  // coordenações em uma única unidade com nome composto — um match por
  // substring cobre a maioria dos casos.
  const bySubstring = candidates.find((c) => normalize(c.nome).includes(alvo));
  if (bySubstring) return bySubstring;

  // quando a unidade combinada reordena ou troca palavras, decide por
  // sobreposição de palavras significativas — ainda por lookup no
  // organograma, nunca hardcode.
  const alvoWords = significantWords(nomeAlvo);
  let best: OrgUnit | null = null;
  let bestOverlap = 0;
  for (const c of candidates) {
    const candWords = significantWords(c.nome);
    const overlap = [...alvoWords].filter((w) => candWords.has(w)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = c;
    }
  }
  return bestOverlap > 0 ? best : null;
}

export function resolveCampusChain(
  campus: OrgUnit,
  nomes: string[],
  childrenByParent: Map<string, OrgUnit[]>,
): OrgUnit[] {
  const gabinete = findChildByName(campus.id, "Gabinete do(a) Diretor(a) Geral", childrenByParent);
  const chain: OrgUnit[] = gabinete ? [gabinete] : [];
  let parentId = campus.id;
  for (const nome of nomes) {
    const found = findChildByName(parentId, nome, childrenByParent);
    if (!found) {
      console.warn(
        `[Routing] Aviso: unidade "${nome}" não encontrada em ${campus.nome} (estrutura reduzida?); passo ignorado.`,
      );
      continue;
    }
    chain.push(found);
    parentId = found.id;
  }
  return chain;
}

export interface CampusChain {
  campus: OrgUnit;
  chain: OrgUnit[];
}

export interface ContributionPlan {
  rule: RoutingRule | null;
  nomeRota: string;
  baseLegal: string[];
  reitoria: OrgUnit;
  systemicUnits: OrgUnit[];
  // Um item por campus envolvido: length 1 no roteamento comum (campus
  // detectado no texto), length = todos os campi quando o tema é de
  // alcance institucional (broadcast_all_campi), length 0 quando o tema
  // não tem etapa de campus.
  campusChains: CampusChain[];
}

// Núcleo único de decisão de rota, usado tanto para a animação (buildSequence,
// no bridge) quanto para a geração real de conteúdo (real-engine): qual regra
// bate, e quais unidades de fato participam da cadeia.
export function buildContributionPlan(problem: string, org: OrgChartData, routing: RoutingConfig): ContributionPlan {
  const { rule, campus } = classify(problem, routing, org.campusUnits);
  const cadeiaSistemicaIds = rule?.cadeia_sistemica ?? routing.default_route.cadeia_sistemica;
  const baseLegal = rule?.base_legal ?? routing.default_route.base_legal;
  const nomeRota = rule?.tema ?? routing.default_route.nome;

  const systemicUnits = cadeiaSistemicaIds
    .map((id) => org.unitsById.get(id))
    .filter((u): u is OrgUnit => Boolean(u));

  const reitoria = org.unitsById.get("1.1")!;

  let campusChains: CampusChain[] = [];
  if (rule?.broadcast_all_campi) {
    campusChains = org.campusUnits.map((c) => ({
      campus: c,
      chain: resolveCampusChain(c, rule.cadeia_campus, org.childrenByParent),
    }));
  } else if (campus && rule) {
    campusChains = [{ campus, chain: resolveCampusChain(campus, rule.cadeia_campus, org.childrenByParent) }];
  }

  return { rule, nomeRota, baseLegal, reitoria, systemicUnits, campusChains };
}

export interface HandoffStep {
  from: string;
  to: string;
  action: string;
  base_legal: string[];
  delay: number;
}

// Timeline visual (Reitoria -> sistêmico -> cada campus envolvido -> volta),
// usada só pela animação da cena 3D. O motor real usa buildContributionPlan
// diretamente, sem se importar com o timing dos passos.
export function buildSequence(problem: string, org: OrgChartData, routing: RoutingConfig): HandoffStep[] {
  const plan = buildContributionPlan(problem, org, routing);
  const forward: OrgUnit[] = [
    plan.reitoria,
    ...plan.systemicUnits,
    ...plan.campusChains.flatMap((c) => c.chain),
  ];

  // cadeias mais longas (mais hops entre Reitoria e campus, ou broadcast
  // para os 13 campi) não devem deixar a orquestração inteira mais lenta —
  // o intervalo por passo encolhe conforme a cadeia cresce, mantendo a
  // duração total razoável.
  const totalHops = forward.length - 1 + (forward.length - 1);
  const STEP_DELAY = Math.max(600, Math.min(2600, Math.round(18000 / Math.max(totalHops, 1))));

  const steps: HandoffStep[] = [];
  steps.push({
    from: "user",
    to: plan.reitoria.id,
    action: `Recebendo briefing institucional: "${problem.slice(0, 60)}"`,
    base_legal: [],
    delay: 500,
  });

  for (let i = 0; i + 1 < forward.length; i++) {
    steps.push({
      from: forward[i]!.id,
      to: forward[i + 1]!.id,
      action: `Encaminhamento — ${forward[i + 1]!.nome} (${plan.nomeRota})`,
      base_legal: plan.baseLegal,
      delay: 500 + (i + 1) * STEP_DELAY,
    });
  }

  const backward = [...forward].reverse();
  const baseDelay = 500 + forward.length * STEP_DELAY;
  for (let i = 0; i + 1 < backward.length; i++) {
    steps.push({
      from: backward[i]!.id,
      to: backward[i + 1]!.id,
      action: `Devolução do parecer — ${backward[i]!.nome} (${plan.baseLegal.join("; ")})`,
      base_legal: plan.baseLegal,
      delay: baseDelay + (i + 1) * STEP_DELAY,
    });
  }
  steps.push({
    from: plan.reitoria.id,
    to: "user",
    action: "Artefato final consolidado e disponibilizado",
    base_legal: [],
    delay: baseDelay + backward.length * STEP_DELAY,
  });

  return steps;
}
