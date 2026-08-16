import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_ENTITIES,
  CANONICAL_ENUMS,
  canonJsonSchema,
  entityJsonSchema,
} from "../src/jsonSchema.js";
import { EventType } from "../src/events.js";
import { Agent } from "../src/schemas.js";
import { SCHEMA_OUTPUT, renderSchemaFile } from "../src/writeSchema.js";

describe("canon como JSON Schema", () => {
  it("cobre as 14 entidades canônicas", () => {
    const document = canonJsonSchema();
    const definitions = document.definitions as Record<string, unknown>;
    for (const entity of CANONICAL_ENTITIES) {
      expect(definitions[entity], entity).toBeDefined();
    }
  });

  it("cobre os enums do canon", () => {
    const definitions = canonJsonSchema().definitions as Record<string, Record<string, unknown>>;
    for (const name of CANONICAL_ENUMS) {
      expect(definitions[name], name).toBeDefined();
    }
    expect(definitions.AutonomyLevel.enum).toEqual(["A0", "A1", "A2", "A3", "A4", "A5"]);
  });

  it("cobre todos os tipos de evento — nenhum evento fantasma atravessa a fronteira", () => {
    const definitions = canonJsonSchema().definitions as Record<string, unknown>;
    for (const type of EventType.options) {
      expect(definitions[`event:${type}`], type).toBeDefined();
    }
  });

  it("preserva os campos obrigatórios de Agent", () => {
    const schema = entityJsonSchema("Agent") as Record<string, unknown>;
    const definitions = schema.definitions as Record<string, Record<string, unknown>>;
    const agent = definitions.Agent;
    expect(agent.type).toBe("object");
    expect(agent.required).toContain("id");
    expect(agent.required).toContain("nome");
  });

  it("descreve autonomia como o mesmo enum do Zod", () => {
    const properties = (entityJsonSchema("Agent") as Record<string, Record<string, Record<string, Record<string, unknown>>>>)
      .definitions.Agent.properties;
    expect((properties.autonomia as Record<string, unknown>).enum).toEqual(
      Agent.shape.autonomia.removeDefault().options,
    );
  });

  it("é determinístico — gerar duas vezes dá o mesmo documento", () => {
    // Regressão: `createdAt` usa `.default(() => new Date().toISOString())`, e
    // o conversor executava a função, gravando o instante da geração.
    expect(JSON.stringify(canonJsonSchema())).toBe(JSON.stringify(canonJsonSchema()));
  });

  it("não inventa default estático para campos preenchidos pelo runtime", () => {
    const properties = (entityJsonSchema("Agent") as Record<string, Record<string, Record<string, Record<string, unknown>>>>)
      .definitions.Agent.properties;
    const createdAt = properties.createdAt as Record<string, unknown>;
    expect(createdAt.format).toBe("date-time");
    expect(createdAt).not.toHaveProperty("default");
    expect(String(createdAt.description)).toContain("runtime");
  });

  it("não deixa $ref pendurado — o documento é autocontido", () => {
    const serialized = JSON.stringify(canonJsonSchema());
    expect(serialized).not.toContain('"$ref":"#/definitions/');
  });

  it("o arquivo versionado está em dia com os schemas Zod", () => {
    // Se este teste falhar: rode `npm run schema -w packages/canon`.
    const committed = readFileSync(SCHEMA_OUTPUT, "utf8");
    expect(committed).toBe(renderSchemaFile());
  });
});
