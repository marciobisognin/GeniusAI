import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../engine/world";
import { buildSystemPrompt, buildTurnPrompt, snapshotForCiv } from "./prompt";

test("buildSystemPrompt inclui persona e todas as ações", () => {
  const s = buildSystemPrompt("Expansionista e militarista.", "rome");
  assert.ok(s.includes("Expansionista e militarista."));
  assert.ok(s.includes("rome"));
  for (const tool of ["build", "research", "move_army", "attack", "set_diplomacy", "trade", "set_strategy"]) {
    assert.ok(s.includes(tool), `prompt de sistema não menciona "${tool}"`);
  }
});

test("snapshotForCiv traz o próprio estado, os outros e o catálogo", () => {
  const w = createWorld(5);
  const snap = snapshotForCiv(w, "rome");
  assert.equal(snap.you.id, "rome");
  assert.ok(snap.you.resources.gold >= 0);
  assert.equal(snap.others.length, 3);
  assert.ok(snap.catalog.structures.length > 0);
  assert.ok(snap.catalog.techs.length > 0);
});

test("buildTurnPrompt menciona o tick e o formato de resposta", () => {
  const w = createWorld(5);
  const p = buildTurnPrompt(w, "rome");
  assert.ok(p.includes(`tick ${w.tick}`));
  assert.ok(p.includes(`"reasoning"`));
});
