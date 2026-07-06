import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../engine/world";
import { tick } from "../engine/engine";
import { runCivilizationTurn } from "./runTurn";
import type { AgentDecision, AgentRunner } from "./AgentRunner";

function fixedRunner(decision: AgentDecision): AgentRunner {
  return { name: "fake", healthy: async () => true, decide: async () => decision };
}

function throwingRunner(): AgentRunner {
  return {
    name: "boom",
    healthy: async () => true,
    decide: async () => {
      throw new Error("saída não-JSON");
    },
  };
}

function flakyRunner(decision: AgentDecision): AgentRunner {
  let calls = 0;
  return {
    name: "flaky",
    healthy: async () => true,
    decide: async () => {
      calls += 1;
      if (calls === 1) throw new Error("falha na primeira tentativa");
      return decision;
    },
  };
}

test("runCivilizationTurn: decisão válida na 1ª tentativa", async () => {
  const w = createWorld(5);
  const runner = fixedRunner({
    reasoning: "expandir a fronteira",
    actions: [{ tool: "build", args: { structure: "farm", x: 1, y: 1 } }],
  });
  const res = await runCivilizationTurn(w, "rome", runner);
  assert.equal(res.passed, false);
  assert.equal(res.attempts, 1);
  assert.equal(res.decision.actions.length, 1);
  assert.equal(res.reasoning, "expandir a fronteira");
});

test("runCivilizationTurn: runner sempre falha → passa o turno após 2 tentativas", async () => {
  const w = createWorld(5);
  const res = await runCivilizationTurn(w, "rome", throwingRunner());
  assert.equal(res.passed, true);
  assert.equal(res.attempts, 2);
  assert.equal(res.decision.actions.length, 0);
  assert.equal(res.errors.length, 1);
});

test("runCivilizationTurn: falha na 1ª, sucesso na 2ª", async () => {
  const w = createWorld(5);
  const runner = flakyRunner({
    reasoning: "ok",
    actions: [{ tool: "set_strategy", args: { note: "crescer devagar" } }],
  });
  const res = await runCivilizationTurn(w, "rome", runner);
  assert.equal(res.passed, false);
  assert.equal(res.attempts, 2);
  assert.equal(res.decision.actions.length, 1);
});

test("runCivilizationTurn: ações inválidas são descartadas sem derrubar o turno", async () => {
  const w = createWorld(5);
  const runner = fixedRunner({
    reasoning: "",
    actions: [
      { tool: "nuke", args: {} },
      { tool: "research", args: { technology: "agriculture" } },
    ],
  });
  const res = await runCivilizationTurn(w, "rome", runner);
  assert.equal(res.passed, false);
  assert.equal(res.decision.actions.length, 1);
  assert.equal(res.errors.length, 1);
});

test("integração: decisão do agente aplicada pelo motor muda o mundo", async () => {
  const w = createWorld(5);
  const runner = fixedRunner({
    reasoning: "anotar estratégia",
    actions: [{ tool: "set_strategy", args: { note: "dominar o comércio" } }],
  });
  const res = await runCivilizationTurn(w, "mali", runner);
  const next = tick(w, [res.decision]);
  assert.ok(next.civilizations.mali.memory.includes("dominar o comércio"));
});
