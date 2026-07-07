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

/** Árvore tecnológica mínima. */
export const TECHS: Record<string, { cost: number; requires: string[] }> = {
  agriculture: { cost: 20, requires: [] },
  writing: { cost: 30, requires: ["agriculture"] },
  bronze_working: { cost: 35, requires: ["agriculture"] },
  currency: { cost: 40, requires: ["writing"] },
  mathematics: { cost: 60, requires: ["writing"] },
};

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
