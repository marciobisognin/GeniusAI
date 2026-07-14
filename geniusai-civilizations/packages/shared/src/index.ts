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

// ── Conselheiros especialistas (PRD §16, Fase 14) ───────────────────────────

/** Especialidades de conselheiro disponíveis (PRD §16 — RF-9). */
export const ADVISOR_ROLES = ["economic", "diplomatic", "military", "scientific", "historian"] as const;
export type AdvisorRole = (typeof ADVISOR_ROLES)[number];

/**
 * Recomendação de UM conselheiro para o turno corrente. Aditiva ao prompt do
 * agente principal — nunca decide por ele (RF-9: "o agente principal
 * permanece livre para segui-las ou não").
 */
export interface AdvisorRecommendation {
  role: AdvisorRole;
  /** Texto da recomendação (≤280 chars, já validado/truncado). */
  recommendation: string;
  confidence: "low" | "medium" | "high";
}

// ── Definição de civilização (Agente Construtor — PRD §7) ──────────────────

export type CivilizationPriority = "military" | "science" | "economy" | "culture" | "diplomacy";
export type DiplomacyStyle = "peaceful" | "balanced" | "aggressive";

/**
 * Configuração declarativa de uma civilização: a "receita" a partir da qual
 * o `CivilizationAgentFactory` monta o agente (persona, contexto, limites) e
 * `createWorld` inicializa o estado do jogo. Única fonte de verdade,
 * consumida por motor, agentes e UI — nenhuma cor/nome/persona duplicada.
 *
 * Limitação atual: `id` precisa ser um `CivId` (as 4 civilizações fixas).
 * Suportar N civilizações livres exigiria generalizar `CivId` de união
 * literal para um espaço de ids dinâmico em todo o motor/mapa/UI — fora do
 * escopo desta fase (evolução incremental, PRD §4.8).
 */
export interface CivilizationDefinition {
  id: CivId;
  name: string;
  adjective: string;
  color: string;
  leaderName: string;
  /** Traços curtos de personalidade (compõem a persona do prompt). */
  personality: string[];
  priorities: CivilizationPriority[];
  /** 0 (avesso a risco) a 1 (arrojado). */
  riskTolerance: number;
  diplomacyStyle: DiplomacyStyle;
  /** Tecnologias já dominadas ao nascer (raro — normalmente []). */
  startingTechnologies: string[];
  startingResources: Resources;
  /** Override do modelo do runner para ESTA civilização (ex.: Ollama). */
  model?: string;
  /**
   * Conselheiros especialistas ativos para esta civilização (PRD §16 —
   * Fase 14, opcional). Ausente/vazio = comportamento padrão (sem corte),
   * preservando toda partida já jogável hoje. Por civilização, não global
   * (RF-10) — permite comparar, na mesma partida, uma civilização "com
   * corte" e outra sem.
   */
  advisors?: AdvisorRole[];
}

const PRIORITY_LABEL: Record<CivilizationPriority, string> = {
  military: "força militar",
  science: "avanço científico",
  economy: "prosperidade econômica",
  culture: "legado cultural",
  diplomacy: "laços diplomáticos",
};

const DIPLOMACY_LABEL: Record<DiplomacyStyle, string> = {
  peaceful: "busca a paz e evita conflito quando possível",
  balanced: "pesa guerra e diplomacia caso a caso",
  aggressive: "não hesita em recorrer à força para avançar seus interesses",
};

/**
 * Deriva o texto de persona (usado no prompt de sistema do agente) a partir
 * de uma definição — função pura, sem I/O, testável isoladamente.
 */
export function civilizationPersonaText(def: CivilizationDefinition): string {
  const traits = def.personality.join(", ");
  const priorities = def.priorities.map((p) => PRIORITY_LABEL[p]).join(" e ");
  const risk = def.riskTolerance >= 0.66 ? "arrojada" : def.riskTolerance <= 0.33 ? "cautelosa" : "ponderada";
  return (
    `${traits}. Prioriza ${priorities}. Postura ${risk} diante do risco; ${DIPLOMACY_LABEL[def.diplomacyStyle]}.`
  );
}

/** Catálogo padrão — as 4 civilizações do MVP, com valores hoje já em produção. */
export const DEFAULT_CIVILIZATIONS: Record<CivId, CivilizationDefinition> = {
  rome: {
    id: "rome",
    name: "Roma",
    adjective: "romana",
    color: "#c0392b",
    leaderName: "César",
    personality: ["Expansionista", "militarista", "disciplinada"],
    priorities: ["military", "economy"],
    riskTolerance: 0.7,
    diplomacyStyle: "aggressive",
    startingTechnologies: [],
    startingResources: { food: 5, gold: 60, science: 0 },
    // Prova de conceito da Fase 14 (§16 do PRD): só Roma tem corte por
    // padrão — permite comparar, na mesma partida, uma civilização "com
    // conselheiros" e as demais sem, como pede a RF-10.
    advisors: ["military", "economic"],
  },
  egypt: {
    id: "egypt",
    name: "Egito",
    adjective: "egípcia",
    color: "#d4a72c",
    leaderName: "Cleópatra",
    personality: ["Defensiva", "comercial", "pragmática"],
    priorities: ["economy", "diplomacy"],
    riskTolerance: 0.4,
    diplomacyStyle: "balanced",
    startingTechnologies: [],
    startingResources: { food: 5, gold: 60, science: 0 },
  },
  greece: {
    id: "greece",
    name: "Grécia",
    adjective: "grega",
    color: "#2980b9",
    leaderName: "Péricles",
    personality: ["Científica", "cultural", "curiosa"],
    priorities: ["science", "culture"],
    riskTolerance: 0.5,
    diplomacyStyle: "peaceful",
    startingTechnologies: [],
    startingResources: { food: 5, gold: 60, science: 0 },
  },
  mali: {
    id: "mali",
    name: "Mali",
    adjective: "malinesa",
    color: "#8e44ad",
    leaderName: "Mansa Musa",
    personality: ["Mercantil", "diplomática", "próspera"],
    priorities: ["diplomacy", "economy"],
    riskTolerance: 0.35,
    diplomacyStyle: "peaceful",
    startingTechnologies: [],
    startingResources: { food: 5, gold: 60, science: 0 },
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
      /** Recomendações da corte de conselheiros usadas nesta decisão (Fase 14, §16). */
      advisorRecommendations: AdvisorRecommendation[];
    }
  | { type: "tick_end"; tick: number; events: DisplayEvent[]; world: World };

// ── Protocolo WebSocket (contrato cliente ⇄ servidor) ───────────────────────

export interface CivLastTurn {
  reasoning: string;
  actions: Action[];
  passed: boolean;
  errors: string[];
  advisorRecommendations: AdvisorRecommendation[];
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
