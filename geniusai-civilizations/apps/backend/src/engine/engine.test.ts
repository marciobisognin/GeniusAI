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

test("attack: cidade capturada é marcada como ocupada (Fase 18, RF-14)", () => {
  const w = createWorld(5);
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
  const captured = next.civilizations.rome.cities.find((c) => c.id === "egypt-city-1");
  assert.ok(captured);
  assert.equal(captured!.occupied, true);
  // A capital original de Roma continua fundada, não ocupada.
  assert.notEqual(next.civilizations.rome.cities.find((c) => c.id === "rome-city-1")?.occupied, true);
});

test("move_army: entrar em território de um inimigo em guerra emite hostile_territory_entered (Fase 18, RF-14)", () => {
  const w = createWorld(5);
  w.civilizations.rome.armies[0] = { id: "rome-army-1", x: 5, y: 1, strength: 10 };
  const next = tick(w, [
    {
      civ: "rome",
      actions: [
        { tool: "set_diplomacy", args: { civ: "egypt", stance: "war" } },
        { tool: "move_army", args: { armyId: "rome-army-1", x: 6, y: 1 } },
      ],
    },
  ]);
  assert.ok(findEvent(next.events, "army_moved"));
  const entered = findEvent(next.events, "hostile_territory_entered");
  assert.ok(entered);
  assert.equal(entered!.owner, "egypt");
  assert.deepEqual([entered!.x, entered!.y], [6, 1]);
});

test("move_army: entrar em território próprio/neutro NÃO emite hostile_territory_entered", () => {
  const w = createWorld(5);
  w.map[1][2].terrain = "plains";
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "move_army", args: { armyId: "rome-army-1", x: 2, y: 1 } }] },
  ]);
  assert.ok(!findEvent(next.events, "hostile_territory_entered"));
});

test("retreat_army: recua para a cidade própria mais próxima, sem combate (Fase 18, RF-14)", () => {
  const w = createWorld(5);
  w.civilizations.rome.armies[0] = { id: "rome-army-1", x: 5, y: 1, strength: 10 };
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "retreat_army", args: { armyId: "rome-army-1" } }] },
  ]);
  const retreated = findEvent(next.events, "army_retreated");
  assert.ok(retreated);
  const capital = next.civilizations.rome.cities.find((c) => c.id === "rome-city-1")!;
  assert.deepEqual([retreated!.x, retreated!.y], [capital.x, capital.y]);
  const army = next.civilizations.rome.armies.find((a) => a.id === "rome-army-1")!;
  assert.deepEqual([army.x, army.y], [capital.x, capital.y]);
  // Recuo não é combate: força do exército não muda.
  assert.equal(army.strength, 10);
});

test("retreat_army: sem cidades próprias é rejeitado", () => {
  const w = createWorld(5);
  w.civilizations.rome.cities = [];
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "retreat_army", args: { armyId: "rome-army-1" } }] },
  ]);
  assert.ok(findEvent(next.events, "action_rejected"));
});

test("retreat_army: exército inexistente é rejeitado", () => {
  const w = createWorld(5);
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "retreat_army", args: { armyId: "não-existe" } }] },
  ]);
  assert.ok(findEvent(next.events, "action_rejected"));
});

// ── Manutenção de exércitos (Fase 18, §18 — RF-15/RF-16) ────────────────────

test("manutenção: com ouro suficiente, o custo é debitado a cada tick sem penalidade", () => {
  const w = createWorld(5);
  w.civilizations.rome.resources.gold = 100;
  const before = w.civilizations.rome.armies[0].strength;
  const next = tick(w, []);
  assert.ok(!findEvent(next.events, "army_upkeep_shortfall"));
  assert.equal(next.civilizations.rome.armies[0].strength, before);
  assert.equal(next.civilizations.rome.armies.length, 1);
});

