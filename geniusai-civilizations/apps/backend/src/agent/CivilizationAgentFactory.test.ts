import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CIVILIZATIONS } from "@geniusai/shared";
import { createWorld } from "../engine/world";
import type { AgentDecision, AgentRunner } from "./AgentRunner";
import {
  InvalidCivilizationDefinitionError,
  createCivilizationAgent,
  validateCivilizationDefinition,
} from "./CivilizationAgentFactory";
import type { AgentLogEntry, AgentLogger } from "./CivilizationAgentFactory";

function fixedRunner(decision: AgentDecision, capturedModels: (string | undefined)[] = []): AgentRunner {
  return {
    name: "fake",
    healthy: async () => true,
    decide: async (input) => {
      capturedModels.push(input.model);
      return decision;
    },
  };
}

function recordingLogger(): { logger: AgentLogger; entries: AgentLogEntry[] } {
  const entries: AgentLogEntry[] = [];
  return { logger: { log: (e) => entries.push(e) }, entries };
}

// ── Validação (§7.2) ─────────────────────────────────────────────────────────

test("validateCivilizationDefinition: aceita o catálogo padrão de produção", () => {
  for (const def of Object.values(DEFAULT_CIVILIZATIONS)) {
    assert.deepEqual(validateCivilizationDefinition(def), def);
  }
});

test("validateCivilizationDefinition: rejeita id fora de CIV_IDS", () => {
  const bad = { ...DEFAULT_CIVILIZATIONS.rome, id: "atlantis" };
  assert.throws(() => validateCivilizationDefinition(bad), InvalidCivilizationDefinitionError);
});

test("validateCivilizationDefinition: rejeita riskTolerance fora de [0,1]", () => {
  const bad = { ...DEFAULT_CIVILIZATIONS.rome, riskTolerance: 1.5 };
  assert.throws(() => validateCivilizationDefinition(bad), InvalidCivilizationDefinitionError);
});

test("validateCivilizationDefinition: rejeita cor que não é hex", () => {
  const bad = { ...DEFAULT_CIVILIZATIONS.rome, color: "red" };
  assert.throws(() => validateCivilizationDefinition(bad), InvalidCivilizationDefinitionError);
});

test("validateCivilizationDefinition: rejeita tecnologia inicial desconhecida", () => {
  const bad = { ...DEFAULT_CIVILIZATIONS.rome, startingTechnologies: ["laser_de_fusao"] };
  assert.throws(() => validateCivilizationDefinition(bad), /tecnologia inicial desconhecida/);
});

test("validateCivilizationDefinition: rejeita recursos iniciais negativos", () => {
  const bad = { ...DEFAULT_CIVILIZATIONS.rome, startingResources: { food: -5, gold: 10, science: 0 } };
  assert.throws(() => validateCivilizationDefinition(bad), InvalidCivilizationDefinitionError);
});

// ── Agente ───────────────────────────────────────────────────────────────────

test("createCivilizationAgent: decide() delega ao runner e loga a operação", async () => {
  const { logger, entries } = recordingLogger();
  const agent = createCivilizationAgent({
    gameId: "game-test",
    civilization: DEFAULT_CIVILIZATIONS.rome,
    runner: fixedRunner({ reasoning: "expandir", actions: [{ tool: "set_strategy", args: { note: "x" } }] }),
    logger,
  });
  const world = createWorld(5);
  const res = await agent.decide(world);
  assert.equal(res.reasoning, "expandir");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].operation, "decide");
  assert.equal(entries[0].civ, "rome");
  assert.equal(entries[0].gameId, "game-test");
});

