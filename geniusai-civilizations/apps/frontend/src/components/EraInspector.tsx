import { useState } from "react";
import { eventHasCiv } from "../simulationInsights";
import {
  ADVISOR_CONFIDENCE_LABEL,
  ADVISOR_LABEL,
  CIV_COLOR,
  CIV_LABEL,
  describeEvent,
  eventCoords,
  type CivId,
  type GameEvent,
  type World,
} from "../types";
import type { AskState, CivUiState } from "../useGameSocket";
import { AskCivilizationPanel } from "./AskCivilizationPanel";
import { DiplomacyGraph } from "./DiplomacyGraph";
import { TechTreePanel } from "./TechTreePanel";

interface Props {
  world: World | null;
  selected: CivId;
  ui: CivUiState;
  events: GameEvent[];
  onSelect: (id: CivId) => void;
  onLocate?: (x: number, y: number) => void;
  answer?: AskState;
  onAsk: (civ: CivId, question: string) => void;
}

const CIV_EPITHET: Record<CivId, string> = {
  rome: "Legiões e estradas",
  egypt: "Nilo, comércio e muralhas",
  greece: "Ciência, portos e cultura",
  mali: "Ouro, diplomacia e caravanas",
};

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(2, Math.min(100, Math.round((value / total) * 100)));
}

function actionName(tool: string): string {
  const labels: Record<string, string> = {
    build: "Construção",
    research: "Pesquisa",
    move_army: "Movimento",
    attack: "Ataque",
    retreat_army: "Recuo",
    recruit: "Recrutamento",
    set_diplomacy: "Diplomacia",
    propose_trade: "Propor comércio",
    propose_alliance: "Propor aliança",
    respond_proposal: "Responder proposta",
    set_strategy: "Estratégia",
  };
  return labels[tool] ?? tool;
}

/**
 * Abas do painel de civilização (Fase 17, §17 do PRD — RF-12). Cada aba
 * reaproveita dados já existentes no `world`/`state` — nenhuma fonte de
 * dados nova, só reorganização de apresentação (Tecnologia/Diplomacia/
 * Conversa embutem componentes já usados em outras vistas).
 */
const TABS = ["overview", "economy", "tech", "diplomacy", "military", "memory", "ask"] as const;
type TabKey = (typeof TABS)[number];

const TAB_LABEL: Record<TabKey, string> = {
  overview: "Visão geral",
  economy: "Economia",
  tech: "Tecnologia",
  diplomacy: "Diplomacia",
  military: "Militar",
  memory: "Memória",
  ask: "Conversa",
};

const emptyTabByCiv = (): Record<CivId, TabKey> => ({ rome: "overview", egypt: "overview", greece: "overview", mali: "overview" });

