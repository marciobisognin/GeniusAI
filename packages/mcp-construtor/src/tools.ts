import { z } from "zod";
import { READABLE_ENTITIES, decideExecution, type ReadableEntity } from "./policy.js";

/**
 * Ferramentas do servidor MCP do Super Construtor.
 *
 * O servidor é um **cliente HTTP** do Construtor (`packages/constructor`), não
 * um segundo servidor com o mesmo banco: assim a política de acesso mora numa
 * fronteira real, e o Construtor continua sendo o dono do estado.
 */

export interface ConstructorClient {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

export function createHttpClient(baseUrl: string): ConstructorClient {
  const root = baseUrl.replace(/\/+$/, "");
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(`${root}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    const text = await response.text();
    const payload: unknown = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(`construtor respondeu ${response.status}: ${text || response.statusText}`);
    }
    return payload;
  }
  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  };
}

export type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export interface ConstructorTool {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (args: Record<string, unknown>, client: ConstructorClient) => Promise<unknown>;
}

const EntityEnum = z.enum(READABLE_ENTITIES);

export const CONSTRUCTOR_TOOLS: ConstructorTool[] = [
  {
    name: "constructor_health",
    title: "Saúde do Super Construtor",
    description:
      "Verifica se o Super Construtor está no ar e respondendo. Use antes de qualquer outra ferramenta " +
      "quando houver dúvida sobre a conexão.",
    inputSchema: {},
    handler: (_args, client) => client.get("/health"),
  },

  {
    name: "constructor_list",
    title: "Listar entidades",
    description:
      "Lista entidades do Super Construtor: agents, squads, companies, mind-clones, tasks, runs, approvals, " +
      "learning-flows, canvas-nodes, canvas-edges. Somente leitura. " +
      "Provedores NÃO são listáveis por aqui — guardam credenciais.",
    inputSchema: { entity: EntityEnum.describe("Qual coleção listar.") },
    handler: (args, client) => client.get(`/${EntityEnum.parse(args.entity) satisfies ReadableEntity}`),
  },

  {
    name: "constructor_get",
    title: "Obter uma entidade",
    description: "Busca uma entidade específica pelo id. Somente leitura.",
    inputSchema: {
      entity: EntityEnum.describe("Qual coleção."),
      id: z.string().min(1).describe("Id da entidade."),
    },
    handler: (args, client) =>
      client.get(`/${EntityEnum.parse(args.entity)}/${encodeURIComponent(z.string().parse(args.id))}`),
  },

  {
    name: "constructor_match_agent",
    title: "Reaproveitar ou criar agente",
    description:
      "Dada a especificação de um papel (área, responsabilidades), procura no acervo um agente reaproveitável. " +
      "Devolve o candidato e o score, ou a proposta de agente novo. Reaproveitar é sempre preferível a criar.",
    inputSchema: {
      area: z.string().describe("Área institucional do papel."),
      titulo: z.string().optional().describe("Título do cargo/função."),
      responsabilidades: z.array(z.string()).optional().describe("O que esse papel faz."),
    },
    handler: (args, client) =>
      client.post("/agents/match", {
        area: z.string().parse(args.area),
        titulo: args.titulo ?? "",
        responsabilidades: args.responsabilidades ?? [],
      }),
  },

  {
    name: "constructor_match_squad",
    title: "Reaproveitar ou criar squad",
    description:
      "Mesma lógica de `constructor_match_agent`, para squads: procura um squad reaproveitável para a área " +
      "antes de propor um novo.",
    inputSchema: {
      area: z.string().describe("Área institucional."),
      titulo: z.string().optional(),
      responsabilidades: z.array(z.string()).optional(),
    },
    handler: (args, client) =>
      client.post("/squads/match", {
        area: z.string().parse(args.area),
        titulo: args.titulo ?? "",
        responsabilidades: args.responsabilidades ?? [],
      }),
  },

  {
    name: "constructor_packs_available",
    title: "Packs disponíveis",
    description: "Lista os packs (bundles de agentes, squads e skills) disponíveis para importação. Somente leitura.",
    inputSchema: {},
    handler: (_args, client) => client.get("/packs/available"),
  },

  {
    name: "constructor_export_pack",
    title: "Exportar company como pack",
    description:
      "Exporta uma company inteira (agentes, squads, skills) como pack portátil. " +
      "É exportação: não altera nada no Construtor.",
    inputSchema: { companyId: z.string().min(1).describe("Id da company a exportar.") },
    handler: (args, client) =>
      client.post(`/companies/${encodeURIComponent(z.string().parse(args.companyId))}/export-pack`, {}),
  },

  {
    name: "constructor_memory_search",
    title: "Buscar na memória indexada",
    description:
      "Busca por significado na memória de execuções aprovadas. Cada resultado traz a procedência — " +
      "de qual execução aprovada aquele conhecimento veio.",
    inputSchema: {
      query: z.string().min(1).describe("O que procurar, em linguagem natural."),
      k: z.number().int().min(1).max(50).optional().describe("Quantos resultados (padrão 5)."),
    },
    handler: (args, client) => {
      const query = encodeURIComponent(z.string().parse(args.query));
      const k = args.k === undefined ? 5 : z.number().int().parse(args.k);
      return client.get(`/memory/search?q=${query}&k=${k}`);
    },
  },

  {
    name: "constructor_execute",
    title: "Executar um nó do canvas (A3+)",
    description:
      "Dispara a execução de um nó de agente ou squad. IMPORTANTE: só executa quando a autonomia conquistada " +
      "for A3 ou superior. Agentes A0–A2 sempre pausam para aprovação humana, e este servidor não pode resolver " +
      "aprovações — nesses casos a resposta explica que a execução precisa passar pelo Canvas, onde um humano decide.",
    inputSchema: {
      canvasNodeId: z.string().min(1).describe("Id do nó do canvas a executar."),
      taskDescription: z.string().min(1).describe("O que deve ser feito."),
    },
    handler: async (args, client) => {
      const canvasNodeId = z.string().parse(args.canvasNodeId);
      const taskDescription = z.string().parse(args.taskDescription);

      const node = (await client.get(`/canvas-nodes/${encodeURIComponent(canvasNodeId)}`)) as {
        kind?: string;
        refId?: string;
      };
      const autonomias = await resolveAutonomias(client, node);
      const decision = decideExecution({ kind: node.kind ?? "", autonomias });

      if (!decision.permitido) {
        return { status: "recusado", ...decision, canvasNodeId };
      }
      const started = await client.post("/execution/run", { canvasNodeId, taskDescription });
      return { status: "iniciado", ...decision, ...(started as Record<string, unknown>) };
    },
  },

  {
    name: "constructor_run_status",
    title: "Estado de uma execução",
    description:
      "Consulta o estado de um run: passos, status e se está aguardando aprovação humana. Somente leitura — " +
      "ver que um run aguarda aprovação não dá poder de aprová-lo.",
    inputSchema: { runId: z.string().min(1).describe("Id do run.") },
    handler: (args, client) => client.get(`/runs/${encodeURIComponent(z.string().parse(args.runId))}`),
  },
];

/** Autonomias envolvidas num nó: a do agente, ou as de todos os membros do squad. */
async function resolveAutonomias(
  client: ConstructorClient,
  node: { kind?: string; refId?: string },
): Promise<string[]> {
  if (!node.refId) return [];
  if (node.kind === "agent") {
    const agent = (await client.get(`/agents/${encodeURIComponent(node.refId)}`)) as { autonomia?: string };
    return agent.autonomia ? [agent.autonomia] : [];
  }
  if (node.kind === "squad") {
    const squad = (await client.get(`/squads/${encodeURIComponent(node.refId)}`)) as { agentIds?: string[] };
    const ids = squad.agentIds ?? [];
    const agents = await Promise.all(
      ids.map((id) => client.get(`/agents/${encodeURIComponent(id)}`) as Promise<{ autonomia?: string }>),
    );
    return agents.map((agent) => agent.autonomia ?? "A0");
  }
  return [];
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  client: ConstructorClient,
): Promise<ToolResult> {
  const tool = CONSTRUCTOR_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: `ferramenta desconhecida: ${name}` }) }],
      isError: true,
    };
  }
  try {
    const payload = await tool.handler(args, client);
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }], isError: true };
  }
}
