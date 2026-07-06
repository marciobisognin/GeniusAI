import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "./world";
import { tick } from "./engine";
import { getStance } from "./rules";
import { CIV_IDS } from "./types";
import type { CivDecision, GameEvent, World } from "./types";

function findEvent<T extends GameEvent["type"]>(
  events: GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }> | undefined {
  return events.find((e) => e.type === type) as Extract<GameEvent, { type: T }> | undefined;
}

// ── Determinismo ────────────────────────────────────────────────────────────

test("createWorld: mesmo seed → mundo idêntico", () => {
  assert.deepStrictEqual(createWorld(123), createWorld(123));
});

test("createWorld: seeds diferentes → mundos diferentes", () => {
  assert.notDeepStrictEqual(createWorld(1), createWorld(2));
});

test("createWorld: invariantes iniciais", () => {
  const w = createWorld(99);
  assert.equal(w.tick, 0);
  for (const id of CIV_IDS) {
    const civ = w.civilizations[id];
    assert.ok(civ.alive);
    assert.equal(civ.cities.length, 1);
    assert.equal(civ.armies.length, 1);
  }
});

test("tick: determinístico para mesmas ações", () => {
  const w = createWorld(7);
  const decisions: CivDecision[] = [
    { civ: "rome", actions: [{ tool: "build", args: { structure: "farm", x: 1, y: 1 } }] },
    { civ: "greece", actions: [{ tool: "research", args: { technology: "agriculture" } }] },
  ];
  assert.deepStrictEqual(tick(w, decisions), tick(w, decisions));
});

test("tick: não muta o mundo de entrada", () => {
  const w = createWorld(7);
  const snapshot = structuredClone(w);
  tick(w, [{ civ: "rome", actions: [{ tool: "set_strategy", args: { note: "oi" } }] }]);
  assert.deepStrictEqual(w, snapshot);
});

test("tick: avança o contador e emite tick_started", () => {
  const w = createWorld(3);
  const next = tick(w, []);
  assert.equal(next.tick, 1);
  assert.ok(findEvent(next.events, "tick_started"));
});

// ── Construção ──────────────────────────────────────────────────────────────

test("build: constrói farm na cidade capital", () => {
  const w = createWorld(5);
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "build", args: { structure: "farm", x: 1, y: 1 } }] },
  ]);
  assert.ok(findEvent(next.events, "structure_built"));
  assert.ok(next.civilizations.rome.cities[0].buildings.includes("farm"));
});

test("build: ouro insuficiente é rejeitado", () => {
  const w = createWorld(5);
  w.civilizations.rome.resources.gold = 5;
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "build", args: { structure: "farm", x: 1, y: 1 } }] },
  ]);
  const rej = findEvent(next.events, "action_rejected");
  assert.ok(rej && rej.tool === "build");
  assert.equal(next.civilizations.rome.cities[0].buildings.length, 0);
});

test("build: cidade em tile não adjacente ao território é rejeitada", () => {
  const w = createWorld(5);
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "build", args: { structure: "city", x: 4, y: 4 } }] },
  ]);
  assert.ok(findEvent(next.events, "action_rejected"));
  assert.equal(next.civilizations.rome.cities.length, 1);
});

// ── Pesquisa ────────────────────────────────────────────────────────────────

test("research: conclui quando há ciência suficiente", () => {
  const w = createWorld(5);
  w.civilizations.greece.resources.science = 100;
  const next = tick(w, [
    { civ: "greece", actions: [{ tool: "research", args: { technology: "agriculture" } }] },
  ]);
  assert.ok(findEvent(next.events, "tech_researched"));
  assert.ok(next.civilizations.greece.tech.includes("agriculture"));
});

test("research: pré-requisito faltando é rejeitado", () => {
  const w = createWorld(5);
  const next = tick(w, [
    { civ: "greece", actions: [{ tool: "research", args: { technology: "writing" } }] },
  ]);
  const rej = findEvent(next.events, "action_rejected");
  assert.ok(rej && rej.tool === "research");
});

// ── Exércitos ───────────────────────────────────────────────────────────────

test("move_army: move para tile adjacente transponível", () => {
  const w = createWorld(5);
  w.map[1][2].terrain = "plains"; // garante que não é montanha
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "move_army", args: { armyId: "rome-army-1", x: 2, y: 1 } }] },
  ]);
  assert.ok(findEvent(next.events, "army_moved"));
  const army = next.civilizations.rome.armies[0];
  assert.deepEqual([army.x, army.y], [2, 1]);
});

test("move_army: destino não adjacente é rejeitado", () => {
  const w = createWorld(5);
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "move_army", args: { armyId: "rome-army-1", x: 4, y: 4 } }] },
  ]);
  assert.ok(findEvent(next.events, "action_rejected"));
});

