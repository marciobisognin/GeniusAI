import { describe, expect, it } from "vitest";
import { embedText } from "../src/embeddings.js";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

describe("embedText", () => {
  it("produz vetores de dimensão fixa e normalizados (norma ~1)", () => {
    const v = embedText("Confira a NF 2041 do contrato 12/2025");
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(v).toHaveLength(128);
    expect(norm).toBeCloseTo(1, 5);
  });

  it("textos parecidos ficam mais próximos (cosseno maior) que textos diferentes", () => {
    const base = embedText("Confira a NF 2041 do contrato 12/2025");
    const parecido = embedText("Confira novamente a NF 2041 do contrato 12/2025");
    const diferente = embedText("Prepare um relatório de vendas trimestral");
    expect(cosine(base, parecido)).toBeGreaterThan(cosine(base, diferente));
  });

  it("texto vazio não quebra (vetor de zeros, norma tratada)", () => {
    const v = embedText("");
    expect(v).toHaveLength(128);
    expect(v.every((x) => x === 0)).toBe(true);
  });
});
