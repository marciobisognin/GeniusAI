import { describeEvent, type GameEvent } from "../types";

interface Props {
  events: GameEvent[];
}

export function EventTimeline({ events }: Props) {
  return (
    <section className="card timeline-card">
      <h2>Linha do tempo</h2>
      <ul className="timeline">
        {events.length === 0 ? (
          <li className="muted">nenhum evento ainda — dê play para começar.</li>
        ) : (
          events.map((e, i) => (
            <li key={i} className={e.type === "tick_started" ? "timeline-tick" : undefined}>
              {describeEvent(e)}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