test("manutenção: sem ouro suficiente, todos os exércitos perdem força (não trava a economia)", () => {
  const w = createWorld(5);
  w.civilizations.rome.resources.gold = 0;
  // 3 exércitos (upkeep=3) excedem o rendimento de ouro da capital (+2/tick)
  // — o cenário real de "sem ouro suficiente" que o teste quer exercitar.
  w.civilizations.rome.armies = [
    { id: "rome-army-1", x: 0, y: 0, strength: 10 },
    { id: "rome-army-2", x: 0, y: 0, strength: 10 },
    { id: "rome-army-3", x: 0, y: 0, strength: 10 },
  ];
  const next = tick(w, []);
  const shortfall = findEvent(next.events, "army_upkeep_shortfall");
  assert.ok(shortfall);
  assert.equal(shortfall!.armiesAffected, 3);
  assert.equal(next.civilizations.rome.resources.gold, 0);
  for (const army of next.civilizations.rome.armies) {
    assert.equal(army.strength, 9);
  }
});

test("manutenção: exército que chega a força 0 por falta de ouro é desfeito", () => {
  const w = createWorld(5);
  w.civilizations.rome.resources.gold = 0;
  w.civilizations.rome.armies = [
    { id: "rome-army-1", x: 0, y: 0, strength: 1 },
    { id: "rome-army-2", x: 0, y: 0, strength: 10 },
    { id: "rome-army-3", x: 0, y: 0, strength: 10 },
  ];
  const next = tick(w, []);
  const disbanded = findEvent(next.events, "army_disbanded");
  assert.ok(disbanded);
  assert.equal(disbanded!.armyId, "rome-army-1");
  assert.equal(next.civilizations.rome.armies.length, 2);
  assert.ok(next.civilizations.rome.armies.every((a) => a.strength === 9));
});

test("manutenção: civilização sem exércitos não gera eventos de manutenção", () => {
  const w = createWorld(5);
  w.civilizations.rome.armies = [];
  const next = tick(w, []);
  assert.ok(!findEvent(next.events, "army_upkeep_shortfall"));
});

// ── Névoa de guerra (Fase 20, §20 — RF-21) ──────────────────────────────────

test("fogOfWar=false: discovered não cresce a cada tick (sem custo, comportamento intocado)", () => {
  const w = createWorld(5, undefined, false);
  const before = { ...w.civilizations.rome.discovered };
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "move_army", args: { armyId: "rome-army-1", x: 2, y: 1 } }] },
  ]);
  assert.deepEqual(next.civilizations.rome.discovered, before);
});

test("fogOfWar=true: um exército em movimento revela território novo a cada tick", () => {
  const w = createWorld(5, undefined, true);
  w.map[1][2].terrain = "plains";
  assert.ok(!w.civilizations.rome.discovered["4,1"]); // longe demais da capital (1,1) ainda
  const next = tick(w, [
    { civ: "rome", actions: [{ tool: "move_army", args: { armyId: "rome-army-1", x: 2, y: 1 } }] },
  ]);
  // Depois do movimento p/ (2,1), o raio de descoberta alcança até (4,1).
  assert.ok(next.civilizations.rome.discovered["4,1"]);
});

