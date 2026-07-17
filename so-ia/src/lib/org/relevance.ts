import type { OrgNode } from "@/lib/data/org-chart";

// Decide se um conteúdo institucional (item de aprovação, KPI, widget,
// fonte de conhecimento, workflow de exemplo) faz sentido para o organograma
// carregado. A regra do produto: se o organograma não tem uma área (contábil,
// contratos, marketing…), nada daquela área deve existir no sistema.

const STOPWORDS = new Set([
  "de","da","do","das","dos","e","a","o","as","os","para","com","em","no","na",
  "nos","nas","um","uma","que","por","ao","aos","à","às","sobre","entre","seu",
  "sua","seus","suas","ou","se","é","ser","sem","ok","agente","agentes",
]);

function tokenize(text: string): Set<string> {
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ");
  return new Set(
    normalized
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

// Cobre variações morfológicas do português (contrato/contratos/contratual,
// redigir/redigida) sem stemming completo: prefixo comum de 5+ caracteres.
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  return a.slice(0, 5) === b.slice(0, 5);
}

function coverage(topic: Set<string>, corpus: Set<string>): number {
  if (topic.size === 0) return 0;
  let matched = 0;
  for (const t of topic) {
    for (const c of corpus) {
      if (tokensMatch(t, c)) {
        matched += 1;
        break;
      }
    }
  }
  return matched / topic.size;
}

export interface CoverageTopic {
  /** Área institucional do conteúdo (ex.: "Licitações e Contratos"). */
  area: string;
  /** Texto livre do conteúdo (título, agente, resumo…). */
  texto?: string;
}

const AREA_THRESHOLD = 0.5;
const TEXT_THRESHOLD = 0.3;

/**
 * Verdadeiro quando o organograma tem uma área equivalente à do conteúdo,
 * ou quando as responsabilidades cadastradas cobrem o assunto do conteúdo.
 */
export function organizationCovers(topic: CoverageTopic, nodes: OrgNode[]): boolean {
  if (nodes.length === 0) return false;

  const areaTokens = tokenize(topic.area);
  if (areaTokens.size > 0) {
    for (const node of nodes) {
      if (coverage(areaTokens, tokenize(node.area)) >= AREA_THRESHOLD) return true;
    }
  }

  if (!topic.texto) return false;
  const corpus = tokenize(
    nodes.map((n) => [n.titulo, n.area, ...n.responsabilidades].join(" ")).join(" "),
  );
  return coverage(tokenize(topic.texto), corpus) >= TEXT_THRESHOLD;
}
