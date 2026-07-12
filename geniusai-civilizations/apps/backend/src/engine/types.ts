/**
 * Tipos do núcleo de simulação. A fonte de verdade vive em
 * `@geniusai/shared` (compartilhada com o frontend) — este módulo apenas a
 * re-exporta para manter os imports internos do motor (`./types`) estáveis.
 */
export {
  CIV_IDS,
  type Action,
  type Army,
  type City,
  type CivDecision,
  type CivId,
  type Civilization,
  type GameEvent,
  type Proposal,
  type ResourceKind,
  type Resources,
  type Stance,
  type Terrain,
  type Tile,
  type Victory,
  type VictoryKind,
  type World,
} from "@geniusai/shared";
