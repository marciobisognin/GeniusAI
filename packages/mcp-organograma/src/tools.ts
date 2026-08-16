import { z } from "zod";
import {
  assembleOrganization,
  buildOrgWorkflow,
  buildSquads,
  createSquadTemplate,
  findSquadTemplate,
  loadRepository,
  matchNode,
  organizationCovers,
  parseOrgFile,
  parseOrgPasted,
  parseOrgText,
  templateEmpresa,
  templateGoverno,
  type OrgNode,
} from "@genius/org-compiler";

/**
 * As ferramentas do servidor MCP do organograma.
 *
 * Ficam separadas do transporte (`server.ts`) de propósito: assim os testes
 * exercitam a lógica sem levantar processo nem falar JSON-RPC, e o mesmo
 * conjunto pode ser servido por outro transporte no futuro.
 */

const OrgNodeSchema = z.object({
  id: z.string().min(1),
  titulo: z.string(),
  area: z.string(),
  responsabilidades: z.array(z.string()).default([]),
  parentId: z.string().nullable().default(null),
});

const NodesInput = {
  nodes: z.array(OrgNodeSchema).describe(
    "O organograma carregado: uma lista de unidades com id, título, área, responsabilidades e parentId.",
  ),
};

export type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export interface OrgTool {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (args: Record<string, unknown>) => unknown;
}

function asNodes(value: unknown): OrgNode[] {
  return z.array(OrgNodeSchema).parse(value) as OrgNode[];
}

