/**
 * Demo (não é teste): roda N ticks da simulação com o runner configurado,
 * imprimindo o progresso (decisões e eventos) no terminal.
 *
 *   RUNNER=claude TICKS=1 tsx src/orchestrator/loop-demo.ts
 *   RUNNER=ollama MODEL=qwen2.5:14b TICKS=3 tsx src/orchestrator/loop-demo.ts
 */
import { loadConfig } from "../config";
import { createRunner } from "../agent/index";
import { GameLoop } from "./GameLoop";

const cfg = loadConfig();
const runner = createRunner(cfg);
const ticks = Number(process.env.TICKS ?? 1);

const loop = new GameLoop({
  runner,
  seed: Number(process.env.SEED ?? 42),
  turnTimeoutMs: Number(process.env.TURN_TIMEOUT_MS ?? 120_000),
  gameId: "demo",
});

loop.on((e) => {
  if (e.type === "turn_start") {
    console.error(`\n[tick ${e.tick}] ${e.civ} decidindo…`);
  } else if (e.type === "turn_end") {
    const tools = e.actions.map((a) => a.tool).join(", ") || "nenhuma";
    console.error(`[tick ${e.tick}] ${e.civ}: ${e.passed ? "(passou o turno)" : e.reasoning}`);
    console.error(`             ações: ${tools}${e.errors.length ? ` | erros: ${e.errors.length}` : ""}`);
  } else if (e.type === "tick_end") {
    console.error(`[tick ${e.tick}] eventos: ${e.events.map((ev) => ev.type).join(", ")}`);
  }
});

console.error(`[demo] runner=${runner.name} · ${ticks} tick(s)`);
for (let i = 0; i < ticks; i++) {
  await loop.step();
}
console.error(`\n[demo] fim — vivas: ${loop.aliveCivs().join(", ")}`);
