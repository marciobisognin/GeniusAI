import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { createWorld } from "../engine/world";
import {
  appendTrace,
  listSaves,
  loadWorld,
  readTrace,
  readTraceSummary,
  saveWorld,
  summarizeTrace,
} from "./trace";
import type { TraceRecord } from "./trace";

function tempDataDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "gai-trace-"));
  process.env.DATA_DIR = dir;
  return dir;
}

test("readTrace: vazio quando o arquivo não existe", async () => {
  tempDataDir();
  assert.deepEqual(await readTrace("nunca-existiu"), []);
});

test("appendTrace + readTrace: round-trip preserva múltiplos registros em ordem", async () => {
  tempDataDir();
  const r1: TraceRecord = { tick: 1, decisions: [], events: [{ type: "tick_started", tick: 1 }] };
  const r2: TraceRecord = {
    tick: 2,
    decisions: [{ civ: "rome", reasoning: "expandir", actions: [], passed: false, errors: [] }],
    events: [{ type: "tick_started", tick: 2 }],
    narration: "Roma expande suas fronteiras",
  };
  await appendTrace("g1", r1);
  await appendTrace("g1", r2);

  const records = await readTrace("g1");
  assert.equal(records.length, 2);
  assert.equal(records[0].tick, 1);
  assert.equal(records[1].tick, 2);
  assert.equal(records[1].narration, "Roma expande suas fronteiras");
});

test("summarizeTrace: concatena eventos, injeta narração e mantém a última decisão por civ", () => {
  const records: TraceRecord[] = [
    {
      tick: 1,
      decisions: [{ civ: "rome", reasoning: "primeira", actions: [], passed: false, errors: [] }],
      events: [{ type: "tick_started", tick: 1 }],
    },
    {
      tick: 2,
      decisions: [{ civ: "rome", reasoning: "segunda", actions: [], passed: false, errors: [] }],
      events: [{ type: "tick_started", tick: 2 }],
      narration: "manchete do tick 2",
    },
  ];

  const summary = summarizeTrace(records);
  assert.equal(summary.timeline.length, 3); // 2 tick_started + 1 narração
  assert.equal(summary.timeline[2].type, "narration");
  assert.equal((summary.timeline[2] as { text: string }).text, "manchete do tick 2");
  assert.equal(summary.civs.rome?.reasoning, "segunda"); // última, não a primeira
});

test("readTraceSummary: vazio quando não há trace (partida nova)", async () => {
  tempDataDir();
  const summary = await readTraceSummary("partida-nova");
  assert.deepEqual(summary.timeline, []);
  assert.deepEqual(summary.civs, {});
});

test("saveWorld + loadWorld: round-trip preserva o mundo", async () => {
  tempDataDir();
  const world = createWorld(11);
  world.tick = 3;
  await saveWorld("g2", world);
  const loaded = await loadWorld("g2");
  assert.deepEqual(loaded, world);
});

test("loadWorld: null quando não existe", async () => {
  tempDataDir();
  assert.equal(await loadWorld("nunca-salvo"), null);
});

test("listSaves: vazio sem partidas salvas, lista após salvar", async () => {
  tempDataDir();
  assert.deepEqual(await listSaves(), []);

  await saveWorld("g3", createWorld(1));
  await saveWorld("g4", createWorld(2));

  const saves = await listSaves();
  const ids = saves.map((s) => s.gameId).sort();
  assert.deepEqual(ids, ["g3", "g4"]);
  assert.ok(saves.every((s) => typeof s.tick === "number" && typeof s.seed === "number"));
});
