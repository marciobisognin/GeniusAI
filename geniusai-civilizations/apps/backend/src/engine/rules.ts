import type {
  CivId,
  Resources,
  ResourceKind,
  Stance,
  Terrain,
  Tile,
  World,
} from "./types";

/** Estruturas construíveis e seus custos/rendimentos. */
export const STRUCTURES: Record<string, { gold: number; yields?: Partial<Resources> }> = {
  city: { gold: 50 },
  farm: { gold: 20, yields: { food: 2 } },
  market: { gold: 30, yields: { gold: 2 } },
  library: { gold: 30, yields: { science: 2 } },
  barracks: { gold: 40 },
};

/** Efeitos passivos de uma tecnologia, aplicados de verdade pelo motor. */
export interface TechEffects {
  /** Rendimento extra POR CIDADE a cada tick. */
  cityYield?: Partial<Resources>;
  /** Força extra de exércitos recrutados após esta tecnologia. */
  armyStrengthBonus?: number;
  /** Habilita a ação recruit (junto com um quartel na cidade). */
  unlocksRecruit?: boolean;
}

export interface TechSpec {
  cost: number;
  requires: string[];
  description: string;
  effects: TechEffects;
}

/** Árvore tecnológica mínima — cada tecnologia tem efeito real no motor. */
export const TECHS: Record<string, TechSpec> = {
  agriculture: {
    cost: 20,
    requires: [],
    description: "Cultivo organizado: +2 de alimento por cidade a cada tick.",
    effects: { cityYield: { food: 2 } },
  },
  writing: {
    cost: 30,
    requires: ["agriculture"],
    description: "Registros e escribas: +1 de ciência por cidade a cada tick.",
    effects: { cityYield: { science: 1 } },
  },
  bronze_working: {
    cost: 35,
    requires: ["agriculture"],
    description: "Metalurgia do bronze: habilita recrutar exércitos (com quartel) e +1 de força ao recrutar.",
    effects: { unlocksRecruit: true, armyStrengthBonus: 1 },
  },
  currency: {
    cost: 40,
    requires: ["writing"],
    description: "Moeda cunhada: +2 de ouro por cidade a cada tick.",
    effects: { cityYield: { gold: 2 } },
  },
  mathematics: {
    cost: 60,
    requires: ["writing"],
    description: "Geometria e engenharia: +2 de ciência por cidade e +2 de força ao recrutar.",
    effects: { cityYield: { science: 2 }, armyStrengthBonus: 2 },
  },
};

/** Recrutamento (ação recruit): custo e força base. */
export const RECRUIT_GOLD_COST = 30;
export const RECRUIT_BASE_STRENGTH = 5;

/** Força de um exército recém-recrutado, somando bônus das tecnologias. */
export function recruitStrength(techs: string[]): number {
  return techs.reduce(
    (s, t) => s + (TECHS[t]?.effects.armyStrengthBonus ?? 0),
    RECRUIT_BASE_STRENGTH,
  );
}

/** A civilização já domina alguma tecnologia que habilita recrutamento? */
export function canRecruit(techs: string[]): boolean {
  return techs.some((t) => TECHS[t]?.effects.unlocksRecruit);
}

// ── Vitória (RF-026) ────────────────────────────────────────────────────────

export const PROSPERITY_THRESHOLD = 400;
export const TURN_LIMIT = 80;

/** Pontuação usada no desempate do limite de turnos. */
export function civScore(civ: {
  cities: { population: number }[];
  tech: string[];
  resources: Resources;
}): number {
  const population = civ.cities.reduce((s, c) => s + c.population, 0);
  const resources = civ.resources.food + civ.resources.gold + civ.resources.science;
  return civ.cities.length * 20 + civ.tech.length * 15 + population * 5 + resources;
}

export const TERRAIN_YIELDS: Record<Terrain, Partial<Resources>> = {
  plains: { food: 1 },
  forest: { food: 1 },
  mountain: { gold: 1 },
  coast: { gold: 1 },
  desert: {},
};

export const RESOURCE_YIELDS: Record<ResourceKind, Partial<Resources>> = {
  food: { food: 1 },
  gold: { gold: 1 },
  science: { science: 1 },
};

export const CITY_BASE_YIELD: Resources = { food: 3, gold: 2, science: 1 };

/** Custo de crescimento populacional (food) em função da população atual. */
export function growthCost(population: number): number {
  return population * 4;
}

/** Nº de ticks em que uma proposta bilateral pode ser respondida antes de expirar. */
export const PROPOSAL_TTL_TICKS = 3;

const RES_KEYS = ["food", "gold", "science"] as const;

export function canAfford(have: Resources, cost: Partial<Resources>): boolean {
  return RES_KEYS.every((k) => have[k] >= (cost[k] ?? 0));
}

export function addInto(target: Resources, delta: Partial<Resources>): void {
  for (const k of RES_KEYS) target[k] += delta[k] ?? 0;
}

export function subInto(target: Resources, delta: Partial<Resources>): void {
  for (const k of RES_KEYS) target[k] -= delta[k] ?? 0;
}

// ── Diplomacia ────────────────────────────────────────────────────────────

export function dipKey(a: CivId, b: CivId): string {
  return [a, b].sort().join("|");
}

export function getStance(world: World, a: CivId, b: CivId): Stance {
  if (a === b) return "peace";
  return world.diplomacy[dipKey(a, b)] ?? "peace";
}

export function setStance(world: World, a: CivId, b: CivId, stance: Stance): void {
  if (a !== b) world.diplomacy[dipKey(a, b)] = stance;
}

// ── Geometria do mapa ───────────────────────────────────────────────────────

export function inBounds(world: World, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

export function isAdjacent(x0: number, y0: number, x1: number, y1: number): boolean {
  return Math.abs(x0 - x1) + Math.abs(y0 - y1) === 1;
}

export function neighbors(world: World, x: number, y: number): Tile[] {
  const deltas = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const out: Tile[] = [];
  for (const [dx, dy] of deltas) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(world, nx, ny)) out.push(world.map[ny][nx]);
  }
  return out;
}
