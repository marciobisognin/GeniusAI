import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../engine/world";
import { buildSystemPrompt, buildTurnPrompt, snapshotForCiv } from "./prompt";

test("buildSystemPrompt inclui persona e todas as ações", () => {
  const s = buildSystemPrompt("Expansionista e militarista.", "rome");
  assert.ok(s.includes("Expansionista e militarista."));
  assert.ok(s.includes("rome"));
  for (const tool of ["build", "research", "move_army", "attack", "set_diplomacy", "trade", "set_strategy"]) {
    assert.ok(s.includes(tool), `prompt de sistema não menciona "${tool}"`);
  }
});

test("snapshotForCiv traz o próprio estado, os outros e o catálogo", () => {
  const w = createWorld(5);
  const snap = snapshotForCiv(w, "rome");
  assert.equal(snap.you.id, "rome");
  assert.ok(snap.you.resources.gold >= 0);
  assert.equal(snap.others.length, 3);
  assert.ok(snap.catalog.structures.length > 0);
  assert.ok(snap.catalog.techs.length > 0);
});

test("buildTurnPrompt menciona o tick e o formato de resposta", () => {
  const w = createWorld(5);
  const p = buildTurnPrompt(w, "rome");
  assert.ok(p.includes(`tick ${w.tick}`));
  assert.ok(p.includes(`"reasoning"`));
});

test("buildTurnPrompt: sem conselheiros, não menciona o conselho da corte", () => {
  const w = createWorld(5);
  const p = buildTurnPrompt(w, "rome");
  assert.ok(!p.includes("Conselho da corte"));
});

test("buildTurnPrompt: com recomendações, inclui a seção 'Conselho da corte' (Fase 14)", () => {
  const w = createWorld(5);
  const p = buildTurnPrompt(w, "rome", [
    { role: "military", recommendation: "recrute mais um exército", confidence: "high" },
  ]);
  assert.ok(p.includes("Conselho da corte"));
  assert.ok(p.includes("recrute mais um exército"));
  assert.ok(p.includes("military"));
});

// ── Névoa de guerra (Fase 20, §20 — RF-21) ──────────────────────────────────

test("snapshotForCiv: sem fogOfWar, others[].cities/armies mostram tudo (visão global preservada)", () => {
  const w = createWorld(5, undefined, false);
  const snap = snapshotForCiv(w, "rome");
  const egypt = snap.others.find((o) => o.id === "egypt")!;
  assert.equal(egypt.cities.length, 1);
  assert.equal(egypt.armies.length, 1);
});

test("snapshotForCiv: com fogOfWar, cidades/exércitos não descobertos de outra civilização ficam ocultos", () => {
  const w = createWorld(5, undefined, true);
  const snap = snapshotForCiv(w, "rome");
  const egypt = snap.others.find((o) => o.id === "egypt")!;
  // Roma nunca viu a capital do Egito (longe demais do raio de descoberta inicial).
  assert.equal(egypt.cities.length, 0);
  assert.equal(egypt.armies.length, 0);
  // Identidade/diplomacia/contagem de tecnologias continuam visíveis — não é reconhecimento militar.
  assert.equal(egypt.id, "egypt");
  assert.equal(egypt.alive, true);
});

test("snapshotForCiv: com fogOfWar, um tile descoberto revela a cidade/exército que está nele", () => {
  const w = createWorld(5, undefined, true);
  w.civilizations.rome.discovered["6,1"] = true; // capital do Egito
  const snap = snapshotForCiv(w, "rome");
  const egypt = snap.others.find((o) => o.id === "egypt")!;
  assert.equal(egypt.cities.length, 1);
  assert.equal(egypt.armies.length, 1);
});

test("segurança (§7.6): snapshotForCiv nunca vaza a memória privada de outra civilização", () => {
  const w = createWorld(5);
  w.civilizations.egypt.memory = "SEGREDO-DE-ESTADO-DO-EGITO-42";
  const snap = snapshotForCiv(w, "rome");
  const serialized = JSON.stringify(snap);
  assert.ok(!serialized.includes("SEGREDO-DE-ESTADO-DO-EGITO-42"), "a memória do Egito vazou para Roma");
  // A civilização ainda deve ver a PRÓPRIA memória normalmente.
  w.civilizations.rome.memory = "minha estratégia";
  const ownSnap = snapshotForCiv(w, "rome");
  assert.equal(ownSnap.you.memory, "minha estratégia");
});
