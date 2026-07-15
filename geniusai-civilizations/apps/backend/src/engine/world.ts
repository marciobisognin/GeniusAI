import { DEFAULT_CIVILIZATIONS, civilizationPersonaText } from "@geniusai/shared";
import type { CivilizationDefinition } from "@geniusai/shared";
import { Rng } from "./rng";
import { DISCOVERY_RADIUS, neighbors, revealAround } from "./rules";
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

const TERRAINS: Terrain[] = ["plains", "forest", "mountain", "coast", "desert"];
const RESOURCES: ResourceKind[] = ["food", "gold", "science"];

/**
 * Cria o mundo inicial de forma **determinística** a partir de um seed:
 * mesmo seed (e mesmas `definitions`) → mundo byte-a-byte idêntico (essencial
 * para replay/testes). `definitions` vem do Agente Construtor (§7 do PRD) —
 * persona, recursos e tecnologias iniciais de cada civilização nascem dela;
 * o padrão é o catálogo de produção (`DEFAULT_CIVILIZATIONS`).
 */
export function createWorld(
  seed: number,
  definitions: Record<CivId, CivilizationDefinition> = DEFAULT_CIVILIZATIONS,
  fogOfWar = false,
): World {
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
    pendingProposals: [],
    victory: null,
    events: [],
    fogOfWar,
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

    const def = definitions[id];
    const discovered: Record<string, boolean> = {};
    revealAround(world, discovered, home.x, home.y, DISCOVERY_RADIUS);
    civilizations[id] = {
      id,
      persona: civilizationPersonaText(def),
      resources: { ...def.startingResources },
      tech: [...def.startingTechnologies],
      researching: null,
      cities: [{ id: `${id}-city-1`, x: home.x, y: home.y, population: 2, buildings: [] }],
      armies: [{ id: `${id}-army-1`, x: home.x, y: home.y, strength: 5 }],
      memory: "",
      alive: true,
      discovered,
    };
  }

  return world;
}

export function tileAt(world: World, x: number, y: number): Tile {
  return world.map[y][x];
}
