import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceActions } from "./actions";

test("coerceActions: ação válida passa", () => {
  const { valid, errors } = coerceActions([{ tool: "build", args: { structure: "farm", x: 1, y: 2 } }]);
  assert.equal(valid.length, 1);
  assert.equal(errors.length, 0);
  assert.equal(valid[0].tool, "build");
});

test("coerceActions: ferramenta desconhecida vira erro (não derruba)", () => {
  const { valid, errors } = coerceActions([{ tool: "nuke", args: {} }]);
  assert.equal(valid.length, 0);
  assert.equal(errors.length, 1);
});

test("coerceActions: mistura válidas e inválidas", () => {
  const { valid, errors } = coerceActions([
    { tool: "research", args: { technology: "writing" } },
    { tool: "set_diplomacy", args: { civ: "egypt", stance: "stance_invalida" } },
  ]);
  assert.equal(valid.length, 1);
  assert.equal(errors.length, 1);
});

test("coerceActions: coage coordenadas vindas como string", () => {
  const { valid } = coerceActions([{ tool: "move_army", args: { armyId: "a1", x: "3", y: "4" } }]);
  assert.equal(valid.length, 1);
  assert.deepEqual(valid[0].args, { armyId: "a1", x: 3, y: 4 });
});

test("coerceActions: entrada não-array vira lista vazia", () => {
  const { valid, errors } = coerceActions("nope");
  assert.equal(valid.length, 0);
  assert.equal(errors.length, 0);
});

test("coerceActions: civilização inválida em set_diplomacy é rejeitada", () => {
  const { valid, errors } = coerceActions([
    { tool: "set_diplomacy", args: { civ: "atlantis", stance: "war" } },
  ]);
  assert.equal(valid.length, 0);
  assert.equal(errors.length, 1);
});
