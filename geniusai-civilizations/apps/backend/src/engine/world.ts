import { Rng } from "./rng";
import { neighbors } from "./rules";
import { CIV_IDS } from "./types";
import type { CivId, Civilization, ResourceKind, Terrain, Tile, World } from "./types";

const WIDTH = 8;
const HEIGHT = 8;

const HOMES: Record<CivId, { x: number; y: number }> = {
  rome: { x: 1, y: 1 },
  egypt: { x: 6, y: 1 },
  greece: { x: 1, y: 6 },
  mali: { x: 6, y: 6 },
};

const DEFAULT_PERSONAS: Record<CivId, string> = {
  rome: "Expansionista e militarista.",
  egypt: "Defensiva e comercial.",
  greece: "Científica e cultural.",
  mali: "Mercantil e diplomática.",
};

const TERRAINS: Terrain[] = ["plains", "forest", "mountain", "coast", "desert"];
const RESOURCES: ResourceKind[] = ["food", "gold", "science"];

/**
 * Cria o mundo inicial de forma **determinística** a partir de um seed:
 * mesmo seed → mundo byte-a-byte idêntico (essencial para replay/testes).
 */
export function createWorld(seed: number): World {
  const rng = new Rng(seed);

  const map: Tile[][] = [];
  for (let y = 0; y < HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < WIDTH; x++) {
      const terrain = TERRAINS[rng.int(TERRAINS.length)];
      const resource = rng.next() < 0.2 ? RESOURCES[rng.int(RESOURCES.length)] : null;
      row.push({ x, y, terrain, resource, owner: null });
    }
    map.push(row);
  }

  const civilizations = {} as Record<CivId, Civilization>;
  const world: World = {
    tick: 0,
    seed,
    rngState: rng.state,
    width: WIDTH,
    height: HEIGHT,
    map,
    civilizations,
    diplomacy: {},
    events: [],
  };

  for (const id of CIV_IDS) {
    const home = HOMES[id];
    const tile = map[home.y][home.x];
    // Terreno da capital sempre habitável/transponível.
    tile.terrain = "plains";
    tile.owner = id;
    for (const n of neighbors(world, home.x, home.y)) {
      if (n.owner === null) n.owner = id;
    }

    civilizations[id] = {
      id,
      persona: DEFAULT_PERSONAS[id],
      resources: { food: 5, gold: 60, science: 0 },
      tech: [],
      researching: null,
      cities: [{ id: `${id}-city-1`, x: home.x, y: home.y, population: 2, buildings: [] }],
      armies: [{ id: `${id}-army-1`, x: home.x, y: home.y, strength: 5 }],
      memory: "",
      alive: true,
    };
  }

  return world;
}

export function tileAt(world: World, x: number, y: number): Tile {
  return world.map[y][x];
}
