import { eventHasCiv } from "../simulationInsights";
import { CIV_COLOR, CIV_LABEL, describeEvent, type CivId, type GameEvent, type World } from "../types";
import type { CivUiState } from "../useGameSocket";

interface Props {
  world: World | null;
  selected: CivId;
  ui: CivUiState;
  events: GameEvent[];
}

const CIV_EPITHET: Record<CivId, string> = {
  rome: "Legiões e estradas",
  egypt: "Nilo, comércio e muralhas",
  greece: "Ciência, portos e cultura",
  mali: "Ouro, diplomacia e caravanas",
};

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(2, Math.min(100, Math.round((value / total) * 100)));
}

function actionName(tool: string): string {
  const labels: Record<string, string> = {
    build: "Construção",
    research: "Pesquisa",
    move_army: "Movimento",
    attack: "Ataque",
    set_diplomacy: "Diplomacia",
    trade: "Comércio",
    set_strategy: "Estratégia",
  };
  return labels[tool] ?? tool;
}

export function EraInspector({ world, selected, ui, events }: Props) {
  const civ = world?.civilizations[selected];
  const total = Math.max(1, (civ?.resources.food ?? 0) + (civ?.resources.gold ?? 0) + (civ?.resources.science ?? 0));
  const recent = events.filter((e) => eventHasCiv(e, selected)).slice(0, 5);

  return (
    <aside className="era-inspector" style={{ "--civ": CIV_COLOR[selected] } as React.CSSProperties}>
      <div className={`scene-image scene-${selected}`}>
        <div className="scene-glow" />
        <span>{CIV_LABEL[selected]}</span>
      </div>

      <section className="inspector-card identity-card">
        <div>
          <p className="eyebrow">Civilização selecionada</p>
          <h2>{CIV_LABEL[selected]}</h2>
          <p>{CIV_EPITHET[selected]}</p>
        </div>
        <span className={`thinking-orb ${ui.status}`}>{ui.status === "thinking" ? "IA" : "✓"}</span>
      </section>

      <section className="inspector-card resource-card">
        <h3>Forças de evolução</h3>
        <div className="resource-row">
          <span>Alimento</span>
          <div className="resource-track"><i style={{ width: `${pct(civ?.resources.food ?? 0, total)}%` }} /></div>
          <b>{civ?.resources.food ?? 0}</b>
        </div>
        <div className="resource-row">
          <span>Ouro</span>
          <div className="resource-track gold"><i style={{ width: `${pct(civ?.resources.gold ?? 0, total)}%` }} /></div>
          <b>{civ?.resources.gold ?? 0}</b>
        </div>
        <div className="resource-row">
          <span>Ciência</span>
          <div className="resource-track science"><i style={{ width: `${pct(civ?.resources.science ?? 0, total)}%` }} /></div>
          <b>{civ?.resources.science ?? 0}</b>
        </div>
      </section>

      <section className="inspector-card decision-card">
        <h3>Decisão da IA</h3>
        {ui.status === "thinking" ? (
          <p className="live-text">O agente está deliberando… {ui.chunksReceived} fragmento(s)</p>
        ) : ui.reasoning ? (
          <p className="quote">“{ui.reasoning}”</p>
        ) : (
          <p className="muted">Nenhuma decisão registrada ainda.</p>
        )}
        <div className="action-pills">
          {ui.actions.length === 0 ? <span className="empty-pill">sem ações</span> : ui.actions.map((a, i) => <span key={i}>{actionName(a.tool)}</span>)}
        </div>
      </section>

      <section className="inspector-card mini-events-card">
        <h3>Eventos conectados</h3>
        <ul className="mini-events">
          {recent.length === 0 ? (
            <li className="muted">Sem eventos recentes desta civilização.</li>
          ) : (
            recent.map((e, i) => <li key={i}>{describeEvent(e)}</li>)
          )}
        </ul>
      </section>
    </aside>
  );
}
