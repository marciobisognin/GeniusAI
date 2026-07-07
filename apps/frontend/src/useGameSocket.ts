import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, CivId, GameEvent, LoopState, ServerMessage, World } from "./types";
import { CIV_IDS } from "./types";

export type CivStatus = "idle" | "thinking" | "done";

export interface CivUiState {
  status: CivStatus;
  /** Nº de fragmentos de saída recebidos neste turno (indicador de atividade). */
  chunksReceived: number;
  reasoning: string;
  actions: Action[];
  passed: boolean;
  errors: string[];
}

const emptyCivState = (): CivUiState => ({
  status: "idle",
  chunksReceived: 0,
  reasoning: "",
  actions: [],
  passed: false,
  errors: [],
});

export interface GameSocketState {
  connected: boolean;
  runner?: string;
  healthy?: boolean;
  world: World | null;
  loopState: LoopState;
  civs: Record<CivId, CivUiState>;
  /** Eventos mais recentes primeiro. */
  timeline: GameEvent[];
}

const BACKEND_WS = import.meta.env.VITE_BACKEND_WS ?? "ws://localhost:8787";
const TIMELINE_LIMIT = 60;

export function useGameSocket() {
  const [state, setState] = useState<GameSocketState>({
    connected: false,
    world: null,
    loopState: "idle",
    civs: {
      rome: emptyCivState(),
      egypt: emptyCivState(),
      greece: emptyCivState(),
      mali: emptyCivState(),
    },
    timeline: [],
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(BACKEND_WS);
    wsRef.current = ws;

    ws.onopen = () => setState((s) => ({ ...s, connected: true }));
    ws.onclose = () => setState((s) => ({ ...s, connected: false }));

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }

      setState((s) => {
        switch (msg.type) {
          case "hello":
            return { ...s, runner: msg.runner };

          case "health":
            return { ...s, runner: msg.runner, healthy: msg.healthy };

          case "world_init":
            return { ...s, world: msg.world, loopState: msg.loopState };

          case "loop_state":
            return { ...s, loopState: msg.state };

          case "turn_start": {
            const civs = { ...s.civs, [msg.civ]: { ...emptyCivState(), status: "thinking" as const } };
            return { ...s, civs };
          }

          case "turn_token": {
            const prev = s.civs[msg.civ];
            const civs = { ...s.civs, [msg.civ]: { ...prev, chunksReceived: prev.chunksReceived + 1 } };
            return { ...s, civs };
          }

          case "turn_end": {
            const civs: typeof s.civs = {
              ...s.civs,
              [msg.civ]: {
                status: "done",
                chunksReceived: s.civs[msg.civ]?.chunksReceived ?? 0,
                reasoning: msg.reasoning,
                actions: msg.actions,
                passed: msg.passed,
                errors: msg.errors,
              },
            };
            return { ...s, civs };
          }

          case "tick_end": {
            const timeline = [...msg.events].reverse().concat(s.timeline).slice(0, TIMELINE_LIMIT);
            return { ...s, world: msg.world, timeline };
          }

          default:
            return s;
        }
      });
    };

    return () => ws.close();
  }, []);

  const send = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  }, []);

  const play = useCallback(() => send({ type: "command", action: "play" }), [send]);
  const pause = useCallback(() => send({ type: "command", action: "pause" }), [send]);
  const stop = useCallback(() => send({ type: "command", action: "stop" }), [send]);
  const step = useCallback(() => send({ type: "command", action: "step" }), [send]);
  const setSpeed = useCallback(
    (speedMs: number) => send({ type: "command", action: "set_speed", speedMs }),
    [send],
  );

  return { state, play, pause, stop, step, setSpeed, civIds: CIV_IDS };
}