export const ORG_TOOLS: OrgTool[] = [
  {
    name: "org_import",
    title: "Importar organograma",
    description:
      "Lê um organograma a partir de texto livre, colagem de planilha ou conteúdo de arquivo (CSV/TXT/Markdown) " +
      "e devolve as unidades normalizadas, mais os avisos do parser (por exemplo, quando não há hierarquia detectável). " +
      "Use antes de qualquer outra ferramenta: todas as demais precisam do organograma como entrada.",
    inputSchema: {
      content: z.string().describe("O conteúdo bruto do organograma."),
      filename: z
        .string()
        .optional()
        .describe("Nome do arquivo de origem, quando houver — decide o parser (ex.: 'org.csv')."),
      pasted: z
        .boolean()
        .optional()
        .describe("Verdadeiro quando o conteúdo veio de uma colagem de planilha."),
    },
    handler: (args) => {
      const content = z.string().parse(args.content);
      if (typeof args.filename === "string" && args.filename) {
        return parseOrgFile(args.filename, content);
      }
      return args.pasted ? parseOrgPasted(content) : parseOrgText(content);
    },
  },

  {
    name: "org_covers",
    title: "Verificar cobertura (Lei 1)",
    description:
      "O guarda da Lei 1 do produto: 'nada existe sem o organograma'. Responde se um conteúdo, ferramenta, " +
      "KPI ou tarefa de uma determinada área faz sentido para o organograma carregado. " +
      "CHAME ANTES de oferecer, criar ou executar qualquer coisa ligada a uma área institucional: " +
      "se a resposta for coberto=false, aquela área NÃO existe nesta organização e nada dela deve ser oferecido.",
    inputSchema: {
      area: z.string().describe("Área institucional do conteúdo (ex.: 'Licitações e Contratos')."),
      texto: z
        .string()
        .optional()
        .describe("Texto livre do conteúdo — título, descrição, resumo da tarefa."),
      ...NodesInput,
    },
    handler: (args) => {
      const area = z.string().parse(args.area);
      const texto = typeof args.texto === "string" ? args.texto : undefined;
      const nodes = asNodes(args.nodes);
      const coberto = organizationCovers({ area, texto }, nodes);
      return {
        coberto,
        area,
        justificativa: coberto
          ? "o organograma carregado tem uma área equivalente, ou responsabilidades que cobrem o assunto"
          : nodes.length === 0
            ? "nenhum organograma carregado — sem organograma, nada é coberto"
            : "nenhuma unidade do organograma cobre esta área nem este assunto",
        unidades: nodes.length,
      };
    },
  },

  {
    name: "org_match",
    title: "Reaproveitar ou criar agente",
    description:
      "Para uma unidade do organograma, decide entre reaproveitar um agente do catálogo institucional " +
      "ou propor um agente novo. Devolve o agente escolhido, a origem ('catalogo' ou 'gerado') e as skills. " +
      "Reaproveitar é sempre preferível a criar.",
    inputSchema: { node: OrgNodeSchema.describe("A unidade a resolver.") },
    handler: (args) => matchNode(OrgNodeSchema.parse(args.node) as OrgNode),
  },

  {
    name: "org_assemble",
    title: "Montar a organização inteira",
    description:
      "Resolve o organograma inteiro de uma vez: para cada unidade, o agente reaproveitado ou gerado. " +
      "Use para responder 'como esta organização fica montada?' sem chamar org_match unidade a unidade.",
    inputSchema: { ...NodesInput },
    handler: (args) => assembleOrganization(asNodes(args.nodes)),
  },

  {
    name: "org_build_squad",
    title: "Montar squads",
    description:
      "Monta os squads por área a partir do organograma, reaproveitando templates do repositório institucional " +
      "quando existe um compatível. Devolve também qual template foi reaproveitado em cada caso.",
    inputSchema: { ...NodesInput },
    handler: (args) => {
      const nodes = asNodes(args.nodes);
      return {
        squads: buildSquads(assembleOrganization(nodes)),
        repositorio: loadRepository().map(({ id, nome, area, origem, desempenho }) => ({
          id,
          nome,
          area,
          origem,
          desempenho,
        })),
      };
    },
  },

  {
    name: "org_find_squad",
    title: "Procurar squad para uma área",
    description:
      "Procura no repositório um template de squad compatível com a área informada. " +
      "Devolve null quando não há compatível — e nesse caso a criação precisa ser deliberada, não automática.",
    inputSchema: {
      area: z.string().describe("A área para a qual se procura um squad."),
      criar: z
        .boolean()
        .optional()
        .describe("Quando verdadeiro e nada for encontrado, devolve a PROPOSTA de squad novo (não persiste)."),
      responsabilidades: z.array(z.string()).optional().describe("Responsabilidades da área, se for propor."),
    },
    handler: (args) => {
      const area = z.string().parse(args.area);
      const encontrado = findSquadTemplate(area);
      if (encontrado) return { encontrado: true, squad: encontrado };
      if (args.criar !== true) return { encontrado: false, squad: null };
      const responsabilidades = z.array(z.string()).default([]).parse(args.responsabilidades ?? []);
      // dryRun sempre: um servidor MCP não deve gravar estado do produto.
      return {
        encontrado: false,
        proposta: createSquadTemplate(area, responsabilidades, { dryRun: true }),
      };
    },
  },

  {
    name: "org_workflow",
    title: "Derivar workflow",
    description:
      "Deriva o fluxo de trabalho de uma unidade: os passos, quem executa cada um e onde entra aprovação humana " +
      "conforme a autonomia do agente. Use para explicar como o trabalho daquela unidade seria executado.",
    inputSchema: { ...NodesInput },
    handler: (args) => {
      const assignments = assembleOrganization(asNodes(args.nodes));
      return assignments.map((assignment) => buildOrgWorkflow(assignment));
    },
  },

  {
    name: "org_template",
    title: "Organograma-semente",
    description:
      "Devolve um organograma-semente para começar: 'empresa' ou 'governo'. " +
      "Use apenas quando o usuário não tiver um organograma próprio — o organograma real sempre tem precedência.",
    inputSchema: { tipo: z.enum(["empresa", "governo"]).describe("Qual semente carregar.") },
    handler: (args) =>
      z.enum(["empresa", "governo"]).parse(args.tipo) === "governo" ? templateGoverno : templateEmpresa,
  },
];

/** Executa uma ferramenta e embrulha no formato de resultado do MCP. */
export function runTool(name: string, args: Record<string, unknown>): ToolResult {
  const tool = ORG_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) {
    return { content: [{ type: "text", text: JSON.stringify({ error: `ferramenta desconhecida: ${name}` }) }], isError: true };
  }
  try {
    return { content: [{ type: "text", text: JSON.stringify(tool.handler(args), null, 2) }] };
  } catch (error) {
    // Um erro de ferramenta é resultado, não queda do servidor: o cliente
    // precisa poder ler o motivo e corrigir a chamada.
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }], isError: true };
  }
}
