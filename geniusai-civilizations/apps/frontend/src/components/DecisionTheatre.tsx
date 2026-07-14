import { useEffect, useMemo, useState } from "react";
import { TECHS } from "@geniusai/shared";
import type { TechBranch } from "@geniusai/shared";
import { ERA_STAGES, eventHasCiv, getEraProgress } from "../simulationInsights";
import { ADVISOR_CONFIDENCE_LABEL, ADVISOR_LABEL, CIV_COLOR, CIV_IDS, CIV_LABEL, CIV_LEADER, describeEvent } from "../types";
import type { CivId, Civilization, GameEvent, World } from "../types";
import type { CivUiState } from "../useGameSocket";
import romeArt from "../assets/civs/rome.svg";
import egyptArt from "../assets/civs/egypt.svg";
import greeceArt from "../assets/civs/greece.svg";
import maliArt from "../assets/civs/mali.svg";

interface Props {
  world: World | null;
  civs: Record<CivId, CivUiState>;
  selected: CivId;
  onSelect: (id: CivId) => void;
  events: GameEvent[];
}

// `name` (líder) vem do Agente Construtor (`CIV_LEADER`, @geniusai/shared) —
// única fonte de verdade com o backend. `title`/`art` são puramente
// apresentacionais (não fazem parte de `CivilizationDefinition`).
const LEADER_PRESENTATION: Record<CivId, { title: string; art: string }> = {
  rome: { title: "A Cidade Eterna", art: romeArt },
  egypt: { title: "Dádiva do Nilo", art: egyptArt },
  greece: { title: "Berço da Filosofia", art: greeceArt },
  mali: { title: "Senhor do Ouro", art: maliArt },
};
const LEADER: Record<CivId, { name: string; title: string; art: string }> = Object.fromEntries(
  CIV_IDS.map((id) => [id, { name: CIV_LEADER[id], ...LEADER_PRESENTATION[id] }]),
) as Record<CivId, { name: string; title: string; art: string }>;

const TECH_LABEL: Record<string, string> = {
  agriculture: "Agricultura",
  writing: "Escrita",
  bronze_working: "Trabalho em Bronze",
  currency: "Moeda",
  mathematics: "Matemática",
};

const STRUCTURE_LABEL: Record<string, string> = {
  farm: "Fazenda",
  market: "Mercado",
  library: "Biblioteca",
  barracks: "Quartel",
};

const BRANCH_ICON: Record<TechBranch, string> = {
  ciência: "⚗",
  militar: "⚔",
  economia: "⚖",
  cultura: "♪",
};

/** Civilizações além da névoa — expansão futura, claramente sem telemetria. */
const FOG_CIVS = [
  { name: "Nórdicos", leader: "Ragnar" },
  { name: "Pérsia", leader: "Ciro" },
  { name: "Japão", leader: "Hōjō Tokimune" },
];

const techLabel = (id: string): string => TECH_LABEL[id] ?? id;

function statusVerb(ui: CivUiState): string {
  if (ui.status === "thinking") return "deliberando…";
  if (ui.status === "done" && ui.passed) return "passou o turno";
  if (ui.status === "done" && ui.actions[0]) return `executou · ${ui.actions[0].tool}`;
  if (ui.status === "done") return "observou o mundo";
  return "aguardando ordens";
}

interface FocusStep {
  label: string;
  state: "done" | "active" | "pending";
}

interface Focus {
  title: string;
  branch: TechBranch;
  quote: string;
  steps: FocusStep[];
  rewards: string[];
}

