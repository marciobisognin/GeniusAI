import { buildChronicle } from "../simulationInsights";
import { describeEvent, type GameEvent } from "../types";

interface Props {
  events: GameEvent[];
}

export function ChroniclePanel({ events }: Props) {
  const chapters = buildChronicle(events);
  return (
    <section className="living-card chronicle-card">
      <div className="living-card-head">
        <div>
          <p className="eyebrow">Crônica narrativa</p>
          <h2>Livro vivo da simulação</h2>
        </div>
        <span className="soft-chip">{events.length} eventos</span>
      </div>
      <div className="chronicle-grid">
        {chapters.map((chapter) => (
          <article key={chapter.title}>
            <h3>{chapter.title}</h3>
            <p>{chapter.subtitle}</p>
            <ul>
              {chapter.events.length === 0 ? (
                <li className="muted">capítulo aguardando acontecimentos</li>
              ) : (
                chapter.events.slice(0, 3).map((event, i) => <li key={i}>{describeEvent(event)}</li>)
              )}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
