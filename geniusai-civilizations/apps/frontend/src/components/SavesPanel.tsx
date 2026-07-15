import { useEffect, useState } from "react";
import { BACKEND_HTTP } from "../useGameSocket";
import type { SaveInfo } from "../types";

interface Props {
  saves: SaveInfo[];
  currentGameId?: string;
  lastError?: string;
  onListSaves: () => void;
  onNewGame: () => void;
  onLoadGame: (gameId: string) => void;
  onReplay: (gameId: string) => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function SavesPanel({ saves, currentGameId, lastError, onListSaves, onNewGame, onLoadGame, onReplay }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) onListSaves();
  }, [open, onListSaves]);

  return (
    <section className="card saves-card">
      <div className="saves-header">
        <h2>Partidas salvas</h2>
        <div className="saves-actions">
          <button className="btn" onClick={() => setOpen((o) => !o)}>
            {open ? "ocultar" : "ver partidas"}
          </button>
          <button className="btn" onClick={onNewGame}>
            ✨ Nova partida
          </button>
        </div>
      </div>

      {lastError && <p className="bad saves-error">{lastError}</p>}

      {open && (
        <ul className="saves-list">
          {saves.length === 0 ? (
            <li className="muted">nenhuma partida salva ainda.</li>
          ) : (
            saves.map((s) => (
              <li key={s.gameId} className={s.gameId === currentGameId ? "current" : undefined}>
                <span className="save-id">{s.gameId}</span>
                <span className="muted">tick {s.tick} · seed {s.seed} · {formatTime(s.updatedAt)}</span>
                <span className="save-row-actions">
                  {s.gameId === currentGameId ? (
                    <span className="ok">em andamento</span>
                  ) : (
                    <button className="btn btn-small" onClick={() => onLoadGame(s.gameId)}>
                      carregar
                    </button>
                  )}
                  <button className="btn btn-small" onClick={() => onReplay(s.gameId)} title="Rever a partida tick a tick">
                    ▶ replay
                  </button>
                  <a
                    className="btn btn-small"
                    href={`${BACKEND_HTTP}/export/${encodeURIComponent(s.gameId)}`}
                    download={`${s.gameId}.jsonl`}
                    title="Baixar o trace bruto (.jsonl) da partida"
                  >
                    ⇩ exportar
                  </a>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
