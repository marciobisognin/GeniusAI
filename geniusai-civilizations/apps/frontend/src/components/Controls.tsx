import { useState } from "react";
import type { LoopState } from "../types";

interface Props {
  loopState: LoopState;
  tick: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStep: () => void;
  onSpeedChange: (ms: number) => void;
}

const SPEED_PRESETS = [
  { label: "0.5×", ms: 4000 },
  { label: "1×", ms: 2000 },
  { label: "2×", ms: 1000 },
  { label: "4×", ms: 500 },
];

export function Controls({ loopState, tick, onPlay, onPause, onStop, onStep, onSpeedChange }: Props) {
  const [speedIdx, setSpeedIdx] = useState(1);
  const isRunning = loopState === "running";

  return (
    <section className="card controls">
      <div className="controls-row">
        <button onClick={isRunning ? onPause : onPlay} className="btn btn-primary">
          {isRunning ? "⏸ Pausar" : "▶ Play"}
        </button>
        <button onClick={onStep} disabled={isRunning} className="btn">
          ⏭ Step
        </button>
        <button onClick={onStop} disabled={loopState === "stopped"} className="btn">
          ⏹ Stop
        </button>
        <div className="speed-group">
          {SPEED_PRESETS.map((p, i) => (
            <button
              key={p.label}
              className={`btn btn-speed ${i === speedIdx ? "active" : ""}`}
              onClick={() => {
                setSpeedIdx(i);
                onSpeedChange(p.ms);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="controls-meta">
        <span>Tick: {tick}</span>
        <span className={`loop-state ${loopState}`}>{loopState}</span>
        <span><kbd>espaço</kbd> play/pause · <kbd>S</kbd> step</span>
      </div>
    </section>
  );
}
