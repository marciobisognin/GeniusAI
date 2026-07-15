import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CIVILIZATIONS } from "@geniusai/shared";
import { tick } from "../engine/engine";
import { createWorld } from "../engine/world";
import type { CivDecision } from "../engine/types";
import { replayFromTrace } from "./replay";
import type { TraceRecord } from "./trace";

function record(tick: number, decisions: CivDecision[]): TraceRecord {
  return {
    tick,
    decisions: decisions.map((d) => ({ civ: d.civ, reasoning: "", actions: d.actions, passed: false, errors: [] })),
    events: [],
  };
}

test("replayFromTrace: sem registros devolve só o mundo inicial (ticks[0])", () => {
  const ticks = replayFromTrace(42, false, []);
  assert.equal(ticks.length, 1);
  assert.deepEqual(ticks[0], createWorld(42, DEFAULT_CIVILIZATIONS, false));
});

test("replayFromTrace: reconstrói exatamente a mesma sequência que tick() direto (mesma seed + decisões)", () => {
  const seed = 7;
  const decisions1: CivDecision[] = [
    { civ: "rome", actions: [{ tool: "research", args: { technology: "agriculture" } }] },
    { civ: "egypt", actions: [] },
    { civ: "greece", actions: [] },
    { civ: "mali", actions: [] },
  ];
  const decisions2: CivDecision[] = [
    { civ: "rome", actions: [{ tool: "set_strategy", args: { note: "expandir para o norte" } }] },
    { civ: "egypt", actions: [] },
    { civ: "greece", actions: [] },
    { civ: "mali", actions: [] },
  ];

  // Reconstrução independente via tick() direto, como referência de verdade.
  let expected = createWorld(seed, DEFAULT_CIVILIZATIONS, false);
  const expectedTicks = [expected];
  expected = tick(expected, decisions1);
  expectedTicks.push(expected);
  expected = tick(expected, decisions2);
  expectedTicks.push(expected);

  const records = [record(1, decisions1), record(2, decisions2)];
  const ticks = replayFromTrace(seed, false, records);

  assert.equal(ticks.length, 3);
  assert.deepEqual(ticks, expectedTicks);
  assert.deepEqual(ticks[2], expected, "o último tick reconstruído deve ser byte-idêntico ao computado direto");
});

test("replayFromTrace: determinístico — mesma seed + mesmo trace produzem sempre a mesma sequência", () => {
  const decisions: CivDecision[] = [{ civ: "rome", actions: [{ tool: "research", args: { technology: "agriculture" } }] }];
  const records = [record(1, decisions)];
  assert.deepEqual(replayFromTrace(3, false, records), replayFromTrace(3, false, records));
});

test("replayFromTrace: propaga fogOfWar para o mundo reconstruído (afeta descoberta inicial)", () => {
  const ticks = replayFromTrace(5, true, []);
  assert.equal(ticks[0].fogOfWar, true);
  assert.ok(ticks[0].civilizations.rome.discovered["1,1"]);
  assert.ok(!ticks[0].civilizations.rome.discovered["6,1"]);
});