test("fogOfWar=true: território descoberto nunca é esquecido (persiste mesmo sem unidades por perto depois)", () => {
  const w = createWorld(5, undefined, true);
  const afterReveal = tick(w, [
    { civ: "rome", actions: [{ tool: "move_army", args: { armyId: "rome-army-1", x: 2, y: 1 } }] },
  ]);
  assert.ok(afterReveal.civilizations.rome.discovered["4,1"]);
  // Recua de volta — o tile continua descoberto (sem névoa dinâmica nesta fase).
  const afterRetreat = tick(afterReveal, [
    { civ: "rome", actions: [{ tool: "retreat_army", args: { armyId: "rome-army-1" } }] },
  ]);
  assert.ok(afterRetreat.civilizations.rome.discovered["4,1"]);
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

// ── Comércio bilateral (proposta → aceite/rejeição, com expiração) ─────────

test("propose_trade: cria proposta pendente e NADA é transferido antes do aceite", () => {
  const base = createWorld(5);
  const control = tick(base, []);
  const proposed = tick(base, [
    {
      civ: "rome",
      actions: [{ tool: "propose_trade", args: { civ: "egypt", offer: { gold: 10 }, request: { food: 5 } } }],
    },
  ]);

  assert.ok(findEvent(proposed.events, "trade_proposed"));
  assert.equal(proposed.pendingProposals.length, 1);
  assert.equal(proposed.pendingProposals[0].from, "rome");
  assert.equal(proposed.pendingProposals[0].to, "egypt");
  assert.ok(!findEvent(proposed.events, "trade_executed"));
  // Economia idêntica ao controle: nenhum recurso mudou de mãos.
  assert.deepEqual(proposed.civilizations.rome.resources, control.civilizations.rome.resources);
  assert.deepEqual(proposed.civilizations.egypt.resources, control.civilizations.egypt.resources);
});

test("respond_proposal(accept): transfere exatamente os termos, no momento do aceite", () => {
  const base = createWorld(5);
  // Populações altas → limiar de crescimento inalcançável nestes ticks, para
  // que a economia seja idêntica nas duas rodadas e a diferença isole o trade.
  for (const id of ["rome", "egypt", "greece", "mali"] as const) {
    base.civilizations[id].cities[0].population = 50;
  }
  const withProposal = tick(base, [
    {
      civ: "rome",
      actions: [{ tool: "propose_trade", args: { civ: "egypt", offer: { gold: 10 }, request: { food: 5 } } }],
    },
  ]);
  const proposalId = withProposal.pendingProposals[0].id;

  const control = tick(withProposal, []);
  const accepted = tick(withProposal, [
    { civ: "egypt", actions: [{ tool: "respond_proposal", args: { proposalId, accept: true } }] },
  ]);

  assert.ok(findEvent(accepted.events, "proposal_accepted"));
  assert.ok(findEvent(accepted.events, "trade_executed"));
  assert.equal(accepted.pendingProposals.length, 0);
  const g = (w: World, id: "rome" | "egypt") => w.civilizations[id].resources;
  assert.equal(g(accepted, "rome").gold, g(control, "rome").gold - 10);
  assert.equal(g(accepted, "rome").food, g(control, "rome").food + 5);
  assert.equal(g(accepted, "egypt").gold, g(control, "egypt").gold + 10);
  assert.equal(g(accepted, "egypt").food, g(control, "egypt").food - 5);
});

test("respond_proposal(reject): consome a proposta sem transferir nada", () => {
  const base = createWorld(5);
  const withProposal = tick(base, [
    {
      civ: "rome",
      actions: [{ tool: "propose_trade", args: { civ: "egypt", offer: { gold: 10 }, request: { food: 5 } } }],
    },
  ]);
  const proposalId = withProposal.pendingProposals[0].id;

  const control = tick(withProposal, []);
  const rejected = tick(withProposal, [
    { civ: "egypt", actions: [{ tool: "respond_proposal", args: { proposalId, accept: false } }] },
  ]);

  assert.ok(findEvent(rejected.events, "proposal_rejected"));
  assert.ok(!findEvent(rejected.events, "trade_executed"));
  assert.equal(rejected.pendingProposals.length, 0);
  assert.deepEqual(rejected.civilizations.rome.resources, control.civilizations.rome.resources);
});

test("respond_proposal: só o destinatário pode responder", () => {
  const base = createWorld(5);
  const withProposal = tick(base, [
    {
      civ: "rome",
      actions: [{ tool: "propose_trade", args: { civ: "egypt", offer: { gold: 1 }, request: {} } }],
    },
  ]);
  const proposalId = withProposal.pendingProposals[0].id;

  const intruded = tick(withProposal, [
    { civ: "greece", actions: [{ tool: "respond_proposal", args: { proposalId, accept: true } }] },
  ]);
  const rej = findEvent(intruded.events, "action_rejected");
  assert.ok(rej && /não é endereçada/.test(String(rej.reason)));
  assert.equal(intruded.pendingProposals.length, 1, "a proposta continua pendente");
});

test("proposta expira após o TTL e responder depois falha explicitamente", () => {
  const base = createWorld(5);
  let w = tick(base, [
    {
      civ: "rome",
      actions: [{ tool: "propose_trade", args: { civ: "egypt", offer: { gold: 1 }, request: {} } }],
    },
  ]);
  const proposalId = w.pendingProposals[0].id;
  const expiresTick = w.pendingProposals[0].expiresTick;

  while (w.tick < expiresTick) w = tick(w, []);
  assert.equal(w.pendingProposals.length, 1, "válida até expiresTick, inclusive");

  w = tick(w, []); // primeiro tick após o prazo
  assert.equal(w.pendingProposals.length, 0);
  assert.ok(findEvent(w.events, "proposal_expired"));

  const late = tick(w, [
    { civ: "egypt", actions: [{ tool: "respond_proposal", args: { proposalId, accept: true } }] },
  ]);
  const rej = findEvent(late.events, "action_rejected");
  assert.ok(rej && /não encontrada ou expirada/.test(String(rej.reason)));
});

test("aceite revalida o presente: proponente que gastou a oferta não paga mais", () => {
  const base = createWorld(5);
  base.civilizations.rome.resources.gold = 55;
  const withProposal = tick(base, [
    {
      civ: "rome",
      actions: [{ tool: "propose_trade", args: { civ: "egypt", offer: { gold: 50 }, request: {} } }],
    },
  ]);
  const proposalId = withProposal.pendingProposals[0].id;
  // Roma torra o ouro antes do aceite.
  withProposal.civilizations.rome.resources.gold = 0;

  const accepted = tick(withProposal, [
    { civ: "egypt", actions: [{ tool: "respond_proposal", args: { proposalId, accept: true } }] },
  ]);
  const rej = findEvent(accepted.events, "action_rejected");
  assert.ok(rej && /proponente não pode mais pagar/.test(String(rej.reason)));
  assert.ok(!findEvent(accepted.events, "trade_executed"));
});

// ── Aliança bilateral ───────────────────────────────────────────────────────

test("aliança exige aceite: set_diplomacy(alliance) é rejeitado; propose+accept funciona", () => {
  const base = createWorld(5);

  const unilateral = tick(base, [
    { civ: "rome", actions: [{ tool: "set_diplomacy", args: { civ: "egypt", stance: "alliance" } }] },
  ]);
  const rej = findEvent(unilateral.events, "action_rejected");
  assert.ok(rej && /bilateral/.test(String(rej.reason)));
  assert.equal(getStance(unilateral, "rome", "egypt"), "peace");

  const proposed = tick(base, [
    { civ: "rome", actions: [{ tool: "propose_alliance", args: { civ: "egypt" } }] },
  ]);
  assert.ok(findEvent(proposed.events, "alliance_proposed"));
  const proposalId = proposed.pendingProposals[0].id;

  const allied = tick(proposed, [
    { civ: "egypt", actions: [{ tool: "respond_proposal", args: { proposalId, accept: true } }] },
  ]);
  assert.equal(getStance(allied, "rome", "egypt"), "alliance");
  assert.ok(findEvent(allied.events, "proposal_accepted"));
  assert.ok(findEvent(allied.events, "diplomacy_changed"));
});

test("declarar guerra invalida as propostas pendentes entre o par", () => {
  const base = createWorld(5);
  const withProposal = tick(base, [
    { civ: "rome", actions: [{ tool: "propose_alliance", args: { civ: "egypt" } }] },
  ]);
  assert.equal(withProposal.pendingProposals.length, 1);

  const war = tick(withProposal, [
    { civ: "egypt", actions: [{ tool: "set_diplomacy", args: { civ: "rome", stance: "war" } }] },
  ]);
  assert.equal(war.pendingProposals.length, 0);
  assert.ok(findEvent(war.events, "proposal_expired"));
});

test("propose_trade: em guerra é rejeitado", () => {
  const base = createWorld(5);
  const war = tick(base, [
    { civ: "rome", actions: [{ tool: "set_diplomacy", args: { civ: "egypt", stance: "war" } }] },
  ]);
  const next = tick(war, [
    {
      civ: "rome",
      actions: [{ tool: "propose_trade", args: { civ: "egypt", offer: { gold: 1 }, request: { food: 1 } } }],
    },
  ]);
  const rej = findEvent(next.events, "action_rejected");
  assert.ok(rej && rej.tool === "propose_trade");
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

// ── Fase 9: efeitos de tecnologia, recrutamento e vitória ───────────────────

test("tecnologia tem efeito real: agriculture rende +2 de alimento por cidade", () => {
  const base = createWorld(5);
  // População alta → sem crescimento consumindo food neste tick.
  base.civilizations.rome.cities[0].population = 50;
  const withTech = structuredClone(base);
  withTech.civilizations.rome.tech.push("agriculture");

  const plain = tick(base, []);
  const teched = tick(withTech, []);
  assert.equal(
    teched.civilizations.rome.resources.food,
    plain.civilizations.rome.resources.food + 2,
    "+2 de alimento pela tecnologia (1 cidade)",
  );
});

test("recruit: exige bronze_working e quartel; cria exército com bônus de força", () => {
  const base = createWorld(5);
  const rome = base.civilizations.rome;
  const cityId = rome.cities[0].id;
  rome.resources.gold = 200;

  // Sem tecnologia → rejeitado.
  const noTech = tick(base, [{ civ: "rome", actions: [{ tool: "recruit", args: { cityId } }] }]);
  let rej = findEvent(noTech.events, "action_rejected");
  assert.ok(rej && /bronze_working/.test(String(rej.reason)));

  // Com tecnologia mas sem quartel → rejeitado.
  base.civilizations.rome.tech.push("agriculture", "bronze_working");
  const noBarracks = tick(base, [{ civ: "rome", actions: [{ tool: "recruit", args: { cityId } }] }]);
  rej = findEvent(noBarracks.events, "action_rejected");
  assert.ok(rej && /quartel/.test(String(rej.reason)));

  // Com quartel → recruta, deduz ouro e aplica o bônus (+1 do bronze).
  base.civilizations.rome.cities[0].buildings.push("barracks");
  const before = base.civilizations.rome.armies.length;
  const recruited = tick(base, [{ civ: "rome", actions: [{ tool: "recruit", args: { cityId } }] }]);
  const ev = findEvent(recruited.events, "army_recruited");
  assert.ok(ev);
  assert.equal(ev!.strength, 6, "força base 5 + 1 do bronze_working");
  assert.equal(recruited.civilizations.rome.armies.length, before + 1);
});

test("vitória científica: dominar o catálogo inteiro encerra a partida", () => {
  const base = createWorld(5);
  base.civilizations.greece.tech = ["agriculture", "writing", "bronze_working", "currency", "mathematics"];

  const next = tick(base, []);
  assert.ok(next.victory);
  assert.equal(next.victory!.civ, "greece");
  assert.equal(next.victory!.kind, "scientific");
  assert.ok(findEvent(next.events, "victory"));

  // Partida encerrada é imutável: novos ticks não mudam nada.
  const frozen = tick(next, []);
  assert.equal(frozen.tick, next.tick);
  assert.deepEqual(frozen.victory, next.victory);
});

test("vitória por dominação: restar uma civilização encerra a partida", () => {
  const base = createWorld(5);
  for (const id of ["egypt", "greece", "mali"] as const) {
    base.civilizations[id].cities = [];
  }
  const next = tick(base, []);
  assert.equal(next.victory?.civ, "rome");
  assert.equal(next.victory?.kind, "domination");
});

test("vitória por prosperidade: reservas acima do limiar", () => {
  const base = createWorld(5);
  base.civilizations.mali.resources = { food: 200, gold: 200, science: 50 };
  const next = tick(base, []);
  assert.equal(next.victory?.civ, "mali");
  assert.equal(next.victory?.kind, "prosperity");
});

test("limite de turnos: vence a maior pontuação", () => {
  const base = createWorld(5);
  base.tick = 79;
  base.civilizations.egypt.tech = ["agriculture", "writing"]; // pontuação extra
  const next = tick(base, []);
  assert.equal(next.tick, 80);
  assert.equal(next.victory?.kind, "turn_limit");
  assert.equal(next.victory?.civ, "egypt");
});
