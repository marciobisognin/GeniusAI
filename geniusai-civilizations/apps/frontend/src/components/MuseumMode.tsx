import { buildMuseumRooms } from "../simulationInsights";
import { CIV_COLOR, type CivId, type GameEvent, type World } from "../types";

interface Props {
  world: World | null;
  events: GameEvent[];
  selected: CivId;
}

function roomColor(accent: CivId | "world", selected: CivId): string {
  if (accent === "world") return "#a66d2c";
  return CIV_COLOR[accent] ?? CIV_COLOR[selected];
}

export function MuseumMode({ world, events, selected }: Props) {
  const rooms = buildMuseumRooms(world, events);
  return (
    <section className="living-card museum-card">
      <div className="living-card-head">
        <div>
          <p className="eyebrow">Museu Vivo</p>
          <h2>Exposição da história emergente</h2>
        </div>
        <span className="soft-chip">{rooms.length} salas</span>
      </div>
      <div className="museum-rooms">
        {rooms.map((room, index) => (
          <article key={room.title} style={{ "--civ": roomColor(room.accent, selected) } as React.CSSProperties}>
            <span className="room-number">0{index + 1}</span>
            <h3>{room.title}</h3>
            <p>{room.curatorNote}</p>
            <ul>
              {room.artifacts.map((artifact, i) => <li key={i}>{artifact}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
