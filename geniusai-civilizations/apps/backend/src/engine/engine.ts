import { Rng } from "./rng";
import {
  CITY_BASE_YIELD,
  PROPOSAL_TTL_TICKS,
  RESOURCE_YIELDS,
  STRUCTURES,
  TECHS,
  TERRAIN_YIELDS,
  addInto,
  canAfford,
  getStance,
  growthCost,
  inBounds,
  isAdjacent,
  neighbors,
  setStance,
  subInto,
} from "./rules";
import { CIV_IDS } from "./types";
import type {
  Action,
  CivDecision,
  CivId,
  Civilization,
  GameEvent,
  Proposal,
  Resources,
  World,
} from "./types";

/**
 * Avança a simulação em um tick, de forma **determinística**:
 * mesmo `world` + mesmas `decisions` → mesmo próximo `world`.
 *
 * Pipeline: aplicar ações (ordem fixa) → economia → checar eliminação.
 * A não-determinância vem apenas das decisões dos agentes (fora daqui).
 */
export function tick(world: World, decisions: CivDecision[]): World {
  const w: World = structuredClone(world);
  const rng = new Rng(w.rngState);
  const events: GameEvent[] = [{ type: "tick_started", tick: w.tick + 1 }];

  // Propostas cujo prazo venceu expiram ANTES das ações deste tick —
  // uma resposta baseada em um snapshot antigo falha de forma explícita.
  const nextTick = w.tick + 1;
  w.pendingProposals = w.pendingProposals.filter((p) => {
    if (nextTick <= p.expiresTick) return true;
    events.push({ type: "proposal_expired", from: p.from, to: p.to, kind: p.kind, proposalId: p.id });
    return false;
  });

  // Ordem determinística: civs por id, ações na ordem informada.
  const ordered = [...decisions].sort((a, b) => a.civ.localeCompare(b.civ));
  for (const decision of ordered) {
    const civ = w.civilizations[decision.civ];
    if (!civ || !civ.alive) continue;
    for (const action of decision.actions) {
      applyAction(w, civ, action, rng, events);
    }
  }

  // Passo econômico determinístico.
  for (const id of CIV_IDS) {
    const civ = w.civilizations[id];
    if (civ.alive) economyStep(w, civ, events);
  }

  // Eliminação: civilização sem cidades sai do jogo.
  for (const id of CIV_IDS) {
    const civ = w.civilizations[id];
    if (civ.alive && civ.cities.length === 0) {
      civ.alive = false;
      events.push({ type: "civ_eliminated", civ: id });
    }
  }

  w.tick += 1;
  w.rngState = rng.state;
  w.events = events;
  return w;
}

