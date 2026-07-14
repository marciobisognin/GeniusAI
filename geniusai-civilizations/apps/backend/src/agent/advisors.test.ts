import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../engine/world";
import { consultAdvisor, consultAdvisors } from "./advisors";
import type { AgentDecision, AgentRunner, DecideInput } from "./AgentRunner";

function scriptedRunner(reasoningByCall: string[]): AgentRunner {
  let i = 0;
  return {
    name: "scripted",
    healthy: async () => true,
    decide: async () => {
      const reasoning = reasoningByCall[i] ?? reasoningByCall[reasoningByCall.length - 1];
      i += 1;
      return { reasoning, actions: [] };
    },
  };
}

function capturingRunner(decision: AgentDecision, inputs: DecideInput[] = []): AgentRunner {
  return {
    name: "capturing",
    healthy: async () => true,
    decide: async (input) => {
      inputs.push(input);
      return decision;
    },
  };
}

function throwingRunner(): AgentRunner {
  return {
    name: "boom",
    healthy: async () => true,
    decide: async () => {
      throw new Error("timeout");
    },
  };
}

test("consultAdvisor: extrai confiança do prefixo convencionado", async () => {
  const w = createWorld(5);
  const runner = scriptedRunner(["[high]: recrute mais um exército antes de atacar."]);
  const rec = await consultAdvisor(w, "rome", "military", runner);
  assert.ok(rec);
  assert.equal(rec.role, "military");
  assert.equal(rec.confidence, "high");
  assert.equal(rec.recommendation, "recrute mais um exército antes de atacar.");
});

test("consultAdvisor: sem prefixo de confiança reconhecível, cai para 'medium'", async () => {
  const w = createWorld(5);
  const runner = scriptedRunner(["invista em agricultura o quanto antes"]);
  const rec = await consultAdvisor(w, "rome", "economic", runner);
  assert.ok(rec);
  assert.equal(rec.confidence, "medium");
  assert.equal(rec.recommendation, "invista em agricultura o quanto antes");
});

test("consultAdvisor: reasoning vazio não produz recomendação", async () => {
  const w = createWorld(5);
  const runner = scriptedRunner([""]);
  const rec = await consultAdvisor(w, "rome", "diplomatic", runner);
  assert.equal(rec, null);
});

test("consultAdvisor: falha do runner (timeout/exceção) nunca lança — vira null", async () => {
  const w = createWorld(5);
  const rec = await consultAdvisor(w, "rome", "scientific", throwingRunner());
  assert.equal(rec, null);
});

test("consultAdvisor: recomendação muito longa é truncada a 280 caracteres", async () => {
  const w = createWorld(5);
  const long = "x".repeat(500);
  const runner = scriptedRunner([`[low]: ${long}`]);
  const rec = await consultAdvisor(w, "rome", "historian", runner);
  assert.ok(rec);
  assert.ok(rec.recommendation.length <= 280);
});

test("consultAdvisors: roda todos os papéis ativos, preserva a ordem e ignora duplicatas", async () => {
  const w = createWorld(5);
  const runner = scriptedRunner(["[high]: A", "[low]: B"]);
  const recs = await consultAdvisors(w, "rome", ["military", "military", "economic"], runner);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].role, "military");
  assert.equal(recs[1].role, "economic");
});

test("consultAdvisors: um conselheiro falhando não derruba os demais", async () => {
  const w = createWorld(5);
  let calls = 0;
  const runner: AgentRunner = {
    name: "half-broken",
    healthy: async () => true,
    decide: async () => {
      calls += 1;
      if (calls === 1) throw new Error("fora do ar");
      return { reasoning: "[medium]: siga em frente", actions: [] };
    },
  };
  const recs = await consultAdvisors(w, "rome", ["military", "economic"], runner);
  assert.equal(recs.length, 1);
});

test("consultAdvisors: lista vazia não chama o runner", async () => {
  const w = createWorld(5);
  const inputs: DecideInput[] = [];
  const recs = await consultAdvisors(w, "rome", [], capturingRunner({ reasoning: "ok", actions: [] }, inputs));
  assert.deepEqual(recs, []);
  assert.equal(inputs.length, 0);
});

test("consultAdvisor: o recorte do conselheiro militar não inclui o catálogo de tecnologias", async () => {
  const w = createWorld(5);
  const inputs: DecideInput[] = [];
  await consultAdvisor(w, "rome", "military", capturingRunner({ reasoning: "[medium]: ok", actions: [] }, inputs));
  assert.ok(!inputs[0].user.includes("mathematics"), "o snapshot militar vazou o catálogo de tecnologias");
});

test("consultAdvisor: o recorte do conselheiro científico não inclui posições de exército", async () => {
  const w = createWorld(5);
  const inputs: DecideInput[] = [];
  await consultAdvisor(w, "rome", "scientific", capturingRunner({ reasoning: "[medium]: ok", actions: [] }, inputs));
  assert.ok(!inputs[0].user.includes(`"armies"`), "o snapshot científico vazou posições de exército");
});

test("consultAdvisor: usa o override de modelo repassado", async () => {
  const w = createWorld(5);
  const inputs: DecideInput[] = [];
  await consultAdvisor(
    w,
    "rome",
    "diplomatic",
    capturingRunner({ reasoning: "[medium]: ok", actions: [] }, inputs),
    { model: "qwen2.5:14b" },
  );
  assert.equal(inputs[0].model, "qwen2.5:14b");
});
