import { getEraProgress, ERA_STAGES } from "../simulationInsights";
import type { World } from "../types";

interface Props {
  world: World | null;
}

export function EraTimeline({ world }: Props) {
  const progress = getEraProgress(world?.tick ?? 0);
  return (
    <section className="living-card era-timeline-card">
      <div className="living-card-head">
        <div>
          <p className="eyebrow">Linha das eras</p>
          <h2>{progress.current.label}</h2>
        </div>
        <span className="era-progress-chip">{progress.progress}%</span>
      </div>
      <div className="era-track" aria-label="Progresso histórico">
        <i style={{ width: `${progress.progress}%` }} />
        {ERA_STAGES.map((era) => (
          <span
            key={era.key}
            className={world && world.tick >= era.tick ? "reached" : ""}
            style={{ left: `${Math.min(100, (era.tick / ERA_STAGES.at(-1)!.tick) * 100)}%` }}
            title={`${era.label}: ${era.description}`}
          />
        ))}
      </div>
      <div className="era-steps">
        {ERA_STAGES.map((era) => (
          <div key={era.key} className={world && world.tick >= era.tick ? "active" : ""}>
            <strong>{era.label}</strong>
            <small>tick {era.tick}</small>
          </div>
        ))}
      </div>
      <p className="era-description">
        {progress.current.description}{progress.next ? ` · próxima: ${progress.next.label}` : " · última era alcançada"}
      </p>
    </section>
  );
}
