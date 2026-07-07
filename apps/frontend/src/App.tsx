import { Controls } from "./components/Controls";
import { CivPanel } from "./components/CivPanel";
import { EventTimeline } from "./components/EventTimeline";
import { WorldMap } from "./components/WorldMap";
import { useGameSocket } from "./useGameSocket";

export function App() {
  const { state, play, pause, stop, step, setSpeed, civIds } = useGameSocket();
  const { world, loopState, civs, connected, runner, healthy } = state;

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>GeniusAI Civilizations</h1>
          <p className="tag">Watchable AI — observe, não comande</p>
        </div>
        <div className="status-chip">
          <span className={connected ? "ok" : "bad"}>{connected ? "● conectado" : "○ desconectado"}</span>
          <span className="muted">
            runner: <b>{runner ?? "—"}</b>
          </span>
          <span className={healthy ? "ok" : healthy === false ? "bad" : "muted"}>
            {healthy === undefined ? "" : healthy ? "saudável" : "indisponível"}
          </span>
        </div>
      </header>

      <Controls
        loopState={loopState}
        tick={world?.tick ?? 0}
        onPlay={play}
        onPause={pause}
        onStop={stop}
        onStep={step}
        onSpeedChange={setSpeed}
      />

      <div className="layout">
        <WorldMap world={world} />

        <div className="civ-grid">
          {civIds.map((id) => (
            <CivPanel key={id} civId={id} civ={world?.civilizations[id]} ui={civs[id]} />
          ))}
        </div>
      </div>

      <EventTimeline events={state.timeline} />
    </main>
  );
}
