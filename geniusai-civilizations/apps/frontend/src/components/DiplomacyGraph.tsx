import type { CSSProperties } from "react";
import { CIV_COLOR, CIV_IDS, CIV_LABEL, type CivId, type Stance, type World } from "../types";

interface Props {
  world: World | null;
  selected: CivId;
  onSelect: (id: CivId) => void;
}

const POS: Record<CivId, { x: number; y: number }> = {
  rome: { x: 25, y: 28 },
  egypt: { x: 75, y: 28 },
  greece: { x: 28, y: 74 },
  mali: { x: 74, y: 72 },
};

const STANCE_LABEL: Record<Stance, string> = {
  peace: "paz",
  war: "guerra",
  alliance: "aliança",
  trade: "comércio",
};

function relation(world: World | null, a: CivId, b: CivId): Stance {
  if (!world) return "peace";
  const key = [a, b].sort().join("|");
  return world.diplomacy[key] ?? "peace";
}

function pathFor(a: CivId, b: CivId): string {
  const p1 = POS[a];
  const p2 = POS[b];
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2 - 10;
  return `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
}

export function DiplomacyGraph({ world, selected, onSelect }: Props) {
  const pairs: Array<[CivId, CivId]> = [
    ["rome", "egypt"],
    ["rome", "greece"],
    ["rome", "mali"],
    ["egypt", "greece"],
    ["egypt", "mali"],
    ["greece", "mali"],
  ];
  return (
    <section className="living-card diplomacy-graph-card">
      <div className="living-card-head">
        <div>
          <p className="eyebrow">Diplomacia animada</p>
          <h2>Rede de poder</h2>
        </div>
        <span className="soft-chip">{world ? `${Object.keys(world.diplomacy).length} vínculos` : "aguardando"}</span>
      </div>
      <div className="diplomacy-stage">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          {pairs.map(([a, b]) => {
            const stance = relation(world, a, b);
            return <path key={`${a}-${b}`} className={`diplo-line ${stance}`} d={pathFor(a, b)} />;
          })}
        </svg>
        {CIV_IDS.map((id) => (
          <button
            key={id}
            className={`diplo-node ${selected === id ? "selected" : ""}`}
            style={{ left: `${POS[id].x}%`, top: `${POS[id].y}%`, "--civ": CIV_COLOR[id] } as CSSProperties}
            onClick={() => onSelect(id)}
          >
            <b>{CIV_LABEL[id]}</b>
            <small>{world?.civilizations[id].alive ? "ativa" : "legado"}</small>
          </button>
        ))}
      </div>
      <div className="diplo-legend">
        {(["alliance", "trade", "war", "peace"] as Stance[]).map((s) => <span key={s} className={s}>{STANCE_LABEL[s]}</span>)}
      </div>
    </section>
  );
}
