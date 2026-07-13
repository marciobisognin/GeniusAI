/**
 * @geniusai/shared — única fonte de verdade para os tipos que atravessam a
 * fronteira backend ⇄ frontend: estado do jogo (mundo), eventos, ações e o
 * protocolo WebSocket. Consumido como fonte TypeScript pelos dois lados
 * (tsx no backend, Vite no frontend, `moduleResolution: Bundler` no tsc).
 *
 * Os schemas zod de validação em runtime continuam no backend (que é quem
 * valida entradas); este pacote define apenas o contrato de tipos.
 */

// ── Estado do jogo (World Engine) ───────────────────────────────────────────

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
 * expiram após o TTL do motor.
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

// ── Catálogo de tecnologias (fonte única — RF-024) ─────────────────────────

export type TechBranch = "ciência" | "militar" | "economia" | "cultura";

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
  /** Ramo temático (apresentação — o motor não depende disto). */
  branch: TechBranch;
  effects: TechEffects;
}

/**
 * Árvore tecnológica — única fonte de verdade, consumida pelo motor (custos,
 * pré-requisitos, efeitos) e pela UI (catálogo, árvore, Teatro de Decisões).
 * Nenhuma tecnologia aparece no frontend sem existir aqui.
 */
export const TECHS: Record<string, TechSpec> = {
  agriculture: {
    cost: 20,
    requires: [],
    description: "Cultivo organizado: +2 de alimento por cidade a cada tick.",
    branch: "economia",
    effects: { cityYield: { food: 2 } },
  },
  writing: {
    cost: 30,
    requires: ["agriculture"],
    description: "Registros e escribas: +1 de ciência por cidade a cada tick.",
    branch: "ciência",
    effects: { cityYield: { science: 1 } },
  },
  bronze_working: {
    cost: 35,
    requires: ["agriculture"],
    description: "Metalurgia do bronze: habilita recrutar exércitos (com quartel) e +1 de força ao recrutar.",
    branch: "militar",
    effects: { unlocksRecruit: true, armyStrengthBonus: 1 },
  },
  currency: {
    cost: 40,
    requires: ["writing"],
    description: "Moeda cunhada: +2 de ouro por cidade a cada tick.",
    branch: "economia",
    effects: { cityYield: { gold: 2 } },
  },
  mathematics: {
    cost: 60,
    requires: ["writing"],
    description: "Geometria e engenharia: +2 de ciência por cidade e +2 de força ao recrutar.",
    branch: "ciência",
    effects: { cityYield: { science: 2 }, armyStrengthBonus: 2 },
  },
};

// ── Eventos de exibição e do orquestrador ──────────────────────────────────

export type LoopState = "idle" | "running" | "paused" | "stopped";

/**
 * `GameEvent` são fatos do motor (puros, determinísticos). `narration` é uma
 * anotação decorativa gerada pelo narrador (LLM) — nunca vai para
 * `world.events`, só para o que é exibido/persistido na timeline.
 */
export type DisplayEvent = GameEvent | { type: "narration"; text: string };

/** Eventos de progresso emitidos pelo orquestrador (base do streaming). */
export type LoopEvent =
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
  | { type: "tick_end"; tick: number; events: DisplayEvent[]; world: World };

// ── Protocolo WebSocket (contrato cliente ⇄ servidor) ───────────────────────

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

/** Mensagens do servidor para o cliente. */
export type ServerMessage =
  | { type: "hello"; runner: string }
  | { type: "health"; runner: string; healthy: boolean }
  | { type: "world_init"; world: World; loopState: LoopState; gameId: string }
  | { type: "history"; timeline: DisplayEvent[]; civs: Partial<Record<CivId, CivLastTurn>> }
  | { type: "saves"; saves: SaveInfo[] }
  | { type: "answer"; civ: CivId; question: string; text: string; runner: string }
  | { type: "error"; code?: string; message: string }
  | LoopEvent;

/** Comandos do cliente para o servidor (validados com zod no backend). */
export type ClientCommand =
  | { type: "command"; action: "play" | "pause" | "stop" | "step" | "list_saves" }
  | { type: "command"; action: "set_speed"; speedMs: number }
  | { type: "command"; action: "new_game"; seed?: number; name?: string; speedMs?: number }
  | { type: "command"; action: "load_game"; gameId: string }
  | { type: "command"; action: "ask"; civ: CivId; question: string };
