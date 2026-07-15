import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, AdvisorRecommendation, CivId, GameEvent, LoopState, SaveInfo, ServerMessage, World } from "./types";
import { CIV_IDS } from "./types";

export type CivStatus = "idle" | "thinking" | "done";

export interface CivUiState {
  status: CivStatus;
  /** Nº de fragmentos de saída recebidos neste turno (indicador de atividade). */
  chunksReceived: number;
  /**
   * Texto bruto acumulado dos fragmentos recebidos neste turno (Fase 19,
   * §19 — RF-20). Com um runner real em streaming, é a saída JSON do
   * modelo se formando token a token — `extractLiveReasoning` (abaixo)
   * tenta mostrar só o valor de "reasoning" enquanto ele chega.
   */
  rawStream: string;
  reasoning: string;
  actions: Action[];
  passed: boolean;
  errors: string[];
  /** Recomendações da corte de conselheiros usadas nesta decisão (Fase 14). */
  advisorRecommendations: AdvisorRecommendation[];
}

const emptyCivState = (): CivUiState => ({
  status: "idle",
  chunksReceived: 0,
  rawStream: "",
  reasoning: "",
  actions: [],
  passed: false,
  errors: [],
  advisorRecommendations: [],
});

/**
 * Extrai, de forma tolerante, o valor (ainda incompleto) do campo
 * "reasoning" de um JSON parcial em streaming — não é um parser de JSON,
 * só um recorte best-effort para exibir o raciocínio "ao vivo" (RF-20)
 * antes do turno terminar. Sem match ainda (ex.: só chegou "{") devolve "".
 */
