import { useEffect, useState } from "react";
import { AskCivilizationPanel } from "./components/AskCivilizationPanel";
import { ChroniclePanel } from "./components/ChroniclePanel";
import { CivilizationRail } from "./components/CivilizationRail";
import { Controls } from "./components/Controls";
import { CrisisPanel } from "./components/CrisisPanel";
import { DiplomacyGraph } from "./components/DiplomacyGraph";
import { EraInspector } from "./components/EraInspector";
import { EraTimeline } from "./components/EraTimeline";
import { EventTimeline } from "./components/EventTimeline";
import { EvolutionBoard } from "./components/EvolutionBoard";
import { MuseumMode } from "./components/MuseumMode";
import { SavesPanel } from "./components/SavesPanel";
import { TechTreePanel } from "./components/TechTreePanel";
import { WorldMap } from "./components/WorldMap";
import { useGameSocket } from "./useGameSocket";
import type { CivId } from "./types";

type ViewMode = "evolution" | "world" | "chronicle";
type Theme = "light" | "dark";

const VIEWS: Array<{ id: ViewMode; label: string }> = [
  { id: "evolution", label: "Evolução" },
  { id: "world", label: "Mundo & Diplomacia" },
  { id: "chronicle", label: "Crônicas" },
];

const THEME_KEY = "geniusai-theme";

function initialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const { state, play, pause, stop, step, setSpeed, listSaves, newGame, loadGame } = useGameSocket();
  const { world, loopState, civs, connected, reconnecting, runner, healthy } = state;
  const [selected, setSelected] = useState<CivId>("rome");
  const [view, setView] = useState<ViewMode>("evolution");
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Atalhos: espaço = play/pause, S = step (fora de campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        loopState === "running" ? pause() : play();
      } else if (e.key === "s" || e.key === "S") {
        if (loopState !== "running") step();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loopState, play, pause, step]);

  const connectionLabel = connected ? "● conectado" : reconnecting ? "◌ reconectando…" : "○ desconectado";

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
          {VIEWS.map((v) => (
            <button key={v.id} className={view === v.id ? "active" : ""} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </nav>
        <div className="status-strip">
          <span className={connected ? "ok" : "bad"}>{connectionLabel}</span>
          <span>runner <b>{runner ?? "—"}</b></span>
          <span className={healthy ? "ok" : healthy === false ? "bad" : "muted"}>
            {healthy === undefined ? "verificando" : healthy ? "saudável" : "indisponível"}
          </span>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
            aria-label="Alternar tema"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
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

      {view === "evolution" && (
        <div className="factor-layout view-enter">
          <CivilizationRail world={world} civs={civs} selected={selected} onSelect={setSelected} />
          <EvolutionBoard world={world} civs={civs} selected={selected} events={state.timeline} onSelect={setSelected} />
          <EraInspector world={world} selected={selected} ui={civs[selected]} events={state.timeline} />
        </div>
      )}

      {view === "world" && (
        <div className="world-layout view-enter">
          <div className="world-column">
            <WorldMap world={world} selected={selected} theme={theme} />
            <CrisisPanel world={world} events={state.timeline} onSelect={setSelected} />
          </div>
          <div className="world-column">
            <DiplomacyGraph world={world} selected={selected} onSelect={setSelected} />
            <TechTreePanel world={world} selected={selected} />
          </div>
        </div>
      )}

      {view === "chronicle" && (
        <div className="chronicle-layout view-enter">
          <EraTimeline world={world} />
          <div className="split">
            <ChroniclePanel events={state.timeline} />
            <AskCivilizationPanel world={world} selected={selected} events={state.timeline} />
          </div>
          <MuseumMode world={world} events={state.timeline} selected={selected} />
        </div>
      )}

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
    </main>
  );
}
