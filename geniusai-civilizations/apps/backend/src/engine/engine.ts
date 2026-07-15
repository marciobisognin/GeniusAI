import { Rng } from "./rng";
import {
  ARMY_UPKEEP_GOLD,
  CITY_BASE_YIELD,
  DISCOVERY_RADIUS,
  PROPOSAL_TTL_TICKS,
  PROSPERITY_THRESHOLD,
  RECRUIT_GOLD_COST,
  RESOURCE_YIELDS,
  STRUCTURES,
  TECHS,
  TERRAIN_YIELDS,
  TURN_LIMIT,
  addInto,
  canAfford,
  canRecruit,
  civScore,
  getStance,
  growthCost,
  inBounds,
  isAdjacent,
  neighbors,
  recruitStrength,
  revealAround,
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
  Victory,
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
  // Partida encerrada é imutável: o mundo final é devolvido como está.
  if (world.victory) return world;

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

  // Descoberta de território (Fase 20, §20 — RF-21): só quando a partida
  // ativou fogOfWar — cidades/exércitos revelam o raio ao seu redor a cada
  // tick, depois das ações deste turno já terem movido tudo.
  if (w.fogOfWar) {
    for (const id of CIV_IDS) {
      const civ = w.civilizations[id];
      if (!civ.alive) continue;
      for (const city of civ.cities) revealAround(w, civ.discovered, city.x, city.y, DISCOVERY_RADIUS);
      for (const army of civ.armies) revealAround(w, civ.discovered, army.x, army.y, DISCOVERY_RADIUS);
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
  checkVictory(w, events);
  w.events = events;
  return w;
}

/**
 * Condições de vitória (RF-026), avaliadas ao fim do tick em ordem
 * determinística de prioridade: dominação > científica > prosperidade >
 * limite de turnos. Uma vez definida, a vitória nunca é sobrescrita.
 */
function checkVictory(w: World, events: GameEvent[]): void {
  if (w.victory) return;

  const alive = CIV_IDS.filter((id) => w.civilizations[id].alive);
  const declare = (civ: CivId, kind: Victory["kind"]): void => {
    w.victory = { civ, kind, tick: w.tick };
    events.push({ type: "victory", civ, kind, tick: w.tick });
  };

  // Dominação: restou exatamente uma civilização.
  if (alive.length === 1) return declare(alive[0], "domination");

  const allTechs = Object.keys(TECHS);
  for (const id of alive) {
    const civ = w.civilizations[id];
    // Científica: dominou o catálogo inteiro.
    if (allTechs.every((t) => civ.tech.includes(t))) return declare(id, "scientific");
  }
  for (const id of alive) {
    const r = w.civilizations[id].resources;
    // Prosperidade: reservas acumuladas acima do limiar.
    if (r.food + r.gold + r.science >= PROSPERITY_THRESHOLD) return declare(id, "prosperity");
  }

  // Limite de turnos: vence a maior pontuação (desempate pela ordem de CIV_IDS).
  if (w.tick >= TURN_LIMIT && alive.length > 0) {
    let best = alive[0];
    for (const id of alive) {
      if (civScore(w.civilizations[id]) > civScore(w.civilizations[best])) best = id;
    }
    declare(best, "turn_limit");
  }
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
      const destOwner = w.map[y][x].owner;
      army.x = x;
      army.y = y;
      events.push({ type: "army_moved", civ: civ.id, armyId, x, y });
      // Entrada em território hostil (Fase 18, §18 — RF-14): deslocamento
      // continua sem combate (ataque é uma ação à parte), mas o evento
      // distinto sinaliza a incursão para quem observa/audita a partida.
      if (destOwner && destOwner !== civ.id && getStance(w, civ.id, destOwner) === "war") {
        events.push({ type: "hostile_territory_entered", civ: civ.id, armyId, x, y, owner: destOwner });
      }
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
          // Ocupação (Fase 18, §18 — RF-14): a cidade passa a produzir para
          // o ocupante imediatamente; `occupied` só registra que ela foi
          // conquistada em batalha, não fundada (resistência/revolta ficam
          // fora do escopo desta fase).
          defCity.occupied = true;
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

    case "retreat_army": {
      const { armyId } = action.args;
      const army = civ.armies.find((a) => a.id === armyId);
      if (!army) return reject("exército não encontrado");
      if (civ.cities.length === 0) return reject("sem cidades próprias para recuar");

      // Recuo estratégico instantâneo (Fase 18, §18 — RF-14): sem combate,
      // sem exigência de adjacência — encerra qualquer incursão em
      // território hostil daquele exército. Cidade própria mais próxima,
      // por distância euclidiana ao quadrado (empate resolvido pela ordem
      // de `civ.cities`, que é estável) — determinístico.
      let nearest = civ.cities[0];
      let bestDist = (nearest.x - army.x) ** 2 + (nearest.y - army.y) ** 2;
      for (const city of civ.cities.slice(1)) {
        const dist = (city.x - army.x) ** 2 + (city.y - army.y) ** 2;
        if (dist < bestDist) {
          nearest = city;
          bestDist = dist;
        }
      }
      army.x = nearest.x;
      army.y = nearest.y;
      events.push({ type: "army_retreated", civ: civ.id, armyId, x: nearest.x, y: nearest.y });
      return;
    }

    case "recruit": {
      const { cityId } = action.args;
      const city = civ.cities.find((c) => c.id === cityId);
      if (!city) return reject("cidade não encontrada");
      if (!canRecruit(civ.tech)) return reject("recrutamento exige a tecnologia bronze_working");
      if (!city.buildings.includes("barracks")) return reject("recrutamento exige um quartel nesta cidade");
      if (civ.resources.gold < RECRUIT_GOLD_COST) return reject("ouro insuficiente para recrutar");

      civ.resources.gold -= RECRUIT_GOLD_COST;
      const strength = recruitStrength(civ.tech);
      const army = {
        id: `${civ.id}-army-t${w.tick + 1}-${civ.armies.length + 1}`,
        x: city.x,
        y: city.y,
        strength,
      };
      civ.armies.push(army);
      events.push({ type: "army_recruited", civ: civ.id, cityId, armyId: army.id, strength });
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
    // Efeitos reais das tecnologias (RF-024): rendimento extra por cidade.
    for (const t of civ.tech) {
      const effects = TECHS[t]?.effects;
      if (effects?.cityYield) addInto(income, effects.cityYield);
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

  // Manutenção de exércitos (Fase 18, §18 — RF-15/RF-16): sem ouro
  // suficiente, TODOS os exércitos perdem força em vez de travar a
  // economia; um exército que chega a força 0 é desfeito.
  if (civ.armies.length > 0) {
    const upkeep = civ.armies.length * ARMY_UPKEEP_GOLD;
    if (civ.resources.gold >= upkeep) {
      civ.resources.gold -= upkeep;
    } else {
      civ.resources.gold = 0;
      events.push({ type: "army_upkeep_shortfall", civ: civ.id, armiesAffected: civ.armies.length });
      for (const army of civ.armies) army.strength -= 1;
      for (const army of civ.armies) {
        if (army.strength <= 0) events.push({ type: "army_disbanded", civ: civ.id, armyId: army.id, reason: "upkeep" });
      }
      civ.armies = civ.armies.filter((a) => a.strength > 0);
    }
  }
}