export function extractLiveReasoning(raw: string): string {
  const match = /"reasoning"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(raw);
  if (!match) return "";
  return match[1].replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

/** Estado de uma consulta "pergunte à civilização" (comando ask). */
export interface AskState {
  status: "loading" | "done" | "error";
  question: string;
  text?: string;
  runner?: string;
  error?: string;
}

export interface GameSocketState {
  connected: boolean;
  /** true enquanto uma nova tentativa de conexão está agendada. */
  reconnecting: boolean;
  runner?: string;
  healthy?: boolean;
  world: World | null;
  gameId?: string;
  loopState: LoopState;
  civs: Record<CivId, CivUiState>;
  /** Eventos mais recentes primeiro. */
  timeline: GameEvent[];
  saves: SaveInfo[];
  /** Última consulta ask por civilização. */
  answers: Partial<Record<CivId, AskState>>;
  lastError?: string;
}

const BACKEND_WS = import.meta.env.VITE_BACKEND_WS ?? "ws://localhost:8787";
// Fase 17 (§17 do PRD): a timeline agora pagina (EventTimeline), então vale a
// pena reter mais histórico do que cabia numa lista simples sem paginação.
const TIMELINE_LIMIT = 200;
const RECONNECT_MAX_MS = 15_000;

const initialCivs = (): Record<CivId, CivUiState> => ({
  rome: emptyCivState(),
  egypt: emptyCivState(),
  greece: emptyCivState(),
  mali: emptyCivState(),
});

function reduceMessage(s: GameSocketState, msg: ServerMessage): GameSocketState {
  switch (msg.type) {
    case "hello":
      return { ...s, runner: msg.runner };

    case "health":
      return { ...s, runner: msg.runner, healthy: msg.healthy };

    case "world_init":
      // Novo mundo (reconexão, new_game ou load_game): reseta os
      // painéis de raciocínio — `history` (mensagem seguinte) repõe o
      // que houver de conhecido para a partida carregada.
      return {
        ...s,
        world: msg.world,
        gameId: msg.gameId,
        loopState: msg.loopState,
        civs: initialCivs(),
        lastError: undefined,
      };

    case "history": {
      const timeline = [...msg.timeline].reverse().slice(0, TIMELINE_LIMIT);
      const civs = { ...s.civs };
      for (const civId of CIV_IDS) {
        const last = msg.civs[civId];
        if (last) {
          civs[civId] = {
            status: "done",
            chunksReceived: 0,
            rawStream: "",
            reasoning: last.reasoning,
            actions: last.actions,
            passed: last.passed,
            errors: last.errors,
            advisorRecommendations: last.advisorRecommendations ?? [],
          };
        }
      }
      return { ...s, timeline, civs };
    }

    case "loop_state":
      return { ...s, loopState: msg.state };

    case "turn_start":
      return { ...s, civs: { ...s.civs, [msg.civ]: { ...emptyCivState(), status: "thinking" as const } } };

    case "turn_token": {
      const prev = s.civs[msg.civ];
      return {
        ...s,
        civs: {
          ...s.civs,
          [msg.civ]: { ...prev, chunksReceived: prev.chunksReceived + 1, rawStream: prev.rawStream + msg.chunk },
        },
      };
    }

    case "turn_end": {
      const civs: typeof s.civs = {
        ...s.civs,
        [msg.civ]: {
          status: "done",
          chunksReceived: s.civs[msg.civ]?.chunksReceived ?? 0,
          rawStream: "",
          reasoning: msg.reasoning,
          actions: msg.actions,
          passed: msg.passed,
          errors: msg.errors,
          advisorRecommendations: msg.advisorRecommendations,
        },
      };
      return { ...s, civs };
    }

    case "tick_end": {
      const timeline = [...msg.events].reverse().concat(s.timeline).slice(0, TIMELINE_LIMIT);
      return { ...s, world: msg.world, timeline };
    }

    case "saves":
      return { ...s, saves: msg.saves };

    case "answer": {
      const answers = {
        ...s.answers,
        [msg.civ]: { status: "done" as const, question: msg.question, text: msg.text, runner: msg.runner },
      };
      return { ...s, answers };
    }

    case "error": {
      if (msg.code === "ASK_FAILED") {
        // Anexa o erro à consulta pendente (se houver), em vez do banner global.
        const answers = { ...s.answers };
        for (const civId of CIV_IDS) {
          const a = answers[civId];
          if (a?.status === "loading") answers[civId] = { ...a, status: "error", error: msg.message };
        }
        return { ...s, answers };
      }
      return { ...s, lastError: msg.message };
    }

    default:
      return s;
  }
}

export function useGameSocket() {
  const [state, setState] = useState<GameSocketState>({
    connected: false,
    reconnecting: false,
    world: null,
    loopState: "idle",
    civs: initialCivs(),
    timeline: [],
    saves: [],
    answers: {},
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(BACKEND_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setState((s) => ({ ...s, connected: true, reconnecting: false }));
      };

      // O backend retoma a partida e reenvia `world_init` + `history` a cada
      // conexão, então reconectar restaura a UI inteira sem perder nada.
      ws.onclose = () => {
        if (disposed) return;
        const delay = Math.min(RECONNECT_MAX_MS, 500 * 2 ** attempt);
        attempt += 1;
        setState((s) => ({ ...s, connected: false, reconnecting: true }));
        retryTimer = setTimeout(connect, delay);
      };

      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        setState((s) => reduceMessage(s, msg));
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
    };
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
  const listSaves = useCallback(() => send({ type: "command", action: "list_saves" }), [send]);
  const newGame = useCallback(
    (opts: { name?: string; seed?: number; speedMs?: number } = {}) =>
      send({ type: "command", action: "new_game", ...opts }),
    [send],
  );
  const loadGame = useCallback(
    (gameId: string) => send({ type: "command", action: "load_game", gameId }),
    [send],
  );
  const ask = useCallback(
    (civ: CivId, question: string) => {
      setState((s) => ({ ...s, answers: { ...s.answers, [civ]: { status: "loading", question } } }));
      send({ type: "command", action: "ask", civ, question });
    },
    [send],
  );

  return { state, play, pause, stop, step, setSpeed, listSaves, newGame, loadGame, ask, civIds: CIV_IDS };
}
