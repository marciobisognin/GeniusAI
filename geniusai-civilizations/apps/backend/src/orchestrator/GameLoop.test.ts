import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { DEFAULT_CIVILIZATIONS, civilizationPersonaText } from "@geniusai/shared";
import { createGameLoop, GameLoop } from "./GameLoop";
import { loadWorld, readTrace } from "./trace";
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

// ── Fase 5: retomar partida salva + narrador ────────────────────────────────

test("createGameLoop: sem save existente, começa um mundo novo (tick 0)", async () => {
  tempDataDir();
  const loop = await createGameLoop({ runner: passRunner, seed: 9, gameId: "resume-1" });
  assert.equal(loop.world.tick, 0);
});

test("createGameLoop: com save existente, retoma de onde parou", async () => {
  tempDataDir();
  const first = new GameLoop({ runner: passRunner, seed: 9, gameId: "resume-2" });
  await first.step();
  await first.step();
  assert.equal(first.world.tick, 2);

  // Uma nova instância (simulando reinício do servidor) deve carregar o save.
  const resumed = await createGameLoop({ runner: passRunner, seed: 9, gameId: "resume-2" });
  assert.equal(resumed.world.tick, 2);
  assert.deepEqual(resumed.world, first.world);
});

test("createGameLoop: memória persistida é restaurada (hydrate automático)", async () => {
  tempDataDir();
  const first = new GameLoop({
    runner: fixedRunner({ reasoning: "", actions: [{ tool: "set_strategy", args: { note: "focar em ciência" } }] }),
    seed: 9,
    gameId: "resume-3",
  });
  await first.step();
  assert.ok(first.world.civilizations.rome.memory.includes("focar em ciência"));

  const resumed = await createGameLoop({ runner: passRunner, seed: 9, gameId: "resume-3" });
  assert.ok(resumed.world.civilizations.rome.memory.includes("focar em ciência"));
});

test("step: com narrador configurado, grava a manchete no trace", async () => {
  tempDataDir();
  const narrator = fixedRunner({ reasoning: "Uma manchete e tanto!", actions: [] });
  const loop = new GameLoop({ runner: passRunner, narrator, seed: 5, gameId: "narr-1" });
  await loop.step();

  const [record] = await readTrace("narr-1");
  assert.equal(record.narration, "Uma manchete e tanto!");
});

test("tick_end: eventos transmitidos incluem a narração como evento sintético", async () => {
  tempDataDir();
  const narrator = fixedRunner({ reasoning: "Manchete ao vivo", actions: [] });
  const loop = new GameLoop({ runner: passRunner, narrator, seed: 5, gameId: "narr-2" });

  let tickEndEvents: unknown[] = [];
  loop.on((e) => {
    if (e.type === "tick_end") tickEndEvents = e.events;
  });
  await loop.step();

  const narrationEntry = tickEndEvents.find((e) => (e as { type: string }).type === "narration");
  assert.ok(narrationEntry);
  assert.equal((narrationEntry as { text: string }).text, "Manchete ao vivo");
});

test("step: sem narrador, nenhuma narração é gravada nem emitida", async () => {
  tempDataDir();
  const loop = new GameLoop({ runner: passRunner, seed: 5, gameId: "narr-3" });
  await loop.step();
  const [record] = await readTrace("narr-3");
  assert.equal(record.narration, undefined);
});

test("concorrência: dois step() simultâneos são serializados (nenhum tick se perde ou duplica)", async () => {
  tempDataDir();
  const slowRunner: AgentRunner = {
    name: "fake",
    healthy: async () => true,
    decide: async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { reasoning: "devagar", actions: [] };
    },
  };
  const loop = new GameLoop({ runner: slowRunner, seed: 5, gameId: "t-conc", persist: false });

  const ticksVistos: number[] = [];
  loop.on((e) => {
    if (e.type === "tick_end") ticksVistos.push(e.tick);
  });

  assert.equal(loop.isBusy(), false);
  const [a, b] = await Promise.all([loop.step(), loop.step()]);
  assert.equal(loop.world.tick, 2);
  assert.deepEqual(ticksVistos, [1, 2], "os ticks devem sair em ordem, sem intercalar");
  assert.notEqual(a.tick, b.tick);

  await loop.whenIdle();
  assert.equal(loop.isBusy(), false);
});

test("createGameLoop: mundo carregado de save mantém a memória do save (sem sobrescrita global)", async () => {
  tempDataDir();
  const loop = new GameLoop({ runner: passRunner, seed: 11, gameId: "t-mem" });
  loop.world.civilizations.rome.memory = "memória da partida t-mem";
  await loop.step(); // persiste save + memória por partida

  const retomado = await createGameLoop({ runner: passRunner, gameId: "t-mem" });
  assert.equal(retomado.world.civilizations.rome.memory, "memória da partida t-mem");
});

test("Agente Construtor: definitions customizadas se refletem no mundo novo e no turno do agente", async () => {
  tempDataDir();
  const models: (string | undefined)[] = [];
  const runner: AgentRunner = {
    name: "fake",
    healthy: async () => true,
    decide: async (input) => {
      models.push(input.model);
      return { reasoning: "", actions: [] };
    },
  };
  const customEgypt = {
    ...DEFAULT_CIVILIZATIONS.egypt,
    personality: ["Isolacionista"],
    model: "qwen2.5:14b",
  };
  const loop = new GameLoop({
    runner,
    seed: 5,
    gameId: "t-def",
    persist: false,
    definitions: { egypt: customEgypt },
  });

  assert.equal(loop.world.civilizations.egypt.persona, civilizationPersonaText(customEgypt));
  // Demais civilizações continuam com o catálogo padrão.
  assert.equal(loop.world.civilizations.rome.persona, civilizationPersonaText(DEFAULT_CIVILIZATIONS.rome));

  await loop.step();
  assert.ok(models.includes("qwen2.5:14b"), "o override de modelo do Egito deveria chegar ao runner");
});

test("GameLoop.ask(): consulta somente leitura via Agente Construtor, sem avançar o tick", async () => {
  tempDataDir();
  const runner = fixedRunner({ reasoning: "Sou Mali, próspero e diplomata.", actions: [] });
  const loop = new GameLoop({ runner, seed: 5, gameId: "t-ask", persist: false });

  const answer = await loop.ask("mali", "Qual o seu plano?");
  assert.match(answer, /Mali/);
  assert.equal(loop.world.tick, 0, "ask não pode avançar a simulação");
});
