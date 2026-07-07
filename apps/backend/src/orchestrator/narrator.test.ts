import { test } from "node:test";
import assert from "node:assert/strict";
import { narrate } from "./narrator";
import type { AgentDecision, AgentRunner } from "../agent/AgentRunner";
import type { GameEvent } from "../engine/types";

function fixedRunner(decision: AgentDecision): AgentRunner {
  return { name: "fake", healthy: async () => true, decide: async () => decision };
}

function throwingRunner(): AgentRunner {
  return {
    name: "boom",
    healthy: async () => true,
    decide: async () => {
      throw new Error("falha simulada");
    },
  };
}

const battleEvent: GameEvent = {
  type: "battle",
  attacker: "rome",
  defender: "egypt",
  x: 1,
  y: 1,
  winner: "rome",
};

test("narrate: retorna a manchete do runner (reasoning)", async () => {
  const runner = fixedRunner({ reasoning: "Roma esmaga o Egito em batalha épica!", actions: [] });
  const text = await narrate(runner, [battleEvent]);
  assert.equal(text, "Roma esmaga o Egito em batalha épica!");
});

test("narrate: lista vazia de eventos → null sem chamar o runner", async () => {
  let called = false;
  const runner: AgentRunner = {
    name: "spy",
    healthy: async () => true,
    decide: async () => {
      called = true;
      return { reasoning: "", actions: [] };
    },
  };
  const text = await narrate(runner, []);
  assert.equal(text, null);
  assert.equal(called, false);
});

test("narrate: só tick_started → null sem chamar o runner", async () => {
  let called = false;
  const runner: AgentRunner = {
    name: "spy",
    healthy: async () => true,
    decide: async () => {
      called = true;
      return { reasoning: "x", actions: [] };
    },
  };
  const text = await narrate(runner, [{ type: "tick_started", tick: 1 }]);
  assert.equal(text, null);
  assert.equal(called, false);
});

test("narrate: reasoning vazio → null", async () => {
  const runner = fixedRunner({ reasoning: "   ", actions: [] });
  const text = await narrate(runner, [battleEvent]);
  assert.equal(text, null);
});

test("narrate: runner falha → null (nunca propaga a exceção)", async () => {
  const text = await narrate(throwingRunner(), [battleEvent]);
  assert.equal(text, null);
});
