import { slugify } from "@/lib/data/org-chart";

/**
 * Repositório institucional de squads — análogo ao catálogo de agentes.
 * Quando o organograma é montado, cada área primeiro procura aqui um squad
 * compatível; só se nada servir a Ferramenta de Criação de Squads é acionada,
 * operada pelo squad de melhor desempenho do repositório.
 */
export interface SquadTemplate {
  id: string;
  nome: string;
  area: string;
  areaKeywords: string[];
  descricao: string;
  desempenho: number; // 0..1 — histórico de qualidade do squad
  origem: "institucional" | "criado";
  criadoPor?: string;
  criadoEm?: string;
}

export const institutionalSquads: SquadTemplate[] = [
  {
    id: "tpl-fundacao",
    nome: "Squad de Fundação",
    area: "Meta",
    areaKeywords: ["fundacao", "criacao", "bootstrap"],
    descricao:
      "Squad meta: especializado em desenhar e criar novos squads a partir das funções e responsabilidades de uma área. É acionado pela Ferramenta de Criação de Squads.",
    desempenho: 0.98,
    origem: "institucional",
  },
  {
    id: "tpl-licitacoes",
    nome: "Squad de Licitações e Contratos",
    area: "Licitações e Contratos",
    areaKeywords: ["licitacao", "licitacoes", "contratos", "compras", "pregao", "contratacao"],
    descricao: "Instrução de contratações, pesquisa de preços, vigências e aditivos sob a Lei 14.133/2021.",
    desempenho: 0.94,
    origem: "institucional",
  },
  {
    id: "tpl-financas",
    nome: "Squad de Orçamento e Finanças",
    area: "Orçamento e Finanças",
    areaKeywords: ["orcamento", "financas", "financeiro", "empenho", "liquidacao", "atesto", "pagamento"],
    descricao: "Atesto de notas fiscais, conciliação e execução orçamentária/financeira.",
    desempenho: 0.93,
    origem: "institucional",
  },
  {
    id: "tpl-governanca",
    nome: "Squad de Governança",
    area: "Gabinete/Governança",
    areaKeywords: ["gabinete", "governanca", "auditoria", "controle", "conformidade", "direcao"],
    descricao: "Conformidade documental, controle interno, despachos e indicadores.",
    desempenho: 0.91,
    origem: "institucional",
  },
  {
    id: "tpl-comunicacao",
    nome: "Squad de Comunicação",
    area: "Comunicação",
    areaKeywords: ["comunicacao", "lai", "transparencia", "imprensa", "marketing"],
    descricao: "Atendimento LAI, notas públicas e conteúdo institucional/de marca.",
    desempenho: 0.9,
    origem: "institucional",
  },
  {
    id: "tpl-comercial",
    nome: "Squad Comercial",
    area: "Vendas",
    areaKeywords: ["vendas", "comercial", "negocios", "leads", "propostas", "crm"],
    descricao: "Qualificação de leads, preparação de propostas e apoio à negociação.",
    desempenho: 0.92,
    origem: "institucional",
  },
  {
    id: "tpl-clientes",
    nome: "Squad de Clientes",
    area: "Clientes",
    areaKeywords: ["clientes", "atendimento", "suporte", "tickets", "sucesso"],
    descricao: "Triagem e resposta de tickets com citação da base de conhecimento.",
    desempenho: 0.9,
    origem: "institucional",
  },
];

const STORAGE_KEY = "so-ia:squad-repository";

function loadCreated(): SquadTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SquadTemplate[]) : [];
  } catch {
    return [];
  }
}

function saveCreated(created: SquadTemplate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
}

export function loadRepository(): SquadTemplate[] {
  return [...institutionalSquads, ...loadCreated()];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );
}

/** Procura no repositório um squad compatível com a área informada. */
export function findSquadTemplate(
  area: string,
  repo: SquadTemplate[] = loadRepository(),
): SquadTemplate | null {
  const areaTokens = tokenize(area);
  let best: { tpl: SquadTemplate; score: number } | null = null;

  for (const tpl of repo) {
    if (tpl.id === "tpl-fundacao") continue; // o squad meta nunca é atribuído a uma área
    const tplTokens = new Set([...tokenize(tpl.area), ...tpl.areaKeywords.flatMap((k) => [...tokenize(k)])]);
    let shared = 0;
    for (const t of areaTokens) if (tplTokens.has(t)) shared += 1;
    const score = shared / (Math.min(areaTokens.size, tplTokens.size) || 1);
    if (!best || score > best.score) best = { tpl, score };
  }

  return best && best.score >= 0.5 ? best.tpl : null;
}

/** O squad de melhor desempenho do repositório — quem opera a ferramenta de criação. */
export function bestBuilderSquad(repo: SquadTemplate[] = loadRepository()): SquadTemplate {
  return repo.reduce((top, tpl) => (tpl.desempenho > top.desempenho ? tpl : top), repo[0]);
}

/**
 * Ferramenta de Criação de Squads: sintetiza um novo template para a área,
 * assinado pelo squad construtor, e o registra no repositório (salvo se dryRun).
 */
export function createSquadTemplate(
  area: string,
  responsabilidades: string[],
  { dryRun = false }: { dryRun?: boolean } = {},
): SquadTemplate {
  const builder = bestBuilderSquad();
  const tpl: SquadTemplate = {
    id: `tpl-criado-${slugify(area)}`,
    nome: `Squad de ${area}`,
    area,
    areaKeywords: [slugify(area), ...responsabilidades.map((r) => slugify(r))].filter(Boolean),
    descricao:
      responsabilidades.length > 0
        ? `Criado pela Ferramenta de Criação de Squads para cobrir: ${responsabilidades.join("; ")}.`
        : `Criado pela Ferramenta de Criação de Squads para a área ${area}.`,
    desempenho: 0.75,
    origem: "criado",
    criadoPor: builder.nome,
    criadoEm: new Date().toISOString(),
  };

  if (!dryRun) {
    const created = loadCreated();
    if (!created.some((c) => c.id === tpl.id)) {
      saveCreated([...created, tpl]);
    }
  }

  return tpl;
}