/** Foco atual da civilização, derivado APENAS do estado real do motor. */
function deriveFocus(civ: Civilization | undefined): Focus {
  if (!civ) {
    return { title: "Fundação", branch: "cultura", quote: "O mundo ainda não foi revelado.", steps: [], rewards: [] };
  }

  if (civ.researching && TECHS[civ.researching]) {
    const spec = TECHS[civ.researching];
    const sci = civ.resources.science;
    const rewards: string[] = [];
    if (spec.effects.cityYield?.food) rewards.push(`+${spec.effects.cityYield.food} 🌾/cidade`);
    if (spec.effects.cityYield?.gold) rewards.push(`+${spec.effects.cityYield.gold} 🪙/cidade`);
    if (spec.effects.cityYield?.science) rewards.push(`+${spec.effects.cityYield.science} ⚗/cidade`);
    if (spec.effects.armyStrengthBonus) rewards.push(`+${spec.effects.armyStrengthBonus} ⚔ ao recrutar`);
    if (spec.effects.unlocksRecruit) rewards.push("habilita recrutar");
    return {
      title: techLabel(civ.researching),
      branch: spec.branch,
      quote: spec.description,
      steps: [
        { label: "Traçar o plano de pesquisa", state: "done" },
        {
          label: `Acumular ciência (${Math.min(sci, spec.cost)}/${spec.cost})`,
          state: sci >= spec.cost ? "done" : "active",
        },
        { label: `Dominar ${techLabel(civ.researching)}`, state: "pending" },
      ],
      rewards,
    };
  }

  const available = Object.entries(TECHS).filter(
    ([id, spec]) => !civ.tech.includes(id) && spec.requires.every((r) => civ.tech.includes(r)),
  );
  if (available.length > 0) {
    return {
      title: "O conselho delibera",
      branch: available[0][1].branch,
      quote: "Se não monumentos, então conhecimento.",
      steps: available.slice(0, 3).map(([id]) => ({ label: `Pesquisar ${techLabel(id)}`, state: "pending" as const })),
      rewards: [],
    };
  }

  return {
    title: "Legado consolidado",
    branch: "cultura",
    quote: "Todo o catálogo foi dominado; a crônica pertence aos escribas.",
    steps: [{ label: "Catálogo tecnológico completo", state: "done" }],
    rewards: [],
  };
}

type BannerKind = "presságio" | "fortuna" | "marco";

/** Evento-mundo mais recente digno de banner (fatos reais da timeline). */
function deriveBanner(events: GameEvent[]): { kind: BannerKind; text: string } | null {
  for (const e of events.slice(0, 8)) {
    if (["battle", "city_captured", "civ_eliminated"].includes(e.type)) {
      return { kind: "presságio", text: describeEvent(e) };
    }
    if (e.type === "diplomacy_changed" && (e as { stance?: string }).stance === "war") {
      return { kind: "presságio", text: describeEvent(e) };
    }
    if (["trade_executed", "proposal_accepted", "alliance_proposed", "trade_proposed"].includes(e.type)) {
      return { kind: "fortuna", text: describeEvent(e) };
    }
    if (["tech_researched", "victory", "army_recruited", "structure_built"].includes(e.type)) {
      return { kind: "marco", text: describeEvent(e) };
    }
  }
  return null;
}

const DONE_POS = [
  { x: 12, y: 24 },
  { x: 9, y: 44 },
  { x: 12, y: 64 },
  { x: 16, y: 82 },
];
const NEXT_POS = [
  { x: 86, y: 26 },
  { x: 89, y: 50 },
  { x: 85, y: 74 },
];

