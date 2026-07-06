import { Rng } from "./rng";
import {
  CITY_BASE_YIELD,
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
      setStance(w, civ.id, other, stance);
      events.push({ type: "diplomacy_changed", a: civ.id, b: other, stance });
      return;
    }

    case "trade": {
      const { civ: other, offer, request } = action.args;
      if (other === civ.id) return reject("não é possível comerciar consigo");
      const partner = w.civilizations[other];
      if (!partner || !partner.alive) return reject("parceiro indisponível");
      const stance = getStance(w, civ.id, other);
      if (stance !== "trade" && stance !== "alliance") {
        return reject("é preciso relação de comércio ou aliança");
      }
      if (!canAfford(civ.resources, offer)) return reject("você não pode pagar a oferta");
      if (!canAfford(partner.resources, request)) return reject("parceiro não pode pagar o pedido");

      subInto(civ.resources, offer);
      addInto(partner.resources, offer);
      subInto(partner.resources, request);
      addInto(civ.resources, request);
      events.push({ type: "trade_executed", from: civ.id, to: other });
      return;
    }

    case "set_strategy": {
      civ.memory = civ.memory ? `${civ.memory}\n${action.args.note}` : action.args.note;
      events.push({ type: "strategy_updated", civ: civ.id });
      return;
    }
  }
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
