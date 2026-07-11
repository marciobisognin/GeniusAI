/**
 * Tipos do estado de jogo consumidos pela UI. Espelham (de forma solta) os
 * tipos do backend (`apps/backend/src/engine/types.ts`) — frontend e backend
 * são pacotes npm separados, sem um workspace de tipos compartilhados no MVP.
 */

export const CIV_IDS = ["rome", "egypt", "greece", "mali"] as const;
export type CivId = (typeof CIV_IDS)[number];

export type Terrain = "plains" | "forest" | "mountain" | "coast" | "desert";
export type ResourceKind = "food" | "gold" | "science";
export type Stance = "peace" | "war" | "alliance" | "trade";

export interface Resources {
  food: number;
  gold: number;
  science: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  resource: ResourceKind | null;
  owner: CivId | null;
}

export interface City {
  id: string;
  x: number;
  y: number;
  population: number;
  buildings: string[];
}

export interface Army {
  id: string;
  x: number;
  y: number;
  strength: number;
}

export interface Civilization {
  id: CivId;
  persona: string;
  resources: Resources;
  tech: string[];
  researching: string | null;
  cities: City[];
  armies: Army[];
  memory: string;
  alive: boolean;
}

export interface Action {
  tool: string;
  args: Record<string, unknown>;
}

export type GameEvent = { type: string } & Record<string, unknown>;

/** Proposta bilateral pendente (comércio/aliança) aguardando resposta. */
export interface Proposal {
  id: string;
  kind: "trade" | "alliance";
  from: CivId;
  to: CivId;
  createdTick: number;
  expiresTick: number;
  offer?: Partial<Resources>;
  request?: Partial<Resources>;
}

export type VictoryKind = "domination" | "scientific" | "prosperity" | "turn_limit";

export interface Victory {
  civ: CivId;
  kind: VictoryKind;
  tick: number;
}

export const VICTORY_LABEL: Record<VictoryKind, string> = {
  domination: "dominação",
  scientific: "vitória científica",
  prosperity: "prosperidade",
  turn_limit: "maior pontuação no limite de turnos",
};

export interface World {
  tick: number;
  seed: number;
  width: number;
  height: number;
  map: Tile[][];
  civilizations: Record<CivId, Civilization>;
  diplomacy: Record<string, Stance>;
  pendingProposals?: Proposal[];
  victory?: Victory | null;
  events: GameEvent[];
}

export type LoopState = "idle" | "running" | "paused" | "stopped";

export interface CivLastTurn {
  reasoning: string;
  actions: Action[];
  passed: boolean;
  errors: string[];
}

export interface SaveInfo {
  gameId: string;
  tick: number;
  seed: number;
  updatedAt: string;
}

export type ServerMessage =
  | { type: "hello"; runner: string }
  | { type: "health"; runner: string; healthy: boolean }
  | { type: "world_init"; world: World; loopState: LoopState; gameId: string }
  | { type: "history"; timeline: GameEvent[]; civs: Partial<Record<CivId, CivLastTurn>> }
  | { type: "loop_state"; state: LoopState }
  | { type: "turn_start"; tick: number; civ: CivId }
  | { type: "turn_token"; tick: number; civ: CivId; chunk: string }
  | {
      type: "turn_end";
      tick: number;
      civ: CivId;
      reasoning: string;
      actions: Action[];
      passed: boolean;
      errors: string[];
    }
  | { type: "tick_end"; tick: number; events: GameEvent[]; world: World }
  | { type: "saves"; saves: SaveInfo[] }
  | { type: "answer"; civ: CivId; question: string; text: string; runner: string }
  | { type: "error"; code?: string; message: string };

export const CIV_LABEL: Record<CivId, string> = {
  rome: "Roma",
  egypt: "Egito",
  greece: "Grécia",
  mali: "Mali",
};

export const CIV_COLOR: Record<CivId, string> = {
  rome: "#c0392b",
  egypt: "#d4a72c",
  greece: "#2980b9",
  mali: "#8e44ad",
};

/** Rótulo legível de um evento do motor (para a linha do tempo). */
export function describeEvent(e: GameEvent): string {
  const civLabel = (id: unknown) => (typeof id === "string" && id in CIV_LABEL ? CIV_LABEL[id as CivId] : String(id));
  switch (e.type) {
    case "tick_started":
      return `— Tick ${e.tick} —`;
    case "structure_built":
      return `${civLabel(e.civ)} construiu ${e.structure} em (${e.x},${e.y})`;
    case "tile_claimed":
      return `${civLabel(e.civ)} reivindicou o tile (${e.x},${e.y})`;
    case "research_started":
      return `${civLabel(e.civ)} iniciou pesquisa: ${e.technology}`;
    case "tech_researched":
      return `${civLabel(e.civ)} concluiu a tecnologia ${e.technology}`;
    case "army_moved":
      return `${civLabel(e.civ)} moveu um exército para (${e.x},${e.y})`;
    case "battle":
      return `Batalha: ${civLabel(e.attacker)} atacou ${civLabel(e.defender)} — vencedor: ${civLabel(e.winner)}`;
    case "city_captured":
      return `${civLabel(e.to)} capturou uma cidade de ${civLabel(e.from)}`;
    case "diplomacy_changed":
      return `${civLabel(e.a)} e ${civLabel(e.b)}: relação agora é "${e.stance}"`;
    case "trade_executed":
      return `${civLabel(e.from)} comerciou com ${civLabel(e.to)}`;
    case "trade_proposed":
      return `${civLabel(e.civ)} propôs comércio a ${civLabel(e.to)}`;
    case "alliance_proposed":
      return `${civLabel(e.civ)} propôs aliança a ${civLabel(e.to)}`;
    case "proposal_accepted":
      return `${civLabel(e.civ)} aceitou a proposta de ${e.kind === "trade" ? "comércio" : "aliança"} de ${civLabel(e.from)}`;
    case "proposal_rejected":
      return `${civLabel(e.civ)} recusou a proposta de ${e.kind === "trade" ? "comércio" : "aliança"} de ${civLabel(e.from)}`;
    case "proposal_expired":
      return `Proposta de ${e.kind === "trade" ? "comércio" : "aliança"} de ${civLabel(e.from)} para ${civLabel(e.to)} expirou`;
    case "city_grew":
      return `Uma cidade de ${civLabel(e.civ)} cresceu para população ${e.population}`;
    case "strategy_updated":
      return `${civLabel(e.civ)} atualizou sua estratégia`;
    case "civ_eliminated":
      return `${civLabel(e.civ)} foi eliminada!`;
    case "army_recruited":
      return `${civLabel(e.civ)} recrutou um exército (força ${e.strength})`;
    case "victory":
      return `🏆 ${civLabel(e.civ)} venceu a partida por ${VICTORY_LABEL[e.kind as VictoryKind] ?? e.kind} (tick ${e.tick})`;
    case "action_rejected":
      return `${civLabel(e.civ)}: ação "${e.tool}" rejeitada (${e.reason})`;
    case "narration":
      return `📰 ${e.text}`;
    default:
      return e.type;
  }
}