export function DecisionTheatre({ world, civs, selected, onSelect, events }: Props) {
  const [auto, setAuto] = useState(true);

  // Rotação automática do holofote, como no teatro: cada civ tem seu momento.
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => {
      const idx = CIV_IDS.indexOf(selected);
      onSelect(CIV_IDS[(idx + 1) % CIV_IDS.length]);
    }, 8000);
    return () => clearInterval(timer);
  }, [auto, selected, onSelect]);

  const civ = world?.civilizations[selected];
  const ui = civs[selected];
  const era = getEraProgress(world?.tick ?? 0);
  const focus = useMemo(() => deriveFocus(civ), [civ]);
  const banner = useMemo(() => deriveBanner(events), [events]);

  const doneNodes = useMemo(() => {
    if (!civ) return [] as { label: string; icon: string }[];
    const techs = civ.tech.map((t) => ({ label: techLabel(t), icon: BRANCH_ICON[TECHS[t]?.branch ?? "ciência"] }));
    const buildings = civ.cities
      .flatMap((c) => c.buildings)
      .map((b) => ({ label: STRUCTURE_LABEL[b] ?? b, icon: "⛏" }));
    return [...techs, ...buildings].slice(-DONE_POS.length);
  }, [civ]);

  const nextNodes = useMemo(() => {
    if (!civ) return [] as { label: string; branch: TechBranch; ready: boolean }[];
    return Object.entries(TECHS)
      .filter(([id]) => !civ.tech.includes(id) && id !== civ.researching)
      .map(([id, spec]) => ({
        label: techLabel(id),
        branch: spec.branch,
        ready: spec.requires.every((r) => civ.tech.includes(r)),
      }))
      .sort((a, b) => Number(b.ready) - Number(a.ready))
      .slice(0, NEXT_POS.length);
  }, [civ]);

  const annals = useMemo(
    () => events.filter((e) => eventHasCiv(e, selected) && e.type !== "tick_started").slice(0, 4),
    [events, selected],
  );
  const decisions = useMemo(
    () => events.filter((e) => eventHasCiv(e, selected) && e.type !== "tick_started").length,
    [events, selected],
  );
  const works = civ?.cities.reduce((s, c) => s + c.buildings.length, 0) ?? 0;
  const eraIndex = ERA_STAGES.findIndex((s) => s.key === era.current.key) + 1;
  const maxRes = Math.max(
    1,
    ...CIV_IDS.flatMap((id) => {
      const r = world?.civilizations[id]?.resources;
      return r ? [r.food, r.gold, r.science] : [0];
    }),
  );

  return (
    <div className="theatre" style={{ "--civ": CIV_COLOR[selected] } as React.CSSProperties}>
      <header className="theatre-topbar">
        <div className="theatre-brand">
          <span className="theatre-seal">◈</span>
          <div>
            <strong>Teatro de Decisões</strong>
            <small>agentes de civilização · estado real do motor</small>
          </div>
        </div>
        <div className="theatre-meta">
          <span className="theatre-chip">Era · <b>{era.current.label}</b></span>
          <span className="theatre-chip viewing">observando · <b>{CIV_LABEL[selected]}</b></span>
          <button className={`theatre-chip toggle ${auto ? "on" : ""}`} onClick={() => setAuto((a) => !a)}>
            {auto ? "◉ giro automático" : "○ holofote fixo"}
          </button>
        </div>
      </header>

      <div className="theatre-layout">
        <aside className="theatre-rail">
          <p className="eyebrow">Civilizações</p>
          <div className="theatre-civ-list">
            {CIV_IDS.map((id) => {
              const c = world?.civilizations[id];
              const cUi = civs[id];
              return (
                <button
                  key={id}
                  className={`theatre-civ ${selected === id ? "spotlit" : ""} ${cUi.status === "thinking" ? "thinking" : ""}`}
                  style={{ "--civ": CIV_COLOR[id] } as React.CSSProperties}
                  onClick={() => {
                    setAuto(false);
                    onSelect(id);
                  }}
                >
                  <img src={LEADER[id].art} alt="" className="theatre-civ-art" />
                  <span className="theatre-civ-body">
                    <strong>{CIV_LABEL[id]}</strong>
                    <small>{LEADER[id].name}</small>
                    <em className={cUi.status}>{c?.alive === false ? "legado histórico" : statusVerb(cUi)}</em>
                  </span>
                  <span className="theatre-civ-turn">
                    <b>{world?.tick ?? 0}</b>
                    <small>turno</small>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="eyebrow fog-title">Além da névoa</p>
          <div className="theatre-fog-list">
            {FOG_CIVS.map((f) => (
              <div key={f.name} className="theatre-fog">
                <span className="fog-lock">🔒</span>
                <span>
                  <strong>{f.name}</strong>
                  <small>{f.leader} · névoa de guerra — sem telemetria</small>
                </span>
              </div>
            ))}
          </div>
        </aside>

        <section className="theatre-stage" aria-label="O mundo conhecido — árvore de decisões ao vivo">
          {banner && (
            <div key={banner.text} className={`theatre-banner ${banner.kind}`}>
              <em>evento-mundo · {banner.kind}</em>
              <strong>{banner.text}</strong>
            </div>
          )}

          <svg className="theatre-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {doneNodes.map((_, i) => (
              <path key={`d${i}`} className="done-link" d={`M ${DONE_POS[i].x + 6} ${DONE_POS[i].y} C 30 ${DONE_POS[i].y}, 34 48, 44 48`} />
            ))}
            {nextNodes.map((_, i) => (
              <path key={`n${i}`} className="next-link" d={`M 56 48 C 68 48, 72 ${NEXT_POS[i].y}, ${NEXT_POS[i].x - 5} ${NEXT_POS[i].y}`} />
            ))}
          </svg>

          {doneNodes.map((n, i) => (
            <div key={n.label + i} className="theatre-done" style={{ left: `${DONE_POS[i].x}%`, top: `${DONE_POS[i].y}%` }}>
              <i>✓</i> {n.label}
            </div>
          ))}

          <article className={`theatre-focus branch-${focus.branch} ${ui.status === "thinking" ? "thinking" : ""}`}>
            <header>
              <span className="focus-icon">{BRANCH_ICON[focus.branch]}</span>
              <div>
                <h3>{focus.title}</h3>
                <small>{era.current.label} · {focus.branch}</small>
              </div>
            </header>
            <p className="focus-quote">{focus.quote}</p>
            <ul className="focus-steps">
              {focus.steps.map((s) => (
                <li key={s.label} className={s.state}>
                  <i>{s.state === "done" ? "✓" : s.state === "active" ? "◔" : "○"}</i>
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
            {focus.rewards.length > 0 && (
              <div className="focus-rewards">
                {focus.rewards.map((r) => (
                  <span key={r}>{r}</span>
                ))}
              </div>
            )}
          </article>

          {nextNodes.map((n, i) => (
            <div
              key={n.label}
              className={`theatre-next ${n.ready ? "ready" : "far"}`}
              style={{ left: `${NEXT_POS[i].x}%`, top: `${NEXT_POS[i].y}%` }}
            >
              <span className="next-icon">{BRANCH_ICON[n.branch]}</span>
              <span>
                <strong>{n.label}</strong>
                <small>{n.ready ? "ao alcance" : "requer avanços"}</small>
              </span>
            </div>
          ))}

          <footer className="theatre-stage-note">
            <strong>O mundo conhecido</strong>
            <small>árvore de decisões · ao vivo</small>
          </footer>
        </section>

        <aside className="theatre-hero">
          <figure className="hero-card">
            <img src={LEADER[selected].art} alt={`Arte de ${CIV_LABEL[selected]}`} />
            <figcaption>
              <strong>{CIV_LABEL[selected]}</strong>
              <span>{LEADER[selected].name} · {LEADER[selected].title}</span>
            </figcaption>
          </figure>

          <div className="hero-counters">
            <span><b>{decisions}</b><small>eventos</small></span>
            <span><b>{works}</b><small>obras</small></span>
            <span><b>{eraIndex}</b><small>{eraIndex === 1 ? "era" : "eras"}</small></span>
          </div>

          <section className="hero-panel">
            <h4>Tesouraria <em>turno {world?.tick ?? 0}</em></h4>
            {([
              ["Alimento", civ?.resources.food ?? 0, "#74a85b"],
              ["Ouro", civ?.resources.gold ?? 0, "#d7a33a"],
              ["Ciência", civ?.resources.science ?? 0, "#438bd0"],
            ] as const).map(([label, value, color]) => (
              <div key={label} className="hero-resource">
                <span>{label}</span>
                <div className="hero-track"><i style={{ width: `${Math.max(3, Math.min(100, (value / maxRes) * 100))}%`, background: color }} /></div>
                <b>{value}</b>
              </div>
            ))}
            <div className="hero-stats">
              <span>🏙 {civ?.cities.length ?? 0} cidades</span>
              <span>👥 {civ?.cities.reduce((s, c) => s + c.population, 0) ?? 0} pop.</span>
              <span>⚔ {civ?.armies.length ?? 0} exércitos</span>
            </div>
          </section>

          <section className="hero-panel">
            <h4>Conselho de guerra</h4>
            <div className="hero-focus-chip">foco atual · <b>{focus.title}</b></div>
            <div aria-live="polite">
              {ui.reasoning ? (
                <blockquote className="hero-quote">“{ui.reasoning}”</blockquote>
              ) : (
                <p className="muted hero-empty">{ui.status === "thinking" ? "O agente delibera…" : "Nenhuma decisão registrada ainda."}</p>
              )}
            </div>
            {ui.advisorRecommendations.length > 0 && (
              <ul className="advisor-list">
                {ui.advisorRecommendations.map((r, i) => (
                  <li key={i}>
                    <span
                      className={`advisor-confidence advisor-confidence-${r.confidence}`}
                      title={ADVISOR_CONFIDENCE_LABEL[r.confidence]}
                    />
                    <div>
                      <b>{ADVISOR_LABEL[r.role]}</b>
                      <p>{r.recommendation}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="hero-panel">
            <h4>Anais da civilização</h4>
            {annals.length === 0 ? (
              <p className="muted hero-empty">Nenhum feito registrado — a crônica aguarda.</p>
            ) : (
              <ul className="hero-annals">
                {annals.map((e, i) => (
                  <li key={i}>{describeEvent(e)}</li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
