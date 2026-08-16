import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MAX_TICKS, rehearse, verifyDeterminism } from "./rehearsal.js";

/**
 * Servidor MCP da Sala de Ensaio.
 *
 * Expõe o motor determinístico deste projeto como ferramenta de ensaio: um
 * agente pode testar um plano e ver as consequências antes de agir. O aviso
 * sobre o domínio simulado viaja dentro de cada resposta, de propósito — é a
 * diferença entre "ensaiei" e "prevejo o mundo real".
 */
export const SERVER_INFO = { name: "genius-ensaio", version: "0.1.0" } as const;

const PLAN_SHAPE = z.object({
  civ: z.enum(["rome", "egypt", "greece", "mali"]).describe("Qual civilização executa este plano."),
  actions: z.array(z.record(z.string(), z.unknown())).describe("Ações no formato do motor (tool + args)."),
});

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }, null, 2) }], isError: true };
}

export function createRehearsalServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions:
      "Sala de Ensaio do GeniusAI: simulação determinística de consequências. Use `rehearse_plan` para " +
      "descobrir o que um plano provoca ANTES de executá-lo de verdade, e `verify_rehearsal` para provar " +
      "que um ensaio anterior continua reproduzível. O domínio simulado é o de civilizações (cidades, " +
      "exércitos, tecnologia, diplomacia) — as consequências valem para este modelo, não são previsão " +
      "sobre o mundo real.",
  });

  server.registerTool(
    "rehearse_plan",
    {
      title: "Ensaiar um plano",
      description:
        "Roda N ticks determinísticos a partir de uma semente, aplicando os planos informados, e devolve as " +
        "consequências: estado final de cada civilização, contagem de eventos por tipo, ações recusadas pelo " +
        "motor e uma assinatura reproduzível. Mesma semente + mesmo plano = mesmo resultado, sempre.",
      inputSchema: {
        seed: z.number().int().min(0).describe("Semente do mundo — define o mapa e o PRNG."),
        ticks: z.number().int().min(1).max(MAX_TICKS).describe(`Quantos ticks ensaiar (até ${MAX_TICKS}).`),
        plans: z.array(PLAN_SHAPE).optional().describe("Planos por civilização, repetidos a cada tick."),
      },
    },
    (async (args: { seed: number; ticks: number; plans?: Array<{ civ: string; actions: unknown[] }> }) => {
      try {
        return ok(rehearse(args as never));
      } catch (error) {
        return fail(error);
      }
    }) as never,
  );

  server.registerTool(
    "verify_rehearsal",
    {
      title: "Verificar reprodutibilidade de um ensaio",
      description:
        "Repete um ensaio e compara a assinatura com a de uma execução anterior. Devolve 'match' quando o " +
        "resultado continua reproduzível — é a prova de que o ensaio não mudou por baixo.",
      inputSchema: {
        seed: z.number().int().min(0),
        ticks: z.number().int().min(1).max(MAX_TICKS),
        plans: z.array(PLAN_SHAPE).optional(),
        signature: z.string().min(1).describe("Assinatura devolvida pelo ensaio original."),
      },
    },
    (async (args: { seed: number; ticks: number; plans?: unknown[]; signature: string }) => {
      try {
        const { signature, ...input } = args;
        return ok(verifyDeterminism(input as never, signature));
      } catch (error) {
        return fail(error);
      }
    }) as never,
  );

  return server;
}

export async function startStdioServer(): Promise<McpServer> {
  const server = createRehearsalServer();
  await server.connect(new StdioServerTransport());
  return server;
}
