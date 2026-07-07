import { CIV_COLOR, CIV_LABEL, type Civilization, type CivId } from "../types";
import type { CivUiState } from "../useGameSocket";

interface Props {
  civId: CivId;
  civ: Civilization | undefined;
  ui: CivUiState;
}

function actionLabel(tool: string): string {
  const labels: Record<string, string> = {
    build: "construir",
    research: "pesquisar",
    move_army: "mover exército",
    attack: "atacar",
    set_diplomacy: "diplomacia",
    trade: "comércio",
    set_strategy: "estratégia",
  };
  return labels[tool] ?? tool;
}

export function CivPanel({ civId, civ, ui }: Props) {
  const color = CIV_COLOR[civId];
  const alive = civ?.alive ?? true;

  return (
    <section className="card civ-panel" style={{ borderTopColor: color }}>
      <header className="civ-header">
        <span className="civ-dot" style={{ background: color }} />
        <h2>{CIV_LABEL[civId]}</h2>
        <span className={`civ-status ${ui.status}`}>
          {!alive ? "eliminada" : ui.status === "thinking" ? "pensando…" : ui.status === "done" ? "agiu" : "aguardando"}
        </span>
      </header>

      {civ && (
        <div className="civ-stats">
          <span>🌾 {civ.resources.food}</span>
          <span>💰 {civ.resources.gold}</span>
          <span>🔬 {civ.resources.science}</span>
          <span>🏙️ {civ.cities.length}</span>
          <span>⚔️ {civ.armies.length}</span>
          <span>📜 {civ.tech.length} tecs</span>
        </div>
      )}

      <div className="civ-reasoning">
        {ui.status === "thinking" ? (
          <p className="muted">
            processando… ({ui.chunksReceived} fragmento{ui.chunksReceived === 1 ? "" : "s"} recebido
            {ui.chunksReceived === 1 ? "" : "s"})
          </p>
        ) : ui.reasoning ? (
          <p>“{ui.reasoning}”</p>
        ) : (
          <p className="muted">sem raciocínio ainda neste jogo.</p>
        )}

        {ui.passed && <p className="bad">turno passado (sem resposta válida do agente)</p>}

        {ui.actions.length > 0 && (
          <ul className="civ-actions">
            {ui.actions.map((a, i) => (
              <li key={i}>{actionLabel(a.tool)}</li>
            ))}
          </ul>
        )}

        {ui.errors.length > 0 && (
          <details className="civ-errors">
            <summary>{ui.errors.length} erro(s) de validação</summary>
            <ul>
              {ui.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