export function EraInspector({ world, selected, ui, events, onSelect, onLocate, answer, onAsk }: Props) {
  // A aba ativa é lembrada POR civilização enquanto a partida está aberta
  // (RF-12) — trocar de civilização não reseta a aba escolhida.
  const [activeTabByCiv, setActiveTabByCiv] = useState<Record<CivId, TabKey>>(emptyTabByCiv);
  const activeTab = activeTabByCiv[selected];
  const setActiveTab = (tab: TabKey) => setActiveTabByCiv((prev) => ({ ...prev, [selected]: tab }));

  const civ = world?.civilizations[selected];
  const total = Math.max(1, (civ?.resources.food ?? 0) + (civ?.resources.gold ?? 0) + (civ?.resources.science ?? 0));
  const recent = events.filter((e) => eventHasCiv(e, selected)).slice(0, 5);

  return (
    <aside className="era-inspector" style={{ "--civ": CIV_COLOR[selected] } as React.CSSProperties}>
      <div className={`scene-image scene-${selected}`}>
        <div className="scene-glow" />
        <span>{CIV_LABEL[selected]}</span>
      </div>

      <section className="inspector-card identity-card">
        <div>
          <p className="eyebrow">Civilização selecionada</p>
          <h2>{CIV_LABEL[selected]}</h2>
          <p>{CIV_EPITHET[selected]}</p>
        </div>
        <span className={`thinking-orb ${ui.status}`}>{ui.status === "thinking" ? "IA" : "✓"}</span>
      </section>

      <nav className="inspector-tabs" role="tablist" aria-label="Painel da civilização">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <section className="inspector-card resource-card">
            <h3>Forças de evolução</h3>
            <div className="resource-row">
              <span>Alimento</span>
              <div className="resource-track"><i style={{ width: `${pct(civ?.resources.food ?? 0, total)}%` }} /></div>
              <b>{civ?.resources.food ?? 0}</b>
            </div>
            <div className="resource-row">
              <span>Ouro</span>
              <div className="resource-track gold"><i style={{ width: `${pct(civ?.resources.gold ?? 0, total)}%` }} /></div>
              <b>{civ?.resources.gold ?? 0}</b>
            </div>
            <div className="resource-row">
              <span>Ciência</span>
              <div className="resource-track science"><i style={{ width: `${pct(civ?.resources.science ?? 0, total)}%` }} /></div>
              <b>{civ?.resources.science ?? 0}</b>
            </div>
          </section>

          <section className="inspector-card decision-card">
            <h3>Decisão da IA</h3>
            <div aria-live="polite">
              {ui.status === "thinking" ? (
                <p className="live-text">O agente está deliberando… {ui.chunksReceived} fragmento(s)</p>
              ) : ui.reasoning ? (
                <p className="quote">“{ui.reasoning}”</p>
              ) : (
                <p className="muted">Nenhuma decisão registrada ainda.</p>
              )}
            </div>
            <div className="action-pills">
              {ui.actions.length === 0 ? <span className="empty-pill">sem ações</span> : ui.actions.map((a, i) => <span key={i}>{actionName(a.tool)}</span>)}
            </div>
          </section>

          {ui.advisorRecommendations.length > 0 && (
            <section className="inspector-card advisors-card">
              <h3>Conselho da corte</h3>
              <ul className="advisor-list">
                {ui.advisorRecommendations.map((r, i) => (
                  <li key={i}>
                    <span className={`advisor-confidence advisor-confidence-${r.confidence}`} title={ADVISOR_CONFIDENCE_LABEL[r.confidence]} />
                    <div>
                      <b>{ADVISOR_LABEL[r.role]}</b>
                      <p>{r.recommendation}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="inspector-card mini-events-card">
            <h3>Eventos conectados</h3>
            <ul className="mini-events">
              {recent.length === 0 ? (
                <li className="muted">Sem eventos recentes desta civilização.</li>
              ) : (
                recent.map((e, i) => {
                  const coords = eventCoords(e);
                  return (
                    <li key={i}>
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
          </section>
        </>
      )}

      {activeTab === "economy" && (
        <>
          <section className="inspector-card resource-card">
            <h3>Tesouraria</h3>
            <div className="resource-row">
              <span>Alimento</span>
              <div className="resource-track"><i style={{ width: `${pct(civ?.resources.food ?? 0, total)}%` }} /></div>
              <b>{civ?.resources.food ?? 0}</b>
            </div>
            <div className="resource-row">
              <span>Ouro</span>
              <div className="resource-track gold"><i style={{ width: `${pct(civ?.resources.gold ?? 0, total)}%` }} /></div>
              <b>{civ?.resources.gold ?? 0}</b>
            </div>
            <div className="resource-row">
              <span>Ciência</span>
              <div className="resource-track science"><i style={{ width: `${pct(civ?.resources.science ?? 0, total)}%` }} /></div>
              <b>{civ?.resources.science ?? 0}</b>
            </div>
          </section>
          <section className="inspector-card cities-card">
            <h3>Cidades</h3>
            <ul className="mini-events">
              {(civ?.cities.length ?? 0) === 0 ? (
                <li className="muted">Nenhuma cidade ainda.</li>
              ) : (
                civ!.cities.map((c) => (
                  <li key={c.id}>
                    <span>
                      {c.id} · população {c.population}
                      {c.buildings.length > 0 ? ` · ${c.buildings.join(", ")}` : ""}
                    </span>
                    {onLocate && (
                      <button className="locate-link" onClick={() => onLocate(c.x, c.y)}>
                        localizar no mapa
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}

      {activeTab === "tech" && <TechTreePanel world={world} selected={selected} />}

      {activeTab === "diplomacy" && <DiplomacyGraph world={world} selected={selected} onSelect={onSelect} />}

      {activeTab === "military" && (
        <section className="inspector-card cities-card">
          <h3>Exércitos</h3>
          <ul className="mini-events">
            {(civ?.armies.length ?? 0) === 0 ? (
              <li className="muted">Nenhum exército no campo.</li>
            ) : (
              civ!.armies.map((a) => (
                <li key={a.id}>
                  <span>{a.id} · força {a.strength} · ({a.x},{a.y})</span>
                  {onLocate && (
                    <button className="locate-link" onClick={() => onLocate(a.x, a.y)}>
                      localizar no mapa
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>
      )}

      {activeTab === "memory" && (
        <section className="inspector-card memory-card">
          <h3>Memória estratégica</h3>
          {civ?.memory ? (
            <pre className="memory-text">{civ.memory}</pre>
          ) : (
            <p className="muted">Sem memória registrada ainda.</p>
          )}
        </section>
      )}

      {activeTab === "ask" && (
        <AskCivilizationPanel world={world} selected={selected} events={events} answer={answer} onAsk={onAsk} />
      )}
    </aside>
  );
}
