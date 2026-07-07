import { useState } from "react";
import { Controls } from "./components/Controls";
import { CivilizationRail } from "./components/CivilizationRail";
import { EraInspector } from "./components/EraInspector";
import { EventTimeline } from "./components/EventTimeline";
import { EvolutionBoard } from "./components/EvolutionBoard";
import { SavesPanel } from "./components/SavesPanel";
import { useGameSocket } from "./useGameSocket";
import type { CivId } from "./types";

export function App() {
  const { state, play, pause, stop, step, setSpeed, listSaves, newGame, loadGame, civIds } = useGameSocket();
  const { world, loopState, civs, connected, runner, healthy } = state;
  const [selected, setSelected] = useState<CivId>("rome");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-seal">G</span>
          <div>
            <h1>GeniusAI Civilizations</h1>
            <p>Simulação observável · civilizações decidindo por LLM</p>
          </div>
        </div>
        <nav className="topbar-tabs" aria-label="Modos de visualização">
          <span className="active">Evolução</span>
          <span>Diplomacia</span>
          <span>Crônicas</span>
        </nav>
        <div className="status-strip">
          <span className={connected ? "ok" : "bad"}>{connected ? "● conectado" : "○ desconectado"}</span>
          <span>runner <b>{runner ?? "—"}</b></span>
          <span className={healthy ? "ok" : healthy === false ? "bad" : "muted"}>
            {healthy === undefined ? "verificando" : healthy ? "saudável" : "indisponível"}
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

      <div className="factor-layout">
        <CivilizationRail world={world} civs={civs} selected={selected} onSelect={setSelected} />
        <EvolutionBoard world={world} civs={civs} selected={selected} events={state.timeline} onSelect={setSelected} />
        <EraInspector world={world} selected={selected} ui={civs[selected]} events={state.timeline} />
      </div>

      <div className="lower-dock">
        <EventTimeline events={state.timeline} />
        <SavesPanel
          saves={state.saves}
          currentGameId={state.gameId}
          lastError={state.lastError}
          onListSaves={listSaves}
          onNewGame={() => newGame()}
          onLoadGame={loadGame}
        />
      </div>

      <footer className="reference-note">
        Reconstrução local inspirada no vídeo de referência: canvas claro, nós evolutivos, linhas curvas, inspector visual e feedback de IA em tempo real.
      </footer>
    </main>
  );
}
