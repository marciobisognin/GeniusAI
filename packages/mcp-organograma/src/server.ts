import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ORG_TOOLS, runTool } from "./tools.js";

/**
 * Servidor MCP do compilador de organograma.
 *
 * Por que MCP e não plug-in nativo do Hermes: o plug-in nativo é Python e este
 * motor é TypeScript, mas sobretudo — o mesmo servidor atende Hermes, Claude
 * Code, Codex e qualquer cliente MCP. Ver `docs/ANALISE-PLUGINS-HERMES.md`
 * §3.2, onde as duas rotas são comparadas.
 */
export const SERVER_INFO = {
  name: "genius-organograma",
  version: "0.1.0",
} as const;

export function createOrgServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions:
      "Compilador de organograma do GeniusAI. A regra que ordena o uso destas ferramentas é a Lei 1: " +
      "nada existe sem o organograma. Antes de oferecer, criar ou executar qualquer coisa ligada a uma " +
      "área institucional, chame `org_covers` — se a área não estiver no organograma carregado, ela não " +
      "existe nesta organização, e nenhuma ferramenta ou conteúdo daquela área deve ser oferecido.",
  });

  for (const tool of ORG_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      // O SDK tipa o callback a partir do schema; aqui as ferramentas são
      // resolvidas dinamicamente, então a ponte é feita por `runTool`.
      ((args: Record<string, unknown>) => runTool(tool.name, args ?? {})) as never,
    );
  }

  return server;
}

export async function startStdioServer(): Promise<McpServer> {
  const server = createOrgServer();
  await server.connect(new StdioServerTransport());
  return server;
}
