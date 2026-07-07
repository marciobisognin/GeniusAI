import { CIV_COLOR, CIV_IDS, CIV_LABEL, type CivId, type World } from "../types";
import type { CivUiState } from "../useGameSocket";

interface Props {
  world: World | null;
  civs: Record<CivId, CivUiState>;
  selected: CivId;
  onSelect: (id: CivId) => void;
}

const CIV_ICON: Record<CivId, string> = {
  rome: "🏛️",
  egypt: "𓂀",
  greece: "⚓",
  mali: "☀️",
};

function clampPct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(4, Math.min(100, Math.round((value / max) * 100)));
}

export function CivilizationRail({ world, civs, selected, onSelect }: Props) {
  const maxGold = Math.max(1, ...CIV_IDS.map((id) => world?.civilizations[id]?.resources.gold ?? 0));
  const maxFood = Math.max(1, ...CIV_IDS.map((id) => world?.civilizations[id]?.resources.food ?? 0));

  return (
    <aside className="civilization-rail" aria-label="Civilizações">
      <div className="rail-title">
        <span className="brand-mark">E</span>
        <div>
          <strong>Evolution Factor</strong>
          <small>civilizações vivas</small>
        </div>
      </div>

      <div className="rail-list">
        {CIV_IDS.map((id) => {
          const civ = world?.civilizations[id];
          const ui = civs[id];
          const active = selected === id;
          const thinking = ui.status === "thinking";
          return (
            <button
              key={id}
              className={`rail-civ ${active ? "selected" : ""} ${thinking ? "thinking" : ""}`}
              onClick={() => onSelect(id)}
              style={{ "--civ": CIV_COLOR[id] } as React.CSSProperties}
            >
              <span className={`civ-avatar civ-avatar-${id}`}>{CIV_ICON[id]}</span>
              <span className="rail-civ-body">
                <span className="rail-civ-head">
                  <strong>{CIV_LABEL[id]}</strong>
                  <em>{thinking ? "decidindo" : ui.status === "done" ? "agiu" : "aguarda"}</em>
                </span>
                <span className="rail-bars">
                  <span className="mini-bar food" style={{ width: `${clampPct(civ?.resources.food ?? 0, maxFood)}%` }} />
                  <span className="mini-bar gold" style={{ width: `${clampPct(civ?.resources.gold ?? 0, maxGold)}%` }} />
                </span>
                <span className="rail-meta">
                  <span>{civ?.cities.length ?? 0} cidades</span>
                  <span>{civ?.tech.length ?? 0} tecs</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