function applyAction(
  w: World,
  civ: Civilization,
  action: Action,
  rng: Rng,
  events: GameEvent[],
): void {
  const reject = (reason: string): void => {
    events.push({ type: "action_rejected", civ: civ.id, tool: action.tool, reason });
  };

  switch (action.tool) {
    case "build": {
      const { structure, x, y } = action.args;
      const spec = STRUCTURES[structure];
      if (!spec) return reject(`estrutura desconhecida: ${structure}`);
      if (!inBounds(w, x, y)) return reject("fora do mapa");
      const tile = w.map[y][x];

      if (structure === "city") {
        if (tile.owner !== null) return reject("tile já ocupado");
        const adjToOwn = neighbors(w, x, y).some((t) => t.owner === civ.id);
        if (!adjToOwn) return reject("cidade deve ser adjacente ao seu território");
      } else {
        if (tile.owner !== civ.id) return reject("tile não pertence a você");
        const hasCity = civ.cities.some((c) => c.x === x && c.y === y);
        if (!hasCity) return reject("construa estruturas em uma cidade");
      }

      if (civ.resources.gold < spec.gold) return reject("ouro insuficiente");
      civ.resources.gold -= spec.gold;

      if (structure === "city") {
        tile.owner = civ.id;
        civ.cities.push({
          id: `${civ.id}-city-${civ.cities.length + 1}`,
          x,
          y,
          population: 1,
          buildings: [],
        });
        for (const n of neighbors(w, x, y)) {
          if (n.owner === null) {
            n.owner = civ.id;
            events.push({ type: "tile_claimed", civ: civ.id, x: n.x, y: n.y });
          }
        }
      } else {
        const city = civ.cities.find((c) => c.x === x && c.y === y)!;
        city.buildings.push(structure);
      }
      events.push({ type: "structure_built", civ: civ.id, structure, x, y });
      return;
    }

    case "research": {
      const tech = action.args.technology;
      const spec = TECHS[tech];
      if (!spec) return reject(`tecnologia desconhecida: ${tech}`);
      if (civ.tech.includes(tech)) return reject("tecnologia já pesquisada");
      if (!spec.requires.every((r) => civ.tech.includes(r))) {
        return reject("pré-requisitos faltando");
      }
      civ.researching = tech;
      events.push({ type: "research_started", civ: civ.id, technology: tech });
      return;
    }

    case "move_army": {
      const { armyId, x, y } = action.args;
      const army = civ.armies.find((a) => a.id === armyId);
      if (!army) return reject("exército não encontrado");
      if (!inBounds(w, x, y)) return reject("fora do mapa");
      if (!isAdjacent(army.x, army.y, x, y)) return reject("destino não adjacente");
      if (w.map[y][x].terrain === "mountain") return reject("montanha intransponível");
      army.x = x;
      army.y = y;
      events.push({ type: "army_moved", civ: civ.id, armyId, x, y });
      return;
    }

    case "attack": {
      const { armyId, x, y } = action.args;
      const army = civ.armies.find((a) => a.id === armyId);
      if (!army) return reject("exército não encontrado");
      if (!isAdjacent(army.x, army.y, x, y)) return reject("alvo não adjacente");

      const defender = findDefender(w, x, y, civ.id);
      if (!defender) return reject("nada para atacar neste tile");
      if (getStance(w, civ.id, defender.id) !== "war") {
        return reject("é preciso estar em guerra para atacar");
      }

      const defArmies = defender.armies.filter((a) => a.x === x && a.y === y);
      const defCity = defender.cities.find((c) => c.x === x && c.y === y);
      const defStrength =
        defArmies.reduce((s, a) => s + a.strength, 0) + (defCity ? defCity.population * 2 : 0);

      const atkRoll = army.strength * (0.75 + rng.next() * 0.5);
      const defRoll = defStrength * (0.75 + rng.next() * 0.5);
      const attackerWins = atkRoll >= defRoll;
      const winner = attackerWins ? civ.id : defender.id;
      events.push({ type: "battle", attacker: civ.id, defender: defender.id, x, y, winner });

      if (attackerWins) {
        defender.armies = defender.armies.filter((a) => !(a.x === x && a.y === y));
        if (defCity) {
          defender.cities = defender.cities.filter((c) => c.id !== defCity.id);
          defCity.population = Math.max(1, Math.floor(defCity.population / 2));
          civ.cities.push(defCity);
          w.map[y][x].owner = civ.id;
          events.push({ type: "city_captured", from: defender.id, to: civ.id, cityId: defCity.id });
        }
        army.x = x;
        army.y = y;
        army.strength = Math.max(1, army.strength - 1);
      } else {
        army.strength -= 2;
        if (army.strength <= 0) civ.armies = civ.armies.filter((a) => a.id !== army.id);
      }
      return;
    }

    case "set_diplomacy": {
      const { civ: other, stance } = action.args;
      if (other === civ.id) return reject("não é possível mudar diplomacia consigo");
      if (!(CIV_IDS as readonly string[]).includes(other)) return reject("civilização inválida");
      if (stance === "alliance") {
        return reject("aliança é bilateral: use propose_alliance e aguarde o aceite");
      }
      setStance(w, civ.id, other, stance);
      // Declarar guerra invalida as propostas pendentes entre o par.
      if (stance === "war") {
        w.pendingProposals = w.pendingProposals.filter((p) => {
          const between = (p.from === civ.id && p.to === other) || (p.from === other && p.to === civ.id);
          if (!between) return true;
          events.push({ type: "proposal_expired", from: p.from, to: p.to, kind: p.kind, proposalId: p.id });
          return false;
        });
      }
      events.push({ type: "diplomacy_changed", a: civ.id, b: other, stance });
      return;
    }

    case "propose_trade": {
      const { civ: other, offer, request } = action.args;
      if (other === civ.id) return reject("não é possível comerciar consigo");
      // Defesa em profundidade: quantias negativas inverteriam a transferência
      // e não-finitas corromperiam a economia — revalida mesmo após o schema.
      const amounts = [...Object.values(offer), ...Object.values(request)];
      if (amounts.some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
        return reject("quantias de comércio devem ser números finitos e não-negativos");
      }
      const partner = w.civilizations[other];
      if (!partner || !partner.alive) return reject("parceiro indisponível");
      if (getStance(w, civ.id, other) === "war") return reject("não se comercia em guerra");
      if (!canAfford(civ.resources, offer)) return reject("você não pode pagar a oferta");
      if (w.pendingProposals.some((p) => p.kind === "trade" && p.from === civ.id && p.to === other)) {
        return reject("já existe uma proposta de comércio sua pendente para essa civilização");
      }

      const proposal = createProposal(w, "trade", civ.id, other, { offer, request });
      events.push({
        type: "trade_proposed",
        civ: civ.id,
        to: other,
        proposalId: proposal.id,
        offer,
        request,
      });
      return;
    }

    case "propose_alliance": {
      const other = action.args.civ;
      if (other === civ.id) return reject("não é possível aliar-se consigo");
      if (!(CIV_IDS as readonly string[]).includes(other)) return reject("civilização inválida");
      const partner = w.civilizations[other];
      if (!partner || !partner.alive) return reject("parceiro indisponível");
      if (getStance(w, civ.id, other) === "alliance") return reject("vocês já são aliados");
      if (getStance(w, civ.id, other) === "war") return reject("faça a paz antes de propor aliança");
      if (w.pendingProposals.some((p) => p.kind === "alliance" && p.from === civ.id && p.to === other)) {
        return reject("já existe uma proposta de aliança sua pendente para essa civilização");
      }

      const proposal = createProposal(w, "alliance", civ.id, other);
      events.push({ type: "alliance_proposed", civ: civ.id, to: other, proposalId: proposal.id });
      return;
    }

    case "respond_proposal": {
      const { proposalId, accept } = action.args;
      const proposal = w.pendingProposals.find((p) => p.id === proposalId);
      if (!proposal) return reject(`proposta não encontrada ou expirada: ${proposalId}`);
      if (proposal.to !== civ.id) return reject("essa proposta não é endereçada a você");

      // A resposta consome a proposta, aceita ou não.
      w.pendingProposals = w.pendingProposals.filter((p) => p.id !== proposalId);

      if (!accept) {
        events.push({
          type: "proposal_rejected",
          civ: civ.id,
          from: proposal.from,
          kind: proposal.kind,
          proposalId,
        });
        return;
      }

      const proposer = w.civilizations[proposal.from];
      if (!proposer.alive) return reject("o proponente não existe mais");

      if (proposal.kind === "alliance") {
        if (getStance(w, civ.id, proposal.from) === "war") {
          return reject("guerra declarada depois da proposta — aliança impossível");
        }
        setStance(w, civ.id, proposal.from, "alliance");
        events.push({ type: "proposal_accepted", civ: civ.id, from: proposal.from, kind: "alliance", proposalId });
        events.push({ type: "diplomacy_changed", a: proposal.from, b: civ.id, stance: "alliance" });
        return;
      }

      // Comércio: as condições são revalidadas NO MOMENTO DO ACEITE — o
      // mundo pode ter mudado desde a proposta.
      const offer = proposal.offer ?? {};
      const request = proposal.request ?? {};
      if (getStance(w, civ.id, proposal.from) === "war") {
        return reject("guerra declarada depois da proposta — comércio impossível");
      }
      if (!canAfford(proposer.resources, offer)) {
        return reject("o proponente não pode mais pagar a oferta");
      }
      if (!canAfford(civ.resources, request)) {
        return reject("você não pode pagar o que foi pedido");
      }

      subInto(proposer.resources, offer);
      addInto(civ.resources, offer);
      subInto(civ.resources, request);
      addInto(proposer.resources, request);
      events.push({ type: "proposal_accepted", civ: civ.id, from: proposal.from, kind: "trade", proposalId });
      events.push({ type: "trade_executed", from: proposal.from, to: civ.id });
      return;
    }

    case "set_strategy": {
      civ.memory = civ.memory ? `${civ.memory}\n${action.args.note}` : action.args.note;
      events.push({ type: "strategy_updated", civ: civ.id });
      return;
    }
  }
}

