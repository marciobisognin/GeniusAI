import type { WorkflowStep } from "./types";

export const workflowPesquisaPrecos: WorkflowStep[] = [
  {
    id: "trigger",
    tipo: "trigger",
    label: "Solicitação de instrução processual",
    descricao: "Pregoeiro abre processo de contratação e solicita pesquisa de preços.",
  },
  {
    id: "s1",
    tipo: "agent",
    label: "consultar-painel-precos",
    agente: "Agente de Pesquisa de Preços",
    autonomia: "A2",
    descricao: "Busca preços no Painel de Preços (Compras.gov.br) por CATMAT/CATSER.",
  },
  {
    id: "s2",
    tipo: "agent",
    label: "consultar-pncp-precos",
    agente: "Agente de Pesquisa de Preços",
    autonomia: "A2",
    descricao: "Busca contratações similares e atas de registro de preços no PNCP (≤12 meses).",
  },
  {
    id: "s3",
    tipo: "agent",
    label: "cotar-fornecedores",
    agente: "Agente de Pesquisa de Preços",
    autonomia: "A2",
    descricao: "Cota ≥3 fornecedores complementares, com justificativa de escolha.",
  },
  {
    id: "s4",
    tipo: "agent",
    label: "calcular-preco-estimado",
    agente: "Agente de Pesquisa de Preços",
    autonomia: "A2",
    descricao: "Calcula média/mediana, descarta outliers e gera memória de cálculo.",
  },
  {
    id: "gate",
    tipo: "human_approval",
    label: "Validação humana — segregação de funções",
    regra: "aprovador ≠ autor do ETP",
    descricao:
      "Agente de contratação valida o relatório (Acórdão TCU nº 1668/2021 — o mesmo agente não pode elaborar e aprovar o mesmo ato).",
  },
];

export const workflowComplianceRefs = [
  "Lei 14.133/2021, art. 23",
  "IN SEGES/ME nº 65/2021",
  "Acórdão TCU nº 1668/2021 — Plenário",
];

export const workflowLeadParaProposta: WorkflowStep[] = [
  {
    id: "trigger",
    tipo: "trigger",
    label: "Novo lead qualificado no CRM",
    descricao: "Lead atinge score de fit mínimo e entra no funil de proposta.",
  },
  {
    id: "s1",
    tipo: "agent",
    label: "enriquecer-lead",
    agente: "Agente de Qualificação de Leads",
    autonomia: "A3",
    descricao: "Enriquece dados do lead com fontes públicas e histórico de CRM.",
  },
  {
    id: "s2",
    tipo: "agent",
    label: "montar-proposta",
    agente: "Agente de Preparação de Propostas",
    autonomia: "A2",
    descricao: "Monta a minuta de proposta comercial a partir do briefing.",
  },
  {
    id: "s3",
    tipo: "agent",
    label: "calcular-precificacao",
    agente: "Agente de Preparação de Propostas",
    autonomia: "A2",
    descricao: "Aplica a tabela de preços vigente e alçada de desconto.",
  },
  {
    id: "gate",
    tipo: "human_approval",
    label: "Aprovação comercial",
    regra: "aprovador = gestor de vendas",
    descricao: "Gestor de vendas revisa e aprova a proposta antes do envio ao cliente.",
  },
];

export const workflowComplianceRefsEmpresa = [
  "Alçada comercial vigente",
  "Guia de marca v3",
];
