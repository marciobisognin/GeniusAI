import type { ActivityItem, KpiCard } from "./types";

export interface SeriesPoint {
  label: string;
  execucoes: number;
  aprovadas: number;
}

const days = ["01/07", "03/07", "05/07", "07/07", "09/07", "11/07", "13/07", "15/07"];

export const executionsSeriesEmpresa: SeriesPoint[] = days.map((label, i) => ({
  label,
  execucoes: Math.round(480 + i * 62 + Math.sin(i) * 40),
  aprovadas: Math.round(430 + i * 58 + Math.cos(i) * 30),
}));

export const executionsSeriesGoverno: SeriesPoint[] = days.map((label, i) => ({
  label,
  execucoes: Math.round(28 + i * 4.4 + Math.sin(i + 1) * 3),
  aprovadas: Math.round(24 + i * 4.1 + Math.cos(i + 1) * 2),
}));

export interface VigenciaAlerta {
  contrato: string;
  objeto: string;
  vencimento: string;
  dias: number;
  urgencia: "alto" | "medio" | "baixo";
}

export const vigenciasGoverno: VigenciaAlerta[] = [
  { contrato: "018/2025", objeto: "Vigilância patrimonial", vencimento: "14/10/2026", dias: 90, urgencia: "alto" },
  { contrato: "004/2026", objeto: "Fornecimento de reagentes", vencimento: "02/11/2026", dias: 109, urgencia: "medio" },
  { contrato: "031/2024", objeto: "Manutenção predial", vencimento: "22/12/2026", dias: 159, urgencia: "baixo" },
];

export const kpisEmpresa: KpiCard[] = [
  { label: "Execuções no mês", value: "5.392", delta: "+18%", trend: "up" },
  {
    label: "Tempo economizado",
    value: "612 h",
    delta: "+9%",
    trend: "up",
    hint: "estimativa vs. baseline manual",
  },
  { label: "Taxa de aprovação humana", value: "93%", delta: "+2 pp", trend: "up" },
  { label: "Custo por execução", value: "R$ 0,38", delta: "-6%", trend: "down" },
];

export const kpisGoverno: KpiCard[] = [
  {
    label: "Ações com trilha append-only",
    value: "100%",
    delta: "estável",
    trend: "flat",
    hint: "obrigatório — RNF-01",
  },
  {
    label: "Pesquisas de preço instruídas",
    value: "51",
    delta: "+14%",
    trend: "up",
  },
  {
    label: "Tempo médio de atesto",
    value: "38 min",
    delta: "-42%",
    trend: "down",
    hint: "vs. baseline manual do piloto",
  },
  {
    label: "Contratos com vigência monitorada",
    value: "27/27",
    delta: "100%",
    trend: "flat",
  },
];

export const activityEmpresa: ActivityItem[] = [
  {
    id: "act-1",
    agente: "Agente de Qualificação de Leads",
    acao: "Pontuou 24 novos leads do formulário de site",
    area: "Vendas",
    timestamp: "há 6 min",
    status: "concluido",
  },
  {
    id: "act-2",
    agente: "Agente de Conteúdo de Marca",
    acao: "Preparou 3 variações de post para campanha Q3",
    area: "Marketing",
    timestamp: "há 22 min",
    status: "aguardando",
  },
  {
    id: "act-3",
    agente: "Agente de Triagem de Tickets",
    acao: "Respondeu 12 tickets com citação da base de conhecimento",
    area: "Clientes",
    timestamp: "há 41 min",
    status: "concluido",
  },
  {
    id: "act-4",
    agente: "Agente de Back Office Financeiro",
    acao: "Sinalizou divergência em 2 lançamentos de setembro",
    area: "Back Office",
    timestamp: "há 1 h",
    status: "alerta",
  },
];

export const activityGoverno: ActivityItem[] = [
  {
    id: "gact-1",
    agente: "Agente de Atesto de Nota Fiscal",
    acao: "Preparou minuta de atesto — NF 4471 (Almoxarifado)",
    area: "Orçamento e Finanças",
    timestamp: "há 12 min",
    status: "aguardando",
  },
  {
    id: "gact-2",
    agente: "Agente de Vigência Contratual",
    acao: "Alerta D-90: Contrato 018/2025 (vigilância patrimonial)",
    area: "Licitações e Contratos",
    timestamp: "há 34 min",
    status: "alerta",
  },
  {
    id: "gact-3",
    agente: "Agente de Pesquisa de Preços",
    acao: "Concluiu pesquisa de preços — material de laboratório",
    area: "Licitações e Contratos",
    timestamp: "há 55 min",
    status: "concluido",
  },
  {
    id: "gact-4",
    agente: "Agente de Conformidade Documental",
    acao: "Mapeou 1 pendência no processo 23345.000512/2026-10",
    area: "Gabinete/Governança",
    timestamp: "há 2 h",
    status: "alerta",
  },
];
