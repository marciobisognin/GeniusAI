import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LearningMemory } from "../src/memory.js";

describe("LearningMemory (vectra real em disco)", () => {
  let dir: string;
  let memory: LearningMemory;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "genius-memory-test-"));
    memory = new LearningMemory(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("indexa e recupera por significado — o trecho mais parecido vem primeiro", async () => {
    await memory.indexChunk({
      id: "c1",
      text: "Confira a NF 2041 do contrato 12/2025",
      sourceType: "learning-flow",
      sourceId: "lf1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await memory.indexChunk({
      id: "c2",
      text: "Prepare um relatório de vendas trimestral",
      sourceType: "learning-flow",
      sourceId: "lf2",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const results = await memory.search("Confira a NF 2041 do contrato 12/2025 de novo", 2);
    expect(results).toHaveLength(2);
    expect(results[0].sourceId).toBe("lf1");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("persiste em disco: uma segunda instância apontando pra mesma pasta enxerga o que foi indexado", async () => {
    await memory.indexChunk({
      id: "c1",
      text: "Atesto conferido: NF confere com o empenho",
      sourceType: "approved-result",
      sourceId: "run1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const secondInstance = new LearningMemory(dir);
    const results = await secondInstance.search("NF confere com o empenho", 1);
    expect(results[0]?.sourceId).toBe("run1");
  });

  it("índice vazio devolve lista vazia (não quebra)", async () => {
    const results = await memory.search("qualquer coisa", 5);
    expect(results).toEqual([]);
  });
});
