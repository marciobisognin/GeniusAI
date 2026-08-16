import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { embedText } from "../src/embeddings.js";

/**
 * Gera a fixture de paridade consumida pelo porte Python do embedding
 * (`hermes_plugin/tests/test_parity.py`).
 *
 * Os dois lados precisam produzir o MESMO vetor: só assim um índice escrito
 * pelo motor de aprendizado em TypeScript pode ser lido pelo memory provider
 * do Hermes, em Python, e vice-versa.
 *
 * Rodar: npm run parity -w packages/learning
 */
export const PARITY_OUTPUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../hermes_plugin/tests/embedding-parity.json",
);

/** Casos escolhidos para exercitar acentuação, caixa, pontuação e vazio. */
export const PARITY_CASES = [
  "",
  "contrato",
  "Contrato",
  "CONTRATO",
  "contratos administrativos",
  "Fiscalizar contratos administrativos — ação nº 1",
  "Pró-Reitoria de Ensino: atualizar o PPC do curso",
  "ação, coração, órgão; ÁÉÍÓÚ àèìòù âêîôû ãõ ç",
  "tokens repetidos tokens repetidos tokens",
  "123 456 abc123 ABC123",
  "   espaços    múltiplos   ",
  "emoji 🚀 não é token",
  "a".repeat(500),
  "Aprovação humana registrada no run r-42 pelo aprovador Marcio",
];

export function renderParityFixture(): string {
  return `${JSON.stringify(
    {
      description:
        "Gerado por packages/learning/test/embeddingParity.ts — não editar à mão. " +
        "Prova que o embedding do TypeScript e o do Python produzem o mesmo vetor.",
      dimensions: embedText("x").length,
      cases: PARITY_CASES.map((text) => ({ text, vector: embedText(text) })),
    },
    null,
    2,
  )}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(PARITY_OUTPUT, renderParityFixture(), "utf8");
  console.log(`paridade → ${PARITY_OUTPUT}`);
}
