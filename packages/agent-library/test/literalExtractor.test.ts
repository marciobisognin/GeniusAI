import { describe, expect, it } from "vitest";
import { extractExportedLiteral, NonStaticLiteralError } from "../src/literalExtractor.js";

describe("extractExportedLiteral — lê a AST, nunca executa o arquivo", () => {
  it("extrai um array de objetos", () => {
    const source = `
      export const items = [
        { id: "a1", nome: "Agente A", skills: ["x", "y"], desempenho: 0.9 },
        { id: "a2", nome: "Agente B", skills: [], desempenho: 0.5 },
      ];
    `;
    const result = extractExportedLiteral(source, "items");
    expect(result).toEqual([
      { id: "a1", nome: "Agente A", skills: ["x", "y"], desempenho: 0.9 },
      { id: "a2", nome: "Agente B", skills: [], desempenho: 0.5 },
    ]);
  });

  it("extrai um objeto (Record) de objetos", () => {
    const source = `
      export const catalog: Record<string, unknown> = {
        rome: { id: "rome", name: "Roma" },
        egypt: { id: "egypt", name: "Egito" },
      };
    `;
    const result = extractExportedLiteral(source, "catalog");
    expect(result).toEqual({ rome: { id: "rome", name: "Roma" }, egypt: { id: "egypt", name: "Egito" } });
  });

  it("desembrulha 'as const'", () => {
    const source = `export const CIV_IDS = ["rome", "egypt"] as const;`;
    expect(extractExportedLiteral(source, "CIV_IDS")).toEqual(["rome", "egypt"]);
  });

  it("lê números negativos e booleanos", () => {
    const source = `export const config = { risco: -1, ativo: true, inativo: false };`;
    expect(extractExportedLiteral(source, "config")).toEqual({ risco: -1, ativo: true, inativo: false });
  });

  it("ignora imports não resolvíveis — nunca executa o módulo", () => {
    // O mesmo padrão de so-ia/src/lib/org/squad-registry.ts: um import de
    // alias que não existiria fora do projeto original.
    const source = `
      import { slugify } from "@/lib/data/org-chart";
      export const institutionalSquads = [{ id: "tpl-1", nome: "Squad Um" }];
      export function createOne() { return slugify("x"); }
    `;
    expect(extractExportedLiteral(source, "institutionalSquads")).toEqual([{ id: "tpl-1", nome: "Squad Um" }]);
  });

  it("lança erro claro quando o valor não é um literal estático", () => {
    const source = `
      const BASE = 10;
      export const items = [{ id: "a1", valor: BASE }];
    `;
    expect(() => extractExportedLiteral(source, "items")).toThrow(NonStaticLiteralError);
  });

  it("lança erro claro quando a declaração não existe", () => {
    const source = `export const outraCoisa = [];`;
    expect(() => extractExportedLiteral(source, "naoExiste")).toThrow(/não encontrada/);
  });
});
