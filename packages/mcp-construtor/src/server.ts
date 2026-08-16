import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CONSTRUCTOR_TOOLS, createHttpClient, runTool, type ConstructorClient } from "./tools.js";
import { FORBIDDEN_ROUTES } from "./policy.js";

export const SERVER_INFO = { name: "genius-construtor", version: "0.1.0" } as const;

export const DEFAULT_BASE_URL = "http://127.0.0.1:3333";

/**
 * As instruções contam ao agente **o que ele não pode fazer** aqui, e por quê.
 * Um limite que o modelo não conhece vira tentativa e erro; um limite
 * explicado vira comportamento correto na primeira tentativa.
 */
const INSTRUCTIONS =
  "Super Construtor do Genius Allspark. Esta superfície é deliberadamente assimétrica: você pode consultar o " +
  "acervo, reaproveitar agentes e squads, exportar packs, buscar na memória e executar nós cuja autonomia " +
  "conquistada seja A3 ou superior. Você NÃO pode resolver aprovações, escrever credenciais de provedor, nem " +
  "importar packs ou catálogos — o executor não decide política, orçamento ou aprovação. Rotas fora do alcance " +
  `deste servidor: ${FORBIDDEN_ROUTES.join("; ")}.`;

export function createConstructorServer(client: ConstructorClient): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  for (const tool of CONSTRUCTOR_TOOLS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.inputSchema },
      ((args: Record<string, unknown>) => runTool(tool.name, args ?? {}, client)) as never,
    );
  }
  return server;
}

export async function startStdioServer(baseUrl = process.env.GENIUS_CONSTRUCTOR_URL ?? DEFAULT_BASE_URL) {
  const server = createConstructorServer(createHttpClient(baseUrl));
  await server.connect(new StdioServerTransport());
  return server;
}
