/**
 * Tipos consumidos pela UI. O contrato de estado/eventos/protocolo vive em
 * `@geniusai/shared` — uma única fonte de verdade com o backend. Aqui ficam
 * apenas re-exports e helpers de apresentação (rótulos, cores, narrativa).
 */
import { CIV_IDS, DEFAULT_CIVILIZATIONS } from "@geniusai/shared";
import type { AdvisorRole, CivId, DisplayEvent, VictoryKind } from "@geniusai/shared";

export {
  ADVISOR_ROLES,
  CIV_IDS,
  DEFAULT_CIVILIZATIONS,
  type Action,
  type AdvisorRecommendation,
  type AdvisorRole,
  type Army,
  type City,
  type CivId,
  type CivilizationDefinition,
  type CivLastTurn,
  type Civilization,
  type ClientCommand,
  type LoopState,
  type Proposal,
  type ResourceKind,
  type Resources,
  type SaveInfo,
  type ServerMessage,
  type Stance,
  type Terrain,
  type Tile,
  type Victory,
  type VictoryKind,
  type World,
} from "@geniusai/shared";

/** Na UI, a timeline mistura fatos do motor com narrações — DisplayEvent. */
export type GameEvent = DisplayEvent;

/**
 * Nome e cor de cada civilização vêm do MESMO catálogo que o backend usa
 * para montar os agentes (Agente Construtor, §7 do PRD) — nenhum dado
 * duplicado entre motor, prompt e UI.
 */
export const CIV_LABEL: Record<CivId, string> = Object.fromEntries(
  CIV_IDS.map((id) => [id, DEFAULT_CIVILIZATIONS[id].name]),
) as Record<CivId, string>;

export const CIV_COLOR: Record<CivId, string> = Object.fromEntries(
  CIV_IDS.map((id) => [id, DEFAULT_CIVILIZATIONS[id].color]),
) as Record<CivId, string>;

export const CIV_LEADER: Record<CivId, string> = Object.fromEntries(
  CIV_IDS.map((id) => [id, DEFAULT_CIVILIZATIONS[id].leaderName]),
) as Record<CivId, string>;

/** Rótulos em português dos conselheiros especialistas (Fase 14, §16 do PRD). */
export const ADVISOR_LABEL: Record<AdvisorRole, string> = {
  economic: "Econômico",
  diplomatic: "Diplomático",
  military: "Militar",
  scientific: "Científico",
  historian: "Historiador",
};

export const ADVISOR_CONFIDENCE_LABEL: Record<"low" | "medium" | "high", string> = {
  low: "baixa confiança",
  medium: "confiança média",
  high: "alta confiança",
};

export const VICTORY_LABEL: Record<VictoryKind, string> = {
  domination: "dominação",
  scientific: "vitória científica",
  prosperity: "prosperidade",
  turn_limit: "maior pontuação no limite de turnos",
};

const civLabel = (id: CivId): string => CIV_LABEL[id] ?? id;

/** Rótulo legível de um evento (motor ou narração) para a linha do tempo. */
export function describeEvent(e: GameEvent): string {
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
      return `🏆 ${civLabel(e.civ)} venceu a partida por ${VICTORY_LABEL[e.kind]} (tick ${e.tick})`;
    case "action_rejected":
      return `${civLabel(e.civ)}: ação "${e.tool}" rejeitada (${e.reason})`;
    case "narration":
      return `📰 ${e.text}`;
    default:
      return (e as { type: string }).type;
  }
}
