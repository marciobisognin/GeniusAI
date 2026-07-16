import type { ApprovalItem } from "./types";

export const approvalsGoverno: ApprovalItem[] = [
  {
    id: "apr-nf-4471",
    titulo: "Atesto de Nota Fiscal — NF 4471",
    tipo: "Atesto de NF",
    agente: "Agente de Atesto de Nota Fiscal",
    autonomia: "A2",
    area: "Orçamento e Finanças",
    criadoEm: "16/07/2026 09:14",
    sla: "vence em 3 dias",
    resumo:
      "Itens e valores conferem com o empenho 2026NE000812. Regularidade fiscal do fornecedor OK no SICAF. Sem divergências.",
    valor: "R$ 18.420,00",
    risco: "baixo",
    citations: [
      {
        fonte: "SIPAC — Liquidação de Despesas",
        referencia: "Empenho 2026NE000812",
        acessadoEm: "16/07/2026 09:12",
      },
      {
        fonte: "SICAF",
        referencia: "Regularidade fiscal — CNPJ 12.345.678/0001-90",
        acessadoEm: "16/07/2026 09:13",
      },
    ],
  },
  {
    id: "apr-aditivo-018",
    titulo: "Minuta de Termo Aditivo — Contrato 018/2025",
    tipo: "Aditivo Contratual",
    agente: "Agente de Vigência Contratual",
    autonomia: "A2",
    area: "Licitações e Contratos",
    criadoEm: "16/07/2026 08:02",
    sla: "vigência encerra em 90 dias",
    resumo:
      "Vigência atual encerra em 14/10/2026. Saldo de empenho suficiente para prorrogação de 12 meses. Minuta preparada para revisão do gestor de contratos.",
    valor: "R$ 214.900,00/ano",
    risco: "medio",
    citations: [
      {
        fonte: "Comprasnet Contratos",
        referencia: "Contrato 018/2025 — Vigilância Patrimonial",
        acessadoEm: "16/07/2026 07:58",
      },
      {
        fonte: "SIPAC — Execução Orçamentária",
        referencia: "Saldo de empenho 2026NE000455",
        acessadoEm: "16/07/2026 07:59",
      },
    ],
  },
  {
    id: "apr-pesquisa-lab",
    titulo: "Pesquisa de Preços — Material de Laboratório",
    tipo: "Pesquisa de Preços",
    agente: "Agente de Pesquisa de Preços",
    autonomia: "A2",
    area: "Licitações e Contratos",
    criadoEm: "16/07/2026 07:30",
    sla: "vence em 5 dias",
    resumo:
      "Metodologia: média de 4 fontes (Painel de Preços + 3 contratações similares no PNCP), outliers descartados por IQR. Memória de cálculo anexada.",
    valor: "Preço estimado: R$ 47.230,18",
    risco: "baixo",
    citations: [
      {
        fonte: "Painel de Preços — paineldeprecos.planejamento.gov.br",
        referencia: "CATMAT 412987 — reagentes de laboratório",
        acessadoEm: "16/07/2026 07:20",
      },
      {
        fonte: "PNCP",
        referencia: "3 contratações similares (≤12 meses)",
        acessadoEm: "16/07/2026 07:24",
      },
    ],
  },
  {
    id: "apr-lai-2231",
    titulo: "Resposta a Pedido LAI nº 2231/2026",
    tipo: "Atendimento LAI",
    agente: "Agente de Atendimento LAI",
    autonomia: "A2",
    area: "Comunicação",
    criadoEm: "15/07/2026 16:44",
    sla: "vence em 12 dias (Lei 12.527/2011)",
    resumo:
      "Pedido sobre execução orçamentária do campus. Resposta redigida com dados públicos do SIPAC; nenhum dado pessoal identificado — sigilo checado.",
    risco: "baixo",
    citations: [
      {
        fonte: "SIPAC — Execução Orçamentária (dados públicos)",
        referencia: "Exercício 2026",
        acessadoEm: "15/07/2026 16:40",
      },
    ],
  },
];

export const approvalsEmpresa: ApprovalItem[] = [
  {
    id: "apr-proposta-acme",
    titulo: "Proposta Comercial — Cliente ACME Distribuidora",
    tipo: "Proposta Comercial",
    agente: "Agente de Preparação de Propostas",
    autonomia: "A2",
    area: "Negócios",
    criadoEm: "16/07/2026 10:05",
    sla: "cliente aguarda resposta hoje",
    resumo:
      "Proposta montada a partir do briefing de 12/07. Precificação segue tabela vigente com desconto de 8% (dentro da alçada padrão).",
    valor: "R$ 62.400,00",
    risco: "baixo",
    citations: [
      {
        fonte: "CRM — HubSpot",
        referencia: "Negociação #4821",
        acessadoEm: "16/07/2026 10:00",
      },
    ],
  },
  {
    id: "apr-conteudo-q3",
    titulo: "Conteúdo de Campanha Q3 — 3 variações",
    tipo: "Conteúdo de Marketing",
    agente: "Agente de Conteúdo de Marca",
    autonomia: "A2",
    area: "Marketing",
    criadoEm: "16/07/2026 09:40",
    sla: "publicação prevista para amanhã",
    resumo:
      "Variações ancoradas no guia de marca v3. Tom de voz validado; falta aprovação final do time de marketing.",
    risco: "baixo",
    citations: [
      {
        fonte: "Google Drive — Guia de Marca v3",
        referencia: "Seção 4 — Tom de voz",
        acessadoEm: "16/07/2026 09:35",
      },
    ],
  },
];

export function getApprovals(mode: "empresa" | "governo") {
  return mode === "empresa" ? approvalsEmpresa : approvalsGoverno;
}
