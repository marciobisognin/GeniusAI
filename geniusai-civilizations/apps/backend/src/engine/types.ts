/** Tipos do núcleo de simulação (World Engine). Sem dependência de LLM. */

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

/**
 * Proposta bilateral pendente (comércio ou aliança). Nada é transferido nem
 * pactuado antes do aceite do destinatário; propostas não respondidas
 * expiram após PROPOSAL_TTL_TICKS.
 */
export interface Proposal {
  id: string;
  kind: "trade" | "alliance";
  from: CivId;
  to: CivId;
  createdTick: number;
  /** Último tick em que a proposta ainda pode ser respondida. */
  expiresTick: number;
  /** Somente kind="trade": o que o proponente entrega. */
  offer?: Partial<Resources>;
  /** Somente kind="trade": o que o proponente pede em troca. */
  request?: Partial<Resources>;
}

export type VictoryKind = "domination" | "scientific" | "prosperity" | "turn_limit";

/** Resultado final da partida — uma vez definido, nunca é sobrescrito. */
export interface Victory {
  civ: CivId;
  kind: VictoryKind;
  tick: number;
}

export type GameEvent =
  | { type: "tick_started"; tick: number }
  | { type: "action_rejected"; civ: CivId; tool: string; reason: string }
  | { type: "structure_built"; civ: CivId; structure: string; x: number; y: number }
  | { type: "tile_claimed"; civ: CivId; x: number; y: number }
  | { type: "research_started"; civ: CivId; technology: string }
  | { type: "tech_researched"; civ: CivId; technology: string }
  | { type: "army_moved"; civ: CivId; armyId: string; x: number; y: number }
  | { type: "battle"; attacker: CivId; defender: CivId; x: number; y: number; winner: CivId }
  | { type: "city_captured"; from: CivId; to: CivId; cityId: string }
  | { type: "diplomacy_changed"; a: CivId; b: CivId; stance: Stance }
  | { type: "trade_executed"; from: CivId; to: CivId }
  | { type: "trade_proposed"; civ: CivId; to: CivId; proposalId: string; offer: Partial<Resources>; request: Partial<Resources> }
  | { type: "alliance_proposed"; civ: CivId; to: CivId; proposalId: string }
  | { type: "proposal_accepted"; civ: CivId; from: CivId; kind: Proposal["kind"]; proposalId: string }
  | { type: "proposal_rejected"; civ: CivId; from: CivId; kind: Proposal["kind"]; proposalId: string }
  | { type: "proposal_expired"; from: CivId; to: CivId; kind: Proposal["kind"]; proposalId: string }
  | { type: "city_grew"; civ: CivId; cityId: string; population: number }
  | { type: "strategy_updated"; civ: CivId }
  | { type: "civ_eliminated"; civ: CivId }
  | { type: "army_recruited"; civ: CivId; cityId: string; armyId: string; strength: number }
  | { type: "victory"; civ: CivId; kind: VictoryKind; tick: number };

export interface World {
  tick: number;
  seed: number;
  /** Estado do PRNG determinístico — threaded a cada tick para replay fiel. */
  rngState: number;
  width: number;
  height: number;
  /** Grade de tiles indexada como map[y][x]. */
  map: Tile[][];
  civilizations: Record<CivId, Civilization>;
  /** Relações par-a-par, chave canônica "a|b" (ids ordenados). */
  diplomacy: Record<string, Stance>;
  /** Propostas bilaterais aguardando resposta do destinatário. */
  pendingProposals: Proposal[];
  /** Resultado final (null enquanto a partida está em curso). */
  victory: Victory | null;
  /** Eventos emitidos no último tick. */
  events: GameEvent[];
}

/** Ações que um agente pode escolher (validadas pelo motor). */
export type Action =
  | { tool: "build"; args: { structure: string; x: number; y: number } }
  | { tool: "research"; args: { technology: string } }
  | { tool: "move_army"; args: { armyId: string; x: number; y: number } }
  | { tool: "attack"; args: { armyId: string; x: number; y: number } }
  | { tool: "recruit"; args: { cityId: string } }
  | { tool: "set_diplomacy"; args: { civ: CivId; stance: Stance } }
  | { tool: "propose_trade"; args: { civ: CivId; offer: Partial<Resources>; request: Partial<Resources> } }
  | { tool: "propose_alliance"; args: { civ: CivId } }
  | { tool: "respond_proposal"; args: { proposalId: string; accept: boolean } }
  | { tool: "set_strategy"; args: { note: string } };

export interface CivDecision {
  civ: CivId;
  actions: Action[];
}
