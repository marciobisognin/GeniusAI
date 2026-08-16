import assert from "node:assert/strict";
import test from "node:test";
import { MAX_TICKS, rehearse, validateInput, verifyDeterminism } from "./rehearsal.js";
import { createRehearsalServer } from "./server.js";

const SEED = 1234;

test("o ensaio é determinístico — mesma semente e mesmo plano, mesma assinatura", () => {
  const input = { seed: SEED, ticks: 3 };
  assert.equal(rehearse(input).signature, rehearse(input).signature);
});

test("sementes diferentes produzem ensaios diferentes", () => {
  const a = rehearse({ seed: SEED, ticks: 3 }).signature;
  const b = rehearse({ seed: SEED + 1, ticks: 3 }).signature;
  assert.notEqual(a, b);
});

test("mais ticks mudam o resultado", () => {
  const curto = rehearse({ seed: SEED, ticks: 1 });
  const longo = rehearse({ seed: SEED, ticks: 5 });
  assert.notEqual(curto.signature, longo.signature);
  assert.ok(longo.finalTick > curto.finalTick);
});

test("o plano muda a consequência", () => {
  const semPlano = rehearse({ seed: SEED, ticks: 3 });
  const comPlano = rehearse({
    seed: SEED,
    ticks: 3,
    plans: [{ civ: "rome", actions: [{ tool: "research", args: { technology: "agriculture" } }] }],
  });
  assert.notEqual(semPlano.signature, comPlano.signature);
  assert.deepEqual(comPlano.invalidas, [], "o plano precisa ser aceito pelo motor");
});

test("nome de argumento errado é reportado, não engolido", () => {
  // `research` recebe `technology`; quem escrever `tech` precisa descobrir
  // isso pelo ensaio, e não por um plano que silenciosamente não fez nada.
  const outcome = rehearse({
    seed: SEED,
    ticks: 1,
    plans: [{ civ: "rome", actions: [{ tool: "research", args: { tech: "agriculture" } }] }],
  });
  assert.equal(outcome.invalidas.length, 1);
  assert.match(outcome.invalidas[0], /rome/);
});

test("devolve o estado de cada civilização", () => {
  const outcome = rehearse({ seed: SEED, ticks: 2 });
  assert.equal(outcome.civilizations.length, 4);
  for (const civ of outcome.civilizations) {
    assert.ok(civ.id);
    assert.ok(typeof civ.viva === "boolean");
    assert.ok(typeof civ.cidades === "number");
  }
});

test("conta os eventos por tipo — a consequência observável", () => {
  const outcome = rehearse({ seed: SEED, ticks: 2 });
  assert.ok(Object.keys(outcome.eventos).length > 0);
  assert.ok(outcome.eventos.tick_started >= 1);
});

test("ação malformada não derruba o ensaio — vira aviso", () => {
  const outcome = rehearse({
    seed: SEED,
    ticks: 1,
    plans: [{ civ: "rome", actions: [{ tool: "inexistente", args: {} }, "nem é objeto"] }],
  });
  assert.ok(outcome.invalidas.length > 0, "as ações inválidas precisam ser reportadas");
  assert.ok(outcome.signature);
});

test("ação válida mas impossível é recusada pelo motor, com motivo", () => {
  const outcome = rehearse({
    seed: SEED,
    ticks: 1,
    // Construir fora do mapa: a ação é bem formada, mas o motor recusa.
    plans: [{ civ: "rome", actions: [{ tool: "build", args: { structure: "barracks", x: 999, y: 999 } }] }],
  });
  assert.ok(outcome.recusadas.length > 0 || outcome.eventos.action_rejected >= 1);
});

test("o aviso sobre o domínio viaja junto do resultado", () => {
  const outcome = rehearse({ seed: SEED, ticks: 1 });
  assert.match(outcome.aviso, /não são previsão sobre o mundo real/);
});

test("entradas inválidas são recusadas antes de simular", () => {
  const casos = [
    { seed: -1, ticks: 1 },
    { seed: 1.5, ticks: 1 },
    { seed: 1, ticks: 0 },
    { seed: 1, ticks: MAX_TICKS + 1 },
    { seed: 1, ticks: 2.5 },
  ];
  for (const caso of casos) {
    assert.throws(() => validateInput(caso as never), Error, JSON.stringify(caso));
  }
});

test("verificação de reprodutibilidade responde match e mismatch", () => {
  const input = { seed: SEED, ticks: 3 };
  const original = rehearse(input);
  assert.equal(verifyDeterminism(input, original.signature).status, "match");
  assert.equal(verifyDeterminism(input, "assinatura-errada").status, "mismatch");
});

test("o servidor MCP registra as ferramentas sem levantar", () => {
  assert.ok(createRehearsalServer());
});
