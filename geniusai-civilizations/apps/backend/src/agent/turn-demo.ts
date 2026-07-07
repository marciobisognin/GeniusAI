/**
 * Demo (não é teste): executa UM turno de decisão de uma civilização usando o
 * runner configurado (RUNNER=claude|codex|opencode|ollama) contra um mundo novo.
 * Precisa de um runner disponível e responde de verdade — use para verificar a
 * ponta a ponta com um LLM.
 *
 *   RUNNER=claude tsx src/agent/turn-demo.ts rome
 *   RUNNER=ollama MODEL=qwen2.5:14b tsx src/agent/turn-demo.ts egypt
 */
import { loadConfig } from "../config";
import { createRunner } from "./index";
import { createWorld } from "../engine/world";
import { runCivilizationTurn } from "./runTurn";
import type { CivId } from "../engine/types";

const cfg = loadConfig();
const runner = createRunner(cfg);
const civId = (process.argv[2] as CivId) ?? "rome";
const world = createWorld(Number(process.env.SEED ?? 42));

console.error(`[demo] runner=${runner.name} civ=${civId}`);
const res = await runCivilizationTurn(world, civId, runner, {
  timeoutMs: Number(process.env.TURN_TIMEOUT_MS ?? 120000),
});
console.log(JSON.stringify(res, null, 2));
