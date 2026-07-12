/**
 * Eventos do orquestrador. A fonte de verdade vive em `@geniusai/shared`
 * (compartilhada com o frontend) — este módulo apenas a re-exporta para
 * manter os imports internos (`./events`) estáveis.
 */
export type { DisplayEvent, LoopEvent, LoopState } from "@geniusai/shared";
