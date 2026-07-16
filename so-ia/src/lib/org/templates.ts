import type { OrgNode } from "@/lib/data/org-chart";

export const templateEmpresa: OrgNode[] = [
  {
    id: "t-e-ceo",
    titulo: "Diretor(a) de Operações",
    area: "Direção",
    responsabilidades: ["visibilidade de processos", "automação sem novas contratações"],
    parentId: null,
  },
  {
    id: "t-e-vendas",
    titulo: "Head de Vendas",
    area: "Vendas",
    responsabilidades: ["qualificar leads", "preparar propostas comerciais"],
    parentId: "t-e-ceo",
  },
  {
    id: "t-e-marketing",
    titulo: "Analista de Marketing",
    area: "Marketing",
    responsabilidades: ["gerar conteudo de marca", "revisar tom de voz"],
    parentId: "t-e-ceo",
  },
  {
    id: "t-e-ti",
    titulo: "Gestor(a) de TI e Dados",
    area: "Operações",
    responsabilidades: ["governanca e seguranca", "integracao sem lock-in"],
    parentId: "t-e-ceo",
  },
  {
    id: "t-e-atendimento",
    titulo: "Coordenador(a) de Atendimento",
    area: "Clientes",
    responsabilidades: ["triagem de tickets", "resposta com base de conhecimento"],
    parentId: "t-e-ceo",
  },
  {
    id: "t-e-financeiro",
    titulo: "Analista Financeiro",
    area: "Back Office",
    responsabilidades: ["conciliar lancamentos", "sinalizar divergencias"],
    parentId: "t-e-ceo",
  },
];

export const templateGoverno: OrgNode[] = [
  {
    id: "t-g-diretor",
    titulo: "Diretor(a) de Administração",
    area: "Gabinete/Governança",
    responsabilidades: ["controle interno", "despachos e indicadores"],
    parentId: null,
  },
  {
    id: "t-g-pregoeiro",
    titulo: "Pregoeiro / Agente de Contratação",
    area: "Licitações e Contratos",
    responsabilidades: ["instruir processo de contratacao", "checar conformidade com a lei 14133"],
    parentId: "t-g-diretor",
  },
  {
    id: "t-g-fiscal",
    titulo: "Fiscal de Contrato",
    area: "Orçamento e Finanças",
    responsabilidades: ["conferir nota fiscal contra empenho", "alertar vigencias contratuais"],
    parentId: "t-g-diretor",
  },
  {
    id: "t-g-gestor-contratos",
    titulo: "Gestor(a) de Contratos",
    area: "Licitações e Contratos",
    responsabilidades: ["controlar aditivos e prazos", "monitorar saldo de empenho"],
    parentId: "t-g-diretor",
  },
  {
    id: "t-g-auditor",
    titulo: "Auditor(a) Interno",
    area: "Gabinete/Governança",
    responsabilidades: ["verificar instrucao processual", "checar segregacao de funcoes"],
    parentId: "t-g-diretor",
  },
  {
    id: "t-g-comunicacao",
    titulo: "Analista de Comunicação",
    area: "Comunicação",
    responsabilidades: ["responder pedidos de acesso a informacao", "checar sigilo e lgpd"],
    parentId: "t-g-diretor",
  },
];
