import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { GameLoop } from "./GameLoop";
import { loadWorld } from "./trace";
import type { AgentDecision, AgentRunner } from "../agent/AgentRunner";

function fixedRunner(decision: AgentDecision): AgentRunner {
  return { name: "fake", healthy: async () => true, decide: async () => decision };
}
const passRunner = fixedRunner({ reasoning: "sem ações", actions: [] });

function tempDataDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "gai-loop-"));
  process.env.DATA_DIR = dir;
  return dir;
}

test("step: incrementa o tick e emite eventos por civilização viva", async () => {
  tempDataDir();
  const loop = new GameLoop({ runner: passRunner, seed: 5, gameId: "t1" });
  const seen: string[] = [];
  loop.on((e) => seen.push(e.type));
  await loop.step();
  assert.equal(loop.world.tick, 1);
  assert.equal(seen.filter((t) => t === "turn_start").length, 4);
  assert.equal(seen.filter((t) => t === "turn_end").length, 4);
  assert.equal(seen.filter((t) => t === "tick_end").length, 1);
});

test("step: grava trace (jsonl) e salva o mundo em disco", async () => {
  const dir = tempDataDir();
  const loop = new GameLoop({ runner: passRunner, seed: 5, gameId: "t2" });
  await loop.step();

  const traceFile = path.join(dir, "traces", "t2.jsonl");
  assert.ok(existsSync(traceFile));
  const firstLine = readFileSync(traceFile, "utf8").trim().split("\n")[0];
  const record = JSON.parse(firstLine);
  assert.equal(record.tick, 1);
  assert.equal(record.decisions.length, 4);

  const loaded = await loadWorld("t2");
  assert.ok(loaded && loaded.tick === 1);
});

test("step: civilizações mortas são puladas", async () => {
  tempDataDir();
  const loop = new GameLoop({ runner: passRunner, seed: 5, gameId: "t3" });
  loop.world.civilizations.egypt.alive = false;
  const turns: string[] = [];
  loop.on((e) => {
    if (e.type === "turn_start") turns.push(e.civ);
  });
  await loop.step();
  assert.equal(turns.length, 3);
  assert.ok(!turns.includes("egypt"));
});

test("play → para no primeiro tick_end e avança o mundo", async () => {
  tempDataDir();
  const loop = new GameLoop({ runner: passRunner, seed: 5, gameId: "t4", speedMs: 0 });
  await new Promise<void>((resolve) => {
    const off = loop.on((e) => {
      if (e.type === "tick_end") {
        off();
        loop.stop();
        resolve();
      }
    });
    loop.play();
  });
  assert.equal(loop.getState(), "stopped");
  assert.ok(loop.world.tick >= 1);
});

test("auto-stop quando resta ≤ 1 civilização viva", async () => {
  tempDataDir();
  const loop = new GameLoop({ runner: passRunner, seed: 5, gameId: "t5", speedMs: 0 });
  loop.world.civilizations.egypt.alive = false;
  loop.world.civilizations.greece.alive = false;
  loop.world.civilizations.mali.alive = false;
  await new Promise<void>((resolve) => {
    const off = loop.on((e) => {
      if (e.type === "loop_state" && e.state === "stopped") {
        off();
        resolve();
      }
    });
    loop.play();
  });
  assert.equal(loop.getState(), "stopped");
  assert.ok(loop.isOver());
});
