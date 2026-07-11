import { z } from "zod";
import { CIV_IDS } from "../engine/types";
import type { Action, CivId } from "../engine/types";

/** Ferramentas (ações) que um agente pode escolher. */
export const ACTION_TOOLS = [
  "build",
  "research",
  "move_army",
  "attack",
  "set_diplomacy",
  "propose_trade",
  "propose_alliance",
  "respond_proposal",
  "set_strategy",
] as const;

const CivIdSchema = z.enum([...CIV_IDS] as [CivId, ...CivId[]]);
const StanceSchema = z.enum(["peace", "war", "alliance", "trade"]);
// Coerção tolerante: modelos fracos às vezes emitem números como strings.
// Coordenadas limitadas a um intervalo são defesa extra contra lixo numérico
// (o motor ainda valida contra as dimensões reais do mapa).
const Coord = z.coerce.number().int().min(-1000).max(1000);
// Quantias de recursos: inteiras, finitas, não-negativas e limitadas —
// oferta/pedido negativos inverteriam a transferência (roubo), e Infinity
// corromperia a economia inteira.
const ResourceAmount = z.coerce.number().int().nonnegative().max(1_000_000);
const ResourcesPartial = z.object({
  food: ResourceAmount.optional(),
  gold: ResourceAmount.optional(),
  science: ResourceAmount.optional(),
});

/** Validação estrita (zod) de UMA ação vinda do runner. */
export const ActionSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("build"), args: z.object({ structure: z.string(), x: Coord, y: Coord }) }),
  z.object({ tool: z.literal("research"), args: z.object({ technology: z.string() }) }),
  z.object({ tool: z.literal("move_army"), args: z.object({ armyId: z.string(), x: Coord, y: Coord }) }),
  z.object({ tool: z.literal("attack"), args: z.object({ armyId: z.string(), x: Coord, y: Coord }) }),
  z.object({ tool: z.literal("set_diplomacy"), args: z.object({ civ: CivIdSchema, stance: StanceSchema }) }),
  z.object({
    tool: z.literal("propose_trade"),
    args: z.object({ civ: CivIdSchema, offer: ResourcesPartial, request: ResourcesPartial }),
  }),
  z.object({ tool: z.literal("propose_alliance"), args: z.object({ civ: CivIdSchema }) }),
  z.object({
    tool: z.literal("respond_proposal"),
    args: z.object({ proposalId: z.string().min(1).max(80), accept: z.coerce.boolean() }),
  }),
  z.object({ tool: z.literal("set_strategy"), args: z.object({ note: z.string() }) }),
]);

export interface CoerceResult {
  valid: Action[];
  errors: string[];
}

/**
 * Converte a lista (possivelmente ruidosa) de ações do runner em ações
 * tipadas e válidas. Ações inválidas não derrubam o turno: são descartadas
 * e viram mensagens de erro (devolvidas ao agente no próximo turno).
 */
export function coerceActions(raw: unknown): CoerceResult {
  const valid: Action[] = [];
  const errors: string[] = [];
  const list = Array.isArray(raw) ? raw : [];

  list.forEach((item, i) => {
    const parsed = ActionSchema.safeParse(item);
    if (parsed.success) {
      valid.push(parsed.data as Action);
    } else {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "?"}: ${issue.message}`)
        .join("; ");
      errors.push(`ação[${i}] inválida: ${detail}`);
    }
  });

  return { valid, errors };
}

/**
 * JSON Schema da resposta do agente. Usado como `format` pelo Ollama e
 * embutido no prompt para os CLIs. Propositalmente permissivo em `args`
 * (a validação estrita é feita depois pelo zod, em coerceActions).
 */
export const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    reasoning: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tool: { type: "string", enum: [...ACTION_TOOLS] },
          args: { type: "object" },
        },
        required: ["tool", "args"],
      },
    },
  },
  required: ["reasoning", "actions"],
} as const;
