import { useMemo, useState } from "react";
import {
  EVENT_CATEGORIES,
  categorizeEvent,
  describeEvent,
  eventCoords,
  type EventCategory,
  type GameEvent,
} from "../types";

interface Props {
  events: GameEvent[];
  onLocate?: (x: number, y: number) => void;
}

const PAGE_SIZE = 20;

/** Timeline paginada e filtrável por categoria (Fase 17, §17 do PRD — RF-11). */
export function EventTimeline({ events, onLocate }: Props) {
  const [activeCategories, setActiveCategories] = useState<Set<EventCategory>>(new Set());
  const [page, setPage] = useState(0);

  const counts = useMemo(() => {
    const c: Record<EventCategory, number> = { economia: 0, "construção": 0, "ciência": 0, diplomacia: 0, guerra: 0, agentes: 0, sistema: 0 };
    for (const e of events) c[categorizeEvent(e)] += 1;
    return c;
  }, [events]);

  const filtered = useMemo(
    () => (activeCategories.size === 0 ? events : events.filter((e) => activeCategories.has(categorizeEvent(e)))),
    [events, activeCategories],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  function toggleCategory(cat: EventCategory): void {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
    setPage(0);
  }

  return (
    <section className="card timeline-card">
      <div className="timeline-head">
        <h2>Linha do tempo</h2>
        <div className="timeline-filters" role="group" aria-label="Filtrar por categoria">
          {EVENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`filter-chip ${activeCategories.has(cat) ? "active" : ""}`}
              onClick={() => toggleCategory(cat)}
              aria-pressed={activeCategories.has(cat)}
            >
              {cat} <b>{counts[cat]}</b>
            </button>
          ))}
        </div>
      </div>

      {/* RNF-004: anuncia só o evento mais recente a leitores de tela — a
          lista inteira não é `aria-live` para não gerar leitura em massa a
          cada tick. */}
      <div className="sr-only" aria-live="polite" role="status">
        {events.length > 0 ? describeEvent(events[0]) : ""}
      </div>

      <ul className="timeline">
        {pageItems.length === 0 ? (
          <li className="muted">
            {events.length === 0 ? "nenhum evento ainda — dê play para começar." : "nenhum evento nesta categoria."}
          </li>
        ) : (
          pageItems.map((e, i) => {
            const cls =
              e.type === "tick_started" ? "timeline-tick" : e.type === "narration" ? "timeline-narration" : undefined;
            const coords = eventCoords(e);
            return (
              <li key={i} className={cls}>
                <span>{describeEvent(e)}</span>
                {coords && onLocate && (
                  <button className="locate-link" onClick={() => onLocate(coords.x, coords.y)}>
                    localizar no mapa
                  </button>
                )}
              </li>
            );
          })
        )}
      </ul>

      {pageCount > 1 && (
        <div className="timeline-pagination">
          <button disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}>
            ← anterior
          </button>
          <span>
            página {clampedPage + 1} de {pageCount} · {filtered.length} evento(s)
          </span>
          <button disabled={clampedPage >= pageCount - 1} onClick={() => setPage(clampedPage + 1)}>
            próxima →
          </button>
        </div>
      )}
    </section>
  );
}
