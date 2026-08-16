/**
 * `@genius/org-compiler` — o compilador de organograma.
 *
 * Extraído de `so-ia/src/lib/org/*`, onde nasceu junto com a **Lei 1** do
 * produto ("nada existe sem o organograma", `relevance.ts`). O motor é
 * TypeScript puro, sem React/Next: mora aqui para poder ser consumido por
 * servidores MCP, plug-ins e outros pacotes, e não só pelo app.
 *
 * Equivalência com a implementação original é verificada por golden tests
 * (`test/golden.test.ts`), com fixtures geradas a partir do código do `so-ia`.
 */
export * from "./types.js";
export * from "./orgChart.js";
export * from "./catalog.js";
export * from "./skillDescriptions.js";
export * from "./import.js";
export * from "./relevance.js";
export * from "./skills-registry.js";
export * from "./matching.js";
export * from "./squad-registry.js";
export * from "./squads.js";
export * from "./templates.js";
export * from "./workflow-builder.js";
