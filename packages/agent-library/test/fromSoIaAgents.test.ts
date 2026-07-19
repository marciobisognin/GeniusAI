import { describe, expect, it } from "vitest";
import { importSoIaAgents, importSoIaSquads } from "../src/fromSoIaAgents.js";

const AGENTS_FIXTURE = `
import type { Agent } from "./types";

export const agentsEmpresa: Agent[] = [
  {
    id: "agente-qualificacao-leads",
    nome: "Agente de Qualificação de Leads",
    area: "Vendas",
    mode: "empresa",
    autonomia: "A3",
    descricao: "Enriquece, pontua e prioriza leads.",
    skills: ["enriquecer-lead", "pontuar-fit"],
    connectors: ["mcp-hubspot"],
    modelPolicy: { default: "claude-sonnet" },
    execucoesMes: 1284,
    taxaAprovacao: 0.94,
    status: "ativo",
  },
];

export const agentsGoverno: Agent[] = [
  {
    id: "agente-atesto-nf",
    nome: "Agente de Atesto de Nota Fiscal",
    area: "Orçamento e Finanças",
    mode: "governo",
    autonomia: "A2",
    descricao: "Confere NF contra empenho.",
    skills: ["ler-nota-fiscal", "conferir-nf-contra-empenho"],
    connectors: ["mcp-sipac"],
    modelPolicy: { default: "claude-sonnet", sensitive: "llama-3-70b-onprem" },
    execucoesMes: 213,
    taxaAprovacao: 0.95,
    status: "ativo",
  },
];
`;

const SQUADS_FIXTURE = `
import { slugify } from "@/lib/data/org-chart";

export const institutionalSquads = [
  {
    id: "tpl-fundacao",
    nome: "Squad de Fundação",
    area: "Meta",
    areaKeywords: ["fundacao"],
    descricao: "Squad meta.",
    desempenho: 0.98,
    origem: "institucional",
  },
  {
    id: "tpl-licitacoes",
    nome: "Squad de Licitações e Contratos",
    area: "Licitações e Contratos",
    areaKeywords: ["licitacao"],
    descricao: "Instrução de contratações.",
    desempenho: 0.94,
    origem: "institucional",
  },
];
`;

describe("importSoIaAgents — sem executar agents.ts", () => {
  it("junta agentsEmpresa e agentsGoverno, mapeados para o canon", () => {
    const agents = importSoIaAgents(AGENTS_FIXTURE);
    expect(agents).toHaveLength(2);
    expect(agents[0]).toMatchObject({
      id: "agente-qualificacao-leads",
      nome: "Agente de Qualificação de Leads",
      area: "Vendas",
      autonomia: "A3",
      origem: "importado",
      origemDetalhe: "so-ia/src/lib/data/agents.ts",
    });
    expect(agents[0].modelPolicy).toEqual({ default: "claude-sonnet" });
  });

  it("mapeia modelPolicy.sensitive para o campo fallback do canon", () => {
    const agents = importSoIaAgents(AGENTS_FIXTURE);
    const atesto = agents.find((a) => a.id === "agente-atesto-nf");
    expect(atesto?.modelPolicy).toEqual({ default: "claude-sonnet", fallback: "llama-3-70b-onprem" });
  });
});

describe("importSoIaSquads — ignora o import de @/lib/data/org-chart", () => {
  it("extrai os squads institucionais mapeados para o canon", () => {
    const squads = importSoIaSquads(SQUADS_FIXTURE);
    expect(squads).toHaveLength(2);
    expect(squads[0]).toMatchObject({
      id: "tpl-fundacao",
      nome: "Squad de Fundação",
      origem: "importado",
      origemDetalhe: "so-ia/src/lib/org/squad-registry.ts",
    });
    expect(squads[0].desempenho).toBe(0.98);
  });
});
