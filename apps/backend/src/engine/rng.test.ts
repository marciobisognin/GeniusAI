import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "./rng";

test("rng: mesmo seed → mesma sequência", () => {
  const a = new Rng(42);
  const b = new Rng(42);
  const seqA = Array.from({ length: 8 }, () => a.next());
  const seqB = Array.from({ length: 8 }, () => b.next());
  assert.deepEqual(seqA, seqB);
});

test("rng: valores em [0, 1)", () => {
  const r = new Rng(7);
  for (let i = 0; i < 200; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1, `valor fora de faixa: ${v}`);
  }
});

test("rng.int: inteiro em [0, max)", () => {
  const r = new Rng(1);
  for (let i = 0; i < 200; i++) {
    const v = r.int(5);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 5, `int fora de faixa: ${v}`);
  }
});

test("rng: seeds diferentes → sequências diferentes", () => {
  const a = new Rng(1).next();
  const b = new Rng(2).next();
  assert.notEqual(a, b);
});
