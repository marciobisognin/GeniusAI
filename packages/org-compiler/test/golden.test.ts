import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = resolve(HERE, "golden/so-ia-baseline.json");
const GENERATOR = resolve(HERE, "golden/generate.mjs");
const DIST = resolve(HERE, "../dist");

/**
 * Golden test da extração.
 *
 * `so-ia-baseline.json` foi gerado executando a implementação **original**
 * (`so-ia/src/lib/org/*`, compilada com o alias `@/` resolvido) sobre uma
 * bateria de entradas. Este teste roda a mesma bateria contra o pacote
 * extraído e exige saída idêntica — é o que o PRD do Allspark pede ao mandar
 * extrair os motores do `so-ia` "com golden tests garantindo comportamento
 * idêntico".
 *
 * Se este teste falhar, o pacote divergiu do `so-ia`. Só atualize a baseline
 * se a mudança de comportamento for **intencional e feita nos dois lados**.
 */
describe("equivalência com so-ia/src/lib/org", () => {
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, unknown>;

  it("a baseline versionada cobre toda a superfície do compilador", () => {
    expect(Object.keys(baseline).sort()).toEqual(
      [
        "assembleEmpresa",
        "assembleGoverno",
        "assembleOrganization",
        "bestBuilderSquad",
        "buildOrgWorkflow",
        "buildSquads",
        "buildSquadsGoverno",
        "buildTree",
        "createSquadTemplate",
        "findSquadTemplate",
        "institutionalCatalog",
        "institutionalSquads",
        "loadRepository",
        "matchNode",
        "organizationCovers",
        "parseOrgFile",
        "parseOrgPasted",
        "parseOrgText",
        "pickWorkflowAssignment",
        "skillsRegistry",
        "slugify",
        "templates",
      ].sort(),
    );
  });

  it("o pacote extraído reproduz a saída do so-ia byte a byte", () => {
    // Precisa do build: `npm run build -w packages/org-compiler`.
    expect(existsSync(DIST), "dist/ ausente — rode o build antes do teste").toBe(true);

    const produced = execFileSync(
      process.execPath,
      [GENERATOR, DIST, "-"],
      { encoding: "utf8", env: { ...process.env, GOLDEN_STDOUT: "1" } },
    );

    expect(JSON.parse(produced)).toEqual(baseline);
  });
});
