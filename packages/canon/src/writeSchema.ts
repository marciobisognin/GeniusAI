import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonJsonSchema } from "./jsonSchema.js";

/**
 * Escreve `schemas/canon.schema.json` na raiz do repositório.
 *
 * Rodar com `npm run schema -w packages/canon`. O arquivo é versionado de
 * propósito: consumidores fora do TypeScript (plug-ins Python do Hermes,
 * servidores MCP) precisam dele sem compilar o monorepo. Um teste garante que
 * o arquivo commitado está em dia com os schemas Zod.
 */
export const SCHEMA_OUTPUT = resolve(import.meta.dirname, "../../../schemas/canon.schema.json");

export function renderSchemaFile(): string {
  return `${JSON.stringify(canonJsonSchema(), null, 2)}\n`;
}

export function writeSchemaFile(target: string = SCHEMA_OUTPUT): string {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, renderSchemaFile(), "utf8");
  return target;
}

// Execução direta (`node dist/writeSchema.js`), não import.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`canon → ${writeSchemaFile()}`);
}
