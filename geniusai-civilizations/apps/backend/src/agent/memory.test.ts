import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { createWorld } from "../engine/world";
import { hydrateMemory, persistMemory, readMemory, writeMemory } from "./memory";

test("memory: write/read round-trip (e inexistente → vazio)", async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "gai-mem-"));
  await writeMemory("rome", "olá memória");
  assert.equal(await readMemory("rome"), "olá memória");
  assert.equal(await readMemory("egypt"), "");
});

test("memory: persist e hydrate através do mundo", async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "gai-mem-"));
  const w = createWorld(5);
  w.civilizations.greece.memory = "priorizar ciência";
  await persistMemory(w);

  const w2 = createWorld(5);
  assert.equal(w2.civilizations.greece.memory, "");
  await hydrateMemory(w2);
  assert.equal(w2.civilizations.greece.memory, "priorizar ciência");
});