/** Cria e registra uma proposta com id determinístico e prazo de expiração. */
function createProposal(
  w: World,
  kind: "trade" | "alliance",
  from: CivId,
  to: CivId,
  terms: { offer?: Partial<Resources>; request?: Partial<Resources> } = {},
): Proposal {
  const nextTick = w.tick + 1;
  const proposal: Proposal = {
    id: `prop-${nextTick}-${kind}-${from}-${to}`,
    kind,
    from,
    to,
    createdTick: nextTick,
    expiresTick: nextTick + PROPOSAL_TTL_TICKS,
    ...terms,
  };
  w.pendingProposals.push(proposal);
  return proposal;
}

function findDefender(w: World, x: number, y: number, exclude: CivId): Civilization | null {
  for (const id of CIV_IDS) {
    if (id === exclude) continue;
    const civ = w.civilizations[id];
    if (!civ.alive) continue;
    const hasArmy = civ.armies.some((a) => a.x === x && a.y === y);
    const hasCity = civ.cities.some((c) => c.x === x && c.y === y);
    if (hasArmy || hasCity) return civ;
  }
  return null;
}

function economyStep(w: World, civ: Civilization, events: GameEvent[]): void {
  const income: Resources = { food: 0, gold: 0, science: 0 };

  // Rendimento dos tiles do território.
  for (const row of w.map) {
    for (const tile of row) {
      if (tile.owner !== civ.id) continue;
      addInto(income, TERRAIN_YIELDS[tile.terrain]);
      if (tile.resource) addInto(income, RESOURCE_YIELDS[tile.resource]);
    }
  }

  // Rendimento das cidades e edifícios.
  for (const city of civ.cities) {
    addInto(income, CITY_BASE_YIELD);
    for (const b of city.buildings) {
      const spec = STRUCTURES[b];
      if (spec?.yields) addInto(income, spec.yields);
    }
  }

  addInto(civ.resources, income);

  // Crescimento populacional (consome food).
  for (const city of civ.cities) {
    const cost = growthCost(city.population);
    if (civ.resources.food >= cost) {
      civ.resources.food -= cost;
      city.population += 1;
      events.push({ type: "city_grew", civ: civ.id, cityId: city.id, population: city.population });
    }
  }

  // Conclusão de pesquisa.
  if (civ.researching) {
    const spec = TECHS[civ.researching];
    if (spec && civ.resources.science >= spec.cost) {
      civ.resources.science -= spec.cost;
      civ.tech.push(civ.researching);
      events.push({ type: "tech_researched", civ: civ.id, technology: civ.researching });
      civ.researching = null;
    }
  }
}
