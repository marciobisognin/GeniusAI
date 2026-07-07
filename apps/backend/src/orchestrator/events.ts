import type { Action, CivId, GameEvent, World } from "../engine/types";

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