test("createCivilizationAgent: decide() aplica o override de modelo da definição", async () => {
  // egypt (sem conselheiros por padrão) mantém este teste focado só no
  // override de modelo — a Fase 14 (conselheiros) tem testes próprios.
  const models: (string | undefined)[] = [];
  const agent = createCivilizationAgent({
    gameId: "game-test",
    civilization: { ...DEFAULT_CIVILIZATIONS.egypt, model: "qwen2.5:14b" },
    runner: fixedRunner({ reasoning: "ok", actions: [] }, models),
  });
  await agent.decide(createWorld(5));
  assert.deepEqual(models, ["qwen2.5:14b"]);
});

test("createCivilizationAgent: decide() consulta os conselheiros da definição por padrão (Fase 14)", async () => {
  let calls = 0;
  const agent = createCivilizationAgent({
    gameId: "game-test",
    // Roma vem com advisors: ["military", "economic"] no catálogo padrão.
    civilization: DEFAULT_CIVILIZATIONS.rome,
    runner: {
      name: "counting",
      healthy: async () => true,
      decide: async () => {
        calls += 1;
        return { reasoning: "[medium]: siga em frente", actions: [] };
      },
    },
  });
  const res = await agent.decide(createWorld(5));
  // 2 conselheiros + 1 decisão principal.
  assert.equal(calls, 3);
  assert.equal(res.advisorRecommendations.length, 2);
});

test("createCivilizationAgent: decide() sem `advisors` na definição não consulta conselheiros", async () => {
  let calls = 0;
  const agent = createCivilizationAgent({
    gameId: "game-test",
    civilization: DEFAULT_CIVILIZATIONS.egypt,
    runner: {
      name: "counting",
      healthy: async () => true,
      decide: async () => {
        calls += 1;
        return { reasoning: "ok", actions: [] };
      },
    },
  });
  const res = await agent.decide(createWorld(5));
  assert.equal(calls, 1);
  assert.deepEqual(res.advisorRecommendations, []);
});

test("createCivilizationAgent: answerQuestion() retorna texto e loga; falha loga ASK_FAILED e propaga", async () => {
  const { logger, entries } = recordingLogger();
  const ok = createCivilizationAgent({
    gameId: "g1",
    civilization: DEFAULT_CIVILIZATIONS.egypt,
    runner: fixedRunner({ reasoning: "Sou o Egito, próspero e cauteloso.", actions: [] }),
    logger,
  });
  const text = await ok.answerQuestion(createWorld(5), "Como vai o comércio?");
  assert.match(text, /Egito/);
  assert.equal(entries[0].operation, "answerQuestion");

  const failing = createCivilizationAgent({
    gameId: "g1",
    civilization: DEFAULT_CIVILIZATIONS.egypt,
    runner: { name: "boom", healthy: async () => true, decide: async () => { throw new Error("fora do ar"); } },
    logger,
  });
  await assert.rejects(() => failing.answerQuestion(createWorld(5), "?"));
  assert.equal(entries.at(-1)?.errorCode, "ASK_FAILED");
});

test("createCivilizationAgent: summarizeTurn() é local — não chama o runner", async () => {
  let calls = 0;
  const agent = createCivilizationAgent({
    gameId: "g1",
    civilization: DEFAULT_CIVILIZATIONS.mali,
    runner: {
      name: "counting",
      healthy: async () => true,
      decide: async () => {
        calls += 1;
        return { reasoning: "", actions: [] };
      },
    },
  });
  const passed = await agent.summarizeTurn({
    decision: { civ: "mali", actions: [] },
    reasoning: "",
    passed: true,
    attempts: 2,
    errors: ["timeout"],
    advisorRecommendations: [],
  });
  const acted = await agent.summarizeTurn({
    decision: {
      civ: "mali",
      actions: [{ tool: "propose_trade", args: { civ: "rome", offer: {}, request: {} } }],
    },
    reasoning: "",
    passed: false,
    attempts: 1,
    errors: [],
    advisorRecommendations: [],
  });
  assert.match(passed, /passou o turno/);
  assert.match(acted, /propôs comércio/);
  assert.equal(calls, 0, "summarizeTurn não deve chamar o runner");
});