test("attack: vitória captura a cidade inimiga (determinístico por força)", () => {
  const w = createWorld(5);
  // Reposiciona um exército forte de Roma ao lado da capital do Egito (6,1).
  w.civilizations.rome.armies[0] = { id: "rome-army-1", x: 5, y: 1, strength: 100 };
  const next = tick(w, [
    {
      civ: "rome",
      actions: [
        { tool: "set_diplomacy", args: { civ: "egypt", stance: "war" } },
        { tool: "attack", args: { armyId: "rome-army-1", x: 6, y: 1 } },
      ],
    },
  ]);
  const battle = findEvent(next.events, "battle");
  assert.ok(battle && battle.winner === "rome");
  assert.ok(findEvent(next.events, "city_captured"));
  assert.equal(next.civilizations.egypt.alive, false);
  assert.equal(next.civilizations.rome.cities.length, 2);
});

test("attack: sem estar em guerra é rejeitado", () => {
  const w = createWorld(5);
  w.civilizations.rome.armies[0] = { id: "rome-army-1", x: 5, y: 1, strength: 100 };
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "attack", args: { armyId: "rome-army-1", x: 6, y: 1 } }] },
  ]);
  assert.ok(findEvent(next.events, "action_rejected"));
  assert.ok(!findEvent(next.events, "battle"));
});

// ── Diplomacia e comércio ───────────────────────────────────────────────────

test("set_diplomacy: atualiza a relação par-a-par", () => {
  const w = createWorld(5);
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "set_diplomacy", args: { civ: "greece", stance: "war" } }] },
  ]);
  assert.equal(getStance(next, "rome", "greece"), "war");
  assert.ok(findEvent(next.events, "diplomacy_changed"));
});

test("trade: transfere recursos exatamente (isolando a economia)", () => {
  const base = createWorld(5);
  // Populações altas → limiar de crescimento inalcançável neste tick, para que
  // a economia seja idêntica nas duas rodadas e a diferença isole o trade.
  base.civilizations.rome.cities[0].population = 50;
  base.civilizations.egypt.cities[0].population = 50;
  // Controle: só define a relação de comércio.
  const control = tick(base, [
    { civ: "rome", actions: [{ tool: "set_diplomacy", args: { civ: "egypt", stance: "trade" } }] },
  ]);
  // Teste: mesma relação + um trade. A economia é idêntica nos dois → cancela.
  const traded = tick(base, [
    {
      civ: "rome",
      actions: [
        { tool: "set_diplomacy", args: { civ: "egypt", stance: "trade" } },
        { tool: "trade", args: { civ: "egypt", offer: { gold: 10 }, request: { food: 5 } } },
      ],
    },
  ]);
  assert.ok(findEvent(traded.events, "trade_executed"));
  const g = (w: World, id: "rome" | "egypt") => w.civilizations[id].resources;
  assert.equal(g(traded, "rome").gold, g(control, "rome").gold - 10);
  assert.equal(g(traded, "rome").food, g(control, "rome").food + 5);
  assert.equal(g(traded, "egypt").gold, g(control, "egypt").gold + 10);
  assert.equal(g(traded, "egypt").food, g(control, "egypt").food - 5);
});

test("trade: sem relação de comércio é rejeitado", () => {
  const w = createWorld(5);
  const next = tick(w, [
    {
      civ: "rome",
      actions: [{ tool: "trade", args: { civ: "egypt", offer: { gold: 1 }, request: { food: 1 } } }],
    },
  ]);
  const rej = findEvent(next.events, "action_rejected");
  assert.ok(rej && rej.tool === "trade");
});

// ── Memória e economia ──────────────────────────────────────────────────────

test("set_strategy: atualiza a memória da civilização", () => {
  const w = createWorld(5);
  const next = tick(w, [
    { civ: "mali", actions: [{ tool: "set_strategy", args: { note: "focar no comércio" } }] },
  ]);
  assert.ok(next.civilizations.mali.memory.includes("focar no comércio"));
  assert.ok(findEvent(next.events, "strategy_updated"));
});

test("economia: ouro acumula sem ações", () => {
  const w = createWorld(5);
  const before = w.civilizations.rome.resources.gold;
  const next = tick(w, []);
  assert.ok(next.civilizations.rome.resources.gold > before);
});

test("economia: cidade cresce com food suficiente", () => {
  const w = createWorld(5);
  w.civilizations.rome.resources.food = 1000;
  const popBefore = w.civilizations.rome.cities[0].population;
  const next = tick(w, []);
  assert.ok(findEvent(next.events, "city_grew"));
  assert.ok(next.civilizations.rome.cities[0].population > popBefore);
});
