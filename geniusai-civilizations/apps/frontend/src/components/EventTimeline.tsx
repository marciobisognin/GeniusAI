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
          events.map((e, i) => {
            const cls =
              e.type === "tick_started" ? "timeline-tick" : e.type === "narration" ? "timeline-narration" : undefined;
            return (
              <li key={i} className={cls}>
                {describeEvent(e)}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
