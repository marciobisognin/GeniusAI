import { agentsEmpresa, agentsGoverno } from "@/lib/data/agents";
import type { Agent, AutonomyLevel } from "@/lib/data/types";
import type { OrgNode } from "@/lib/data/org-chart";
import { slugify } from "@/lib/data/org-chart";
import { ensureSkill } from "@/lib/org/skills-registry";

const STOPWORDS = new Set([
  "de","da","do","das","dos","e","a","o","as","os","para","com","em","no","na",
  "nos","nas","um","uma","que","por","ao","aos","à","às","sobre","entre","seu",
  "sua","seus","suas","ou","se","é","ser","dos/das","gestao","gestão",
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

function agentCorpus(agent: Agent): Set<string> {
  return tokenize(
    [agent.nome, agent.descricao, agent.area, ...agent.skills.map((s) => s.replace(/-/g, " "))].join(" "),
  );
}

function nodeCorpus(node: OrgNode): Set<string> {
  return tokenize([node.titulo, node.area, ...node.responsabilidades].join(" "));
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  const denom = Math.min(a.size, b.size) || 1;
  return shared / denom;
}

export const institutionalCatalog: Agent[] = [...agentsEmpresa, ...agentsGoverno];

export type AgentOrigin = "catalogo" | "gerado";

export interface AgentAssignment {
  nodeId: string;
  node: OrgNode;
  agent: Agent;
  origem: AgentOrigin;
  score: number;
}

const MATCH_THRESHOLD = 0.34;

function synthesizeAgent(node: OrgNode): Agent {
  const skills = node.responsabilidades.map((r) => slugify(r)).filter(Boolean);
  skills.forEach((skill, i) => {
    ensureSkill(skill, `${node.responsabilidades[i]} (gerada a partir da função "${node.titulo}").`);
  });

  const autonomia: AutonomyLevel = "A2";

  return {
    id: `gerado-${node.id}`,
    nome: `Agente de ${node.titulo}`,
    area: node.area || "Geral",
    mode: "empresa",
    autonomia,
    descricao:
      node.responsabilidades.length > 0
        ? `Criado sob medida para apoiar "${node.titulo}" em: ${node.responsabilidades.join("; ")}.`
        : `Criado sob medida para apoiar a função de ${node.titulo}, sem correspondência no catálogo institucional.`,
    skills: skills.length > 0 ? skills : [slugify(node.titulo)],
    connectors: [],
    modelPolicy: { default: "claude-sonnet" },
    execucoesMes: 0,
    taxaAprovacao: 1,
    status: "ativo",
  };
}

export function matchNode(node: OrgNode, catalog: Agent[] = institutionalCatalog): AgentAssignment {
  const corpus = nodeCorpus(node);
  let best: { agent: Agent; score: number } | null = null;

  for (const agent of catalog) {
    const score = overlapScore(corpus, agentCorpus(agent));
    if (!best || score > best.score) best = { agent, score };
  }

  if (best && best.score >= MATCH_THRESHOLD) {
    return { nodeId: node.id, node, agent: best.agent, origem: "catalogo", score: best.score };
  }

  return {
    nodeId: node.id,
    node,
    agent: synthesizeAgent(node),
    origem: "gerado",
    score: best?.score ?? 0,
  };
}

export function assembleOrganization(nodes: OrgNode[]): AgentAssignment[] {
  return nodes.filter((n) => n.titulo.trim().length > 0).map((n) => matchNode(n));
}
