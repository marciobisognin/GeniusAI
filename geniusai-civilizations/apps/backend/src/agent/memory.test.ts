import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { createWorld } from "../engine/world";
import { hydrateMemory, persistMemory, readMemory, writeMemory } from "./memory";

test("memory: write/read round-trip (e inexistente → vazio)", async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "gai-mem-"));
  await writeMemory("game-1", "rome", "olá memória");
  assert.equal(await readMemory("game-1", "rome"), "olá memória");
  assert.equal(await readMemory("game-1", "egypt"), "");
});

test("memory: persist e hydrate através do mundo", async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "gai-mem-"));
  const w = createWorld(5);
  w.civilizations.greece.memory = "priorizar ciência";
  await persistMemory("game-5", w);

  const w2 = createWorld(5);
  assert.equal(w2.civilizations.greece.memory, "");
  await hydrateMemory("game-5", w2);
  assert.equal(w2.civilizations.greece.memory, "priorizar ciência");
});

test("memory: isolada por partida — uma partida não contamina a outra", async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "gai-mem-"));
  await writeMemory("game-a", "rome", "estratégia da partida A");
  await writeMemory("game-b", "rome", "estratégia da partida B");

  assert.equal(await readMemory("game-a", "rome"), "estratégia da partida A");
  assert.equal(await readMemory("game-b", "rome"), "estratégia da partida B");

  const w = createWorld(1);
  await hydrateMemory("game-c", w);
  assert.equal(w.civilizations.rome.memory, "");
});

test("memory: gameId malicioso é rejeitado (path traversal)", async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "gai-mem-"));
  await assert.rejects(() => writeMemory("../fora", "rome", "x"), /gameId inválido/);
  await assert.rejects(() => readMemory("a/b", "rome"), /gameId inválido/);
});
