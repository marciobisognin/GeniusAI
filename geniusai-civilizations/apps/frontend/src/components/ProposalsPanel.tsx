import { CIV_COLOR, CIV_LABEL, type CivId, type Resources, type World } from "../types";

interface Props {
  world: World | null;
  onSelect: (id: CivId) => void;
}

function bundle(res?: Partial<Resources>): string {
  const parts = Object.entries(res ?? {})
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${v} ${k === "food" ? "alimento" : k === "gold" ? "ouro" : "ciência"}`);
  return parts.length ? parts.join(" + ") : "nada";
}

/**
 * Propostas bilaterais pendentes — estado real do motor
 * (world.pendingProposals). Comércio e aliança só se concretizam quando o
 * destinatário aceita; propostas não respondidas expiram.
 */
export function ProposalsPanel({ world, onSelect }: Props) {
  const proposals = world?.pendingProposals ?? [];

  return (
    <section className="living-card proposals-card">
      <div className="living-card-head">
        <div>
          <p className="eyebrow">Negociações em aberto</p>
          <h2>Propostas pendentes</h2>
        </div>
        <span className="soft-chip">{proposals.length}</span>
      </div>

      {proposals.length === 0 ? (
        <p className="muted">
          Nenhuma proposta aguardando resposta. Comércio e aliança são bilaterais: uma civilização propõe, a outra
          aceita ou recusa — e propostas ignoradas expiram.
        </p>
      ) : (
        <ul className="proposal-list">
          {proposals.map((p) => (
            <li key={p.id} className="proposal-item">
              <button
                className="proposal-civ"
                style={{ "--civ": CIV_COLOR[p.from] } as React.CSSProperties}
                onClick={() => onSelect(p.from)}
              >
                {CIV_LABEL[p.from]}
              </button>
              <span className="proposal-arrow">→</span>
              <button
                className="proposal-civ"
                style={{ "--civ": CIV_COLOR[p.to] } as React.CSSProperties}
                onClick={() => onSelect(p.to)}
              >
                {CIV_LABEL[p.to]}
              </button>
              <span className="proposal-body">
                {p.kind === "alliance" ? (
                  <b>aliança</b>
                ) : (
                  <>
                    oferece <b>{bundle(p.offer)}</b> por <b>{bundle(p.request)}</b>
                  </>
                )}
              </span>
              <span className="proposal-expiry">expira no tick {p.expiresTick}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
