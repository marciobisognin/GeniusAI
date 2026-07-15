import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CIVILIZATIONS, civilizationPersonaText } from "@geniusai/shared";
import { createWorld } from "./world";

test("createWorld: sem definitions usa o catálogo padrão (DEFAULT_CIVILIZATIONS)", () => {
  const w = createWorld(5);
  for (const id of ["rome", "egypt", "greece", "mali"] as const) {
    assert.equal(w.civilizations[id].persona, civilizationPersonaText(DEFAULT_CIVILIZATIONS[id]));
    assert.deepEqual(w.civilizations[id].resources, DEFAULT_CIVILIZATIONS[id].startingResources);
    assert.deepEqual(w.civilizations[id].tech, DEFAULT_CIVILIZATIONS[id].startingTechnologies);
  }
});

test("createWorld: definitions customizadas mudam persona/recursos/tecnologia iniciais", () => {
  const customRome = {
    ...DEFAULT_CIVILIZATIONS.rome,
    personality: ["Pacifista", "isolacionista"],
    startingResources: { food: 100, gold: 5, science: 20 },
    startingTechnologies: ["agriculture"],
  };
  const definitions = { ...DEFAULT_CIVILIZATIONS, rome: customRome };
  const w = createWorld(5, definitions);

  assert.equal(w.civilizations.rome.persona, civilizationPersonaText(customRome));
  assert.deepEqual(w.civilizations.rome.resources, { food: 100, gold: 5, science: 20 });
  assert.deepEqual(w.civilizations.rome.tech, ["agriculture"]);
  // Demais civilizações continuam com o padrão — a customização é isolada.
  assert.deepEqual(w.civilizations.egypt.resources, DEFAULT_CIVILIZATIONS.egypt.startingResources);
});

test("createWorld: determinístico também com definitions customizadas (mesma seed + mesmas defs)", () => {
  const definitions = {
    ...DEFAULT_CIVILIZATIONS,
    mali: { ...DEFAULT_CIVILIZATIONS.mali, startingResources: { food: 1, gold: 1, science: 1 } },
  };
  assert.deepStrictEqual(createWorld(9, definitions), createWorld(9, definitions));
});

// ── Névoa de guerra (Fase 20, §20 — RF-21/RF-22) ────────────────────────────

test("createWorld: fogOfWar=false (padrão) — discovered existe mas fica sem efeito", () => {
  const w = createWorld(5);
  assert.equal(w.fogOfWar, false);
  // A capital revela ao redor mesmo sem fogOfWar ativo (dado consistente,
  // só não é aplicado em nenhum filtro enquanto a flag estiver desligada).
  assert.ok(w.civilizations.rome.discovered["1,1"]);
});

test("createWorld: fogOfWar=true — cada civilização começa revelando só ao redor da própria capital", () => {
  const w = createWorld(5, undefined, true);
  assert.equal(w.fogOfWar, true);
  assert.ok(w.civilizations.rome.discovered["1,1"]); // capital de Roma
  assert.ok(!w.civilizations.rome.discovered["6,1"]); // capital do Egito, longe demais
});
