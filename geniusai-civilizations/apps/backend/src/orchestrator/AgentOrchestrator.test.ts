import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CIVILIZATIONS } from "@geniusai/shared";
import { createWorld } from "../engine/world";
import type { AgentDecision, AgentRunner } from "../agent/AgentRunner";
import { AgentOrchestrator, UnknownCivilizationError, createAgentOrchestrator } from "./AgentOrchestrator";

function fixedRunner(decision: AgentDecision): AgentRunner {
  return { name: "fake", healthy: async () => true, decide: async () => decision };
}

test("AgentOrchestrator: registra um agente por civilização do catálogo padrão", () => {
  const orch = createAgentOrchestrator({ gameId: "g1", runner: fixedRunner({ reasoning: "", actions: [] }) });
  for (const id of ["rome", "egypt", "greece", "mali"] as const) {
    assert.equal(orch.getAgent(id).civilizationId, id);
  }
  assert.deepEqual(orch.definitions.rome, DEFAULT_CIVILIZATIONS.rome);
});

test("AgentOrchestrator: decide()/answerQuestion() delegam ao agente correto", async () => {
  const orch = createAgentOrchestrator({
    gameId: "g1",
    runner: fixedRunner({ reasoning: "Sou Roma, expansionista.", actions: [{ tool: "set_strategy", args: { note: "x" } }] }),
  });
  const world = createWorld(5);
  const res = await orch.decide("rome", world);
  assert.equal(res.decision.civ, "rome");
  const answer = await orch.answerQuestion("rome", world, "Qual seu plano?");
  assert.match(answer, /Roma/);
});

test("AgentOrchestrator: civilização desconhecida rejeita com UnknownCivilizationError", () => {
  const orch = new AgentOrchestrator({ gameId: "g1", runner: fixedRunner({ reasoning: "", actions: [] }) });
  assert.throws(() => orch.getAgent("atlantis" as never), UnknownCivilizationError);
});

test("AgentOrchestrator: definitions parciais sobrescrevem só as civilizações informadas", () => {
  const customRome = { ...DEFAULT_CIVILIZATIONS.rome, name: "Nova Roma", riskTolerance: 0.99 };
  const orch = createAgentOrchestrator({
    gameId: "g1",
    runner: fixedRunner({ reasoning: "", actions: [] }),
    definitions: { rome: customRome },
  });
  assert.equal(orch.definitions.rome.name, "Nova Roma");
  assert.deepEqual(orch.definitions.egypt, DEFAULT_CIVILIZATIONS.egypt);
});

test("AgentOrchestrator: um logger customizado recebe entradas de todas as civilizações", async () => {
  const entries: { civ: string }[] = [];
  const orch = createAgentOrchestrator({
    gameId: "g1",
    runner: fixedRunner({ reasoning: "", actions: [] }),
    logger: { log: (e) => entries.push(e) },
  });
  const world = createWorld(5);
  await orch.decide("rome", world);
  await orch.decide("egypt", world);
  assert.deepEqual(
    entries.map((e) => e.civ),
    ["rome", "egypt"],
  );
});
