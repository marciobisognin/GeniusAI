import { AskCivilizationPanel } from "./AskCivilizationPanel";
import { ChroniclePanel } from "./ChroniclePanel";
import { CrisisPanel } from "./CrisisPanel";
import { DiplomacyGraph } from "./DiplomacyGraph";
import { EraTimeline } from "./EraTimeline";
import { MuseumMode } from "./MuseumMode";
import { TechTreePanel } from "./TechTreePanel";
import type { CivId, GameEvent, World } from "../types";

interface Props {
  world: World | null;
  events: GameEvent[];
  selected: CivId;
  onSelect: (id: CivId) => void;
}

export function LivingHistoryMode({ world, events, selected, onSelect }: Props) {
  return (
    <section className="living-history-mode" aria-label="Modo História Viva">
      <div className="living-title-card">
        <div>
          <p className="eyebrow">Living History Mode</p>
          <h2>Observatório vivo de civilizações</h2>
          <p>
            Eras, diplomacia, tecnologia, crises, crônica, Museu Vivo e perguntas em primeira pessoa — tudo derivado do estado real da simulação.
          </p>
        </div>
        <div className="living-metrics">
          <span><b>{world?.tick ?? 0}</b><small>tick</small></span>
          <span><b>{events.length}</b><small>eventos</small></span>
          <span><b>{world ? Object.values(world.civilizations).filter((c) => c.alive).length : 0}</b><small>vivas</small></span>
        </div>
      </div>

      <div className="living-grid top">
        <EraTimeline world={world} />
        <DiplomacyGraph world={world} selected={selected} onSelect={onSelect} />
        <TechTreePanel world={world} selected={selected} />
      </div>

      <div className="living-grid middle">
        <CrisisPanel world={world} events={events} onSelect={onSelect} />
        <AskCivilizationPanel world={world} selected={selected} events={events} />
      </div>

      <div className="living-grid bottom">
        <ChroniclePanel events={events} />
        <MuseumMode world={world} events={events} selected={selected} />
      </div>
    </section>
  );
}
