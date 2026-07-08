import { deriveCrises, type CrisisSignal } from "../simulationInsights";
import { CIV_COLOR, CIV_LABEL, type CivId, type GameEvent, type World } from "../types";

interface Props {
  world: World | null;
  events: GameEvent[];
  onSelect: (id: CivId) => void;
}

const SEVERITY_LABEL: Record<CrisisSignal["severity"], string> = {
  baixa: "baixa",
  média: "média",
  alta: "alta",
};

export function CrisisPanel({ world, events, onSelect }: Props) {
  const crises = deriveCrises(world, events);
  return (
    <section className="living-card crisis-card">
      <div className="living-card-head">
        <div>
          <p className="eyebrow">Sistema de crises</p>
          <h2>Alertas históricos</h2>
        </div>
        <span className={`crisis-count ${crises.some((c) => c.severity === "alta") ? "hot" : ""}`}>{crises.length}</span>
      </div>
      <div className="crisis-list">
        {crises.length === 0 ? (
          <p className="muted">Nenhuma crise crítica detectada. O mundo está respirando antes da próxima virada.</p>
        ) : (
          crises.map((crisis) => (
            <button
              key={crisis.id}
              className={`crisis-item ${crisis.severity}`}
              onClick={() => crisis.civ && onSelect(crisis.civ)}
              style={crisis.civ ? ({ "--civ": CIV_COLOR[crisis.civ] } as React.CSSProperties) : undefined}
            >
              <span>{crisis.civ ? CIV_LABEL[crisis.civ] : "Mundo"}</span>
              <strong>{crisis.title}</strong>
              <em>{SEVERITY_LABEL[crisis.severity]}</em>
              <small>{crisis.detail}</small>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
