import { CIV_COLOR, CIV_IDS, CIV_LABEL, describeEvent, type CivId, type GameEvent, type World } from "../types";
import type { CivUiState } from "../useGameSocket";

interface Props {
  world: World | null;
  civs: Record<CivId, CivUiState>;
  selected: CivId;
  events: GameEvent[];
  onSelect: (id: CivId) => void;
}

const POS: Record<CivId, { x: number; y: number }> = {
  rome: { x: 35, y: 29 },
  egypt: { x: 67, y: 27 },
  greece: { x: 36, y: 68 },
  mali: { x: 68, y: 67 },
};

const CIV_SYMBOL: Record<CivId, string> = {
  rome: "SPQR",
  egypt: "NILO",
  greece: "AGORA",
  mali: "MANSA",
};

function actionTitle(tool: string): string {
  const labels: Record<string, string> = {
    build: "Obra erguida",
    research: "Ideia em pesquisa",
    move_army: "Exército em marcha",
    attack: "Conflito aberto",
    recruit: "Exército recrutado",
    set_diplomacy: "Diplomacia alterada",
    propose_trade: "Proposta comercial",
    propose_alliance: "Proposta de aliança",
    respond_proposal: "Resposta diplomática",
    set_strategy: "Doutrina atualizada",
  };
  return labels[tool] ?? "Ação civilizacional";
}

function terrainClass(owner: CivId | null): string {
  return owner ? `owner-${owner}` : "owner-none";
}

export function EvolutionBoard({ world, civs, selected, events, onSelect }: Props) {
  const recentToast = events.slice(0, 3);
  const selectedCiv = world?.civilizations[selected];

  return (
    <section className="evolution-board" aria-label="Mapa de evolução das civilizações">
      <div className="board-toolbar">
        <div>
          <p className="eyebrow">Canvas de evolução</p>
          <h2>Dinâmica histórica emergente</h2>
        </div>
        <div className="age-chip">Tick {world?.tick ?? 0}</div>
      </div>

      <div className="toast-stack">
        {recentToast.map((e, i) => (
          <div className="event-toast" key={i}>{describeEvent(e)}</div>
        ))}
      </div>

      <svg className="evolution-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="trunk" d="M50 50 C42 42 40 35 35 29" />
        <path className="trunk" d="M50 50 C58 41 62 33 67 27" />
        <path className="trunk" d="M50 50 C43 58 40 63 36 68" />
        <path className="trunk" d="M50 50 C59 57 63 62 68 67" />
        <path className="pulse-path" d="M35 29 C49 24 58 23 67 27" />
        <path className="pulse-path alt" d="M36 68 C50 76 58 74 68 67" />
      </svg>

      <div className="origin-node">
        <span>Era 0</span>
        <strong>mundo inicial</strong>
      </div>

      {world?.map && (
        <div className="territory-mini-map" title="Território real do motor">
          {world.map.flat().map((tile) => (
            <span key={`${tile.x}-${tile.y}`} className={terrainClass(tile.owner)} />
          ))}
        </div>
      )}

      {CIV_IDS.map((id) => {
        const civ = world?.civilizations[id];
        const ui = civs[id];
        const p = POS[id];
        const lastAction = ui.actions[0]?.tool;
        const isSelected = selected === id;
        const isThinking = ui.status === "thinking";
        return (
          <button
            key={id}
            className={`evolution-node ${isSelected ? "selected" : ""} ${isThinking ? "thinking" : ""}`}
            style={{ left: `${p.x}%`, top: `${p.y}%`, "--civ": CIV_COLOR[id] } as React.CSSProperties}
            onClick={() => onSelect(id)}
          >
            <span className="node-badge">{CIV_SYMBOL[id]}</span>
            <strong>{lastAction ? actionTitle(lastAction) : CIV_LABEL[id]}</strong>
            <em>{civ?.researching ?? civ?.tech.at(-1) ?? "fundação"}</em>
            <small>{civ?.cities.length ?? 0} cidades · {civ?.armies.length ?? 0} exércitos</small>
          </button>
        );
      })}

      <div className="side-node left-node">
        <span>Memória</span>
        <strong>{selectedCiv?.memory ? "estratégia acumulada" : "sem crônica ainda"}</strong>
      </div>
      <div className="side-node right-node">
        <span>Pesquisa</span>
        <strong>{selectedCiv?.researching ?? selectedCiv?.tech.at(-1) ?? "aguardando tecnologia"}</strong>
      </div>
      <div className="side-node bottom-node">
        <span>Próxima virada</span>
        <strong>{civs[selected].status === "thinking" ? "decisão em curso" : "avance um step"}</strong>
      </div>
    </section>
  );
}
