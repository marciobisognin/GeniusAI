import type { AuditEvent, Citation } from "./types";

export const notaFiscal = {
  numero: "4471",
  chave: "4326 0714 9821 0003 4471 5500 1000 0044 7115 0022 8814",
  cnpjFornecedor: "12.345.678/0001-90",
  fornecedor: "Distribuidora Farroupilha de Materiais Ltda.",
  emissao: "10/07/2026",
  valorTotal: "R$ 18.420,00",
  empenho: "2026NE000812",
};

export const itensConferencia = [
  { item: "Papel A4 75g (resma)", qtdEmpenho: 200, qtdNf: 200, valorUnit: "R$ 24,90", status: "ok" as const },
  { item: "Toner compatível HP 415A", qtdEmpenho: 18, qtdNf: 18, valorUnit: "R$ 289,00", status: "ok" as const },
  { item: "Envelope ofício (caixa)", qtdEmpenho: 40, qtdNf: 38, valorUnit: "R$ 32,50", status: "divergencia" as const },
];

export const citationsAtesto: Citation[] = [
  {
    fonte: "SIPAC — Liquidação de Despesas",
    referencia: "Empenho 2026NE000812 — Almoxarifado Central",
    acessadoEm: "16/07/2026 09:12",
  },
  {
    fonte: "SICAF",
    referencia: "Regularidade fiscal — CNPJ 12.345.678/0001-90 (situação regular)",
    acessadoEm: "16/07/2026 09:13",
  },
  {
    fonte: "NF-e nº 4471",
    referencia: "Chave de acesso e XML validados junto à SEFAZ",
    acessadoEm: "16/07/2026 09:11",
  },
];

export const auditTrailAtesto: AuditEvent[] = [
  {
    id: "aud-1",
    ator: "Agente de Atesto de Nota Fiscal",
    acao: "ler-nota-fiscal",
    timestamp: "16/07/2026 09:11:04",
    detalhe: "Extraiu CNPJ, itens, valores e chave de acesso da NF-e 4471 via IDP.",
  },
  {
    id: "aud-2",
    ator: "Agente de Atesto de Nota Fiscal",
    acao: "conferir-nf-contra-empenho",
    timestamp: "16/07/2026 09:12:41",
    detalhe: "Comparou itens/quantidades/valores com o empenho 2026NE000812 no SIPAC. 1 divergência encontrada.",
  },
  {
    id: "aud-3",
    ator: "Agente de Atesto de Nota Fiscal",
    acao: "checar-regularidade-fiscal",
    timestamp: "16/07/2026 09:13:02",
    detalhe: "Consultou SICAF — fornecedor com situação regular.",
  },
  {
    id: "aud-4",
    ator: "Agente de Atesto de Nota Fiscal",
    acao: "preparar-atesto",
    timestamp: "16/07/2026 09:14:19",
    detalhe: "Gerou minuta de atesto e relatório de conferência com citações. Encaminhado para revisão humana (A2).",
  },
];
