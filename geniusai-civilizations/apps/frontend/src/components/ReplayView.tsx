import { useEffect, useRef, useState } from "react";
import { CivilizationRail } from "./CivilizationRail";
import { WorldMap } from "./WorldMap";
import type { CivId, World } from "../types";
import type { CivUiState } from "../useGameSocket";

interface Props {
  gameId: string;
  ticks: World[];
  theme: "light" | "dark";
  selected: CivId;
  onSelect: (civ: CivId) => void;
  onExit: () => void;
}

const PLAY_INTERVAL_MS = 700;

/** CivilizationRail espera o estado "ao vivo" de cada civ — no replay não há
 * raciocínio/streaming, só o snapshot do World naquele tick, então cada civ
 * aparece "concluída" sem texto (a rail só usa isto para status/contadores). */
const idleUi: CivUiState = {
  status: "idle",
  chunksReceived: 0,
  rawStream: "",
  reasoning: "",
  actions: [],
  passed: false,
  errors: [],
  advisorRecommendations: [],
};
const REPLAY_CIVS: Record<CivId, CivUiState> = { rome: idleUi, egypt: idleUi, greece: idleUi, mali: idleUi };

/**
 * Modo replay (Fase 21, §21 — RF-25): reproduz o histórico reconstruído por
 * `replayFromTrace` no backend — um scrubber sobre `ticks[index]`, com
 * play/pause automático, reaproveitando o mesmo WorldMap da partida ao vivo.
 */
export function ReplayView({ gameId, ticks, theme, selected, onSelect, onExit }: Props) {
  const [index, setIndex] = useState(ticks.length - 1);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => {
        if (i >= ticks.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [playing, ticks.length]);

  const world = ticks[index] ?? null;
  const atEnd = index >= ticks.length - 1;

  return (
    <div className="replay-view view-enter">
      <div className="replay-banner" role="status">
        <span className="replay-banner-badge">MODO REPLAY</span>
        <span className="muted">{gameId}</span>
        <button className="btn btn-small replay-exit" onClick={onExit}>
          ✕ sair do replay
        </button>
      </div>

      <div className="replay-scrubber">
        <button
          className="btn btn-small"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pausar reprodução" : "Reproduzir automaticamente"}
        >
          {playing ? "⏸ pausar" : "▶ reproduzir"}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, ticks.length - 1)}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
          aria-label="Tick da partida"
          className="replay-range"
        />
        <span className="replay-tick-label">
          tick {world?.tick ?? 0} / {ticks.length - 1}
        </span>
        {atEnd && <span className="muted">fim da partida</span>}
      </div>

      <div className="factor-layout">
        <CivilizationRail world={world} civs={REPLAY_CIVS} selected={selected} onSelect={onSelect} />
        <WorldMap world={world} selected={selected} theme={theme} highlight={null} />
      </div>
    </div>
  );
}
