import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import * as schemas from "./schemas.js";
import { EventType, EventPayloadSchemas } from "./events.js";

/**
 * Exporta o canon como JSON Schema — o contrato que atravessa a fronteira de
 * linguagem.
 *
 * Os schemas Zod só valem dentro do TypeScript. Os plug-ins do Hermes são
 * Python e os servidores MCP falam JSON-RPC, então nenhum dos dois consegue
 * `import` do `@genius/canon`. Em vez de redigitar as entidades de cada lado
 * (e deixá-las divergir em silêncio), geramos JSON Schema a partir da mesma
 * fonte: `packages/canon/src/schemas.ts` continua sendo a única definição.
 *
 * Ver `docs/ANALISE-PLUGINS-HERMES.md` §4 — o canon não é um plug-in, é o
 * contrato de dados dos outros.
 */

/** As 13 entidades canônicas, na ordem em que o PRD as apresenta. */
export const CANONICAL_ENTITIES = [
  "Agent",
  "Squad",
  "Company",
  "MindClone",
  "Skill",
  "Pack",
  "ProviderConfig",
  "Task",
  "Run",
  "Approval",
  "LearningFlow",
  "MemoryChunk",
  "CanvasNode",
  "CanvasEdge",
] as const;

export type CanonicalEntity = (typeof CANONICAL_ENTITIES)[number];

/** Enums do canon exportados junto: um consumidor externo precisa deles. */
export const CANONICAL_ENUMS = [
  "AutonomyLevel",
  "EntityOrigin",
  "ProviderType",
  "TaskStatus",
  "ApprovalStatus",
  "MemoryChunkSourceType",
  "CanvasNodeKind",
  "ExecutionNodeStatus",
] as const;

export type JsonSchemaDocument = Record<string, unknown>;

function convert(name: string, schema: ZodTypeAny): JsonSchemaDocument {
  const document = zodToJsonSchema(schema, {
    name,
    $refStrategy: "none",
    target: "jsonSchema7",
  }) as JsonSchemaDocument;
  return normalizeDynamicDefaults(document) as JsonSchemaDocument;
}

/**
 * Remove defaults que não existem de verdade.
 *
 * Vários campos do canon são `z.string().datetime().default(() => new
 * Date().toISOString())`. O conversor **executa** essa função e grava o
 * instante da conversão como `"default"` — o que produzia um JSON Schema
 * não-determinístico (mudava a cada geração) e mentiroso (o default não é
 * "2026-08-15T23:56:32.907Z", é "agora"). Um default dinâmico não tem
 * representação estática em JSON Schema, então o correto é não ter default e
 * dizer isso na descrição.
 */
function normalizeDynamicDefaults(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeDynamicDefaults);
  if (!node || typeof node !== "object") return node;

  const entries = node as Record<string, unknown>;
  if (entries.format === "date-time" && typeof entries.default === "string") {
    const { default: _discarded, ...rest } = entries;
    return {
      ...rest,
      description: [rest.description, "Preenchido pelo runtime com o instante da criação."]
        .filter(Boolean)
        .join(" "),
    };
  }

  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, normalizeDynamicDefaults(value)]),
  );
}

function lookup(name: string): ZodTypeAny {
  const found = (schemas as Record<string, unknown>)[name];
  if (!found) throw new Error(`schema desconhecido no canon: ${name}`);
  return found as ZodTypeAny;
}

/** JSON Schema de uma entidade canônica. */
export function entityJsonSchema(name: CanonicalEntity): JsonSchemaDocument {
  return convert(name, lookup(name));
}

/**
 * Documento único com entidades, enums e payloads de evento.
 *
 * É o artefato que os consumidores fora do TypeScript carregam:
 * `schemas/canon.schema.json`, gerado por `npm run schema -w packages/canon`.
 */
export function canonJsonSchema(): JsonSchemaDocument {
  const definitions: Record<string, unknown> = {};

  for (const name of CANONICAL_ENTITIES) {
    definitions[name] = stripEnvelope(convert(name, lookup(name)), name);
  }
  for (const name of CANONICAL_ENUMS) {
    definitions[name] = stripEnvelope(convert(name, lookup(name)), name);
  }
  for (const type of EventType.options) {
    const payload = EventPayloadSchemas[type];
    definitions[`event:${type}`] = stripEnvelope(convert(type, payload), type);
  }

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://github.com/marciobisognin/GeniusAI/schemas/canon.schema.json",
    title: "Genius Allspark — canon",
    description:
      "Entidades canônicas, enums e payloads de evento do Genius Allspark. " +
      "Gerado a partir de packages/canon/src/schemas.ts — não editar à mão.",
    definitions,
  };
}

/**
 * `zodToJsonSchema` com `name` embrulha o resultado em
 * `{ $ref, definitions: { [name]: … } }`. Para compor um documento único,
 * queremos só o schema de dentro.
 */
function stripEnvelope(document: JsonSchemaDocument, name: string): unknown {
  const definitions = document.definitions as Record<string, unknown> | undefined;
  if (definitions && name in definitions) return definitions[name];
  return document;
}
