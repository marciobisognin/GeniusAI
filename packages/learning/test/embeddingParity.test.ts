import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { embedText } from "../src/embeddings.js";
import { PARITY_CASES, PARITY_OUTPUT, renderParityFixture } from "./embeddingParity.js";

/**
 * A fixture de paridade é o contrato entre o embedding em TypeScript e o porte
 * em Python (`hermes_plugin/embeddings.py`). Os dois precisam produzir o mesmo
 * vetor, senão um índice escrito por um lado fica ilegível para o outro.
 *
 * Para regravar após uma mudança **intencional** nos dois lados:
 *   UPDATE_PARITY=1 npx vitest run -t paridade
 */
describe("paridade do embedding com o porte Python", () => {
  it("a fixture versionada está em dia com embedText", () => {
    const rendered = renderParityFixture();
    if (process.env.UPDATE_PARITY === "1") {
      writeFileSync(PARITY_OUTPUT, rendered, "utf8");
    }
    expect(existsSync(PARITY_OUTPUT), `fixture ausente: ${PARITY_OUTPUT}`).toBe(true);
    expect(readFileSync(PARITY_OUTPUT, "utf8")).toBe(rendered);
  });

  it("cobre acentuação, caixa, repetição e entrada vazia", () => {
    expect(PARITY_CASES).toContain("");
    expect(PARITY_CASES.some((text) => /[áéíóúãõç]/i.test(text))).toBe(true);
    expect(PARITY_CASES.some((text) => text !== text.toLowerCase())).toBe(true);
  });

  it("vetores são normalizados (L2) ou nulos para texto sem token", () => {
    for (const text of PARITY_CASES) {
      const norm = Math.sqrt(embedText(text).reduce((sum, value) => sum + value * value, 0));
      expect(norm === 0 || Math.abs(norm - 1) < 1e-12, `norma inesperada em "${text}"`).toBe(true);
    }
  });
});
