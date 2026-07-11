import { useEffect, useState } from "react";

export interface NewGameOptions {
  name: string;
  seed?: number;
  speedMs: number;
}

interface Props {
  open: boolean;
  runner?: string;
  onClose: () => void;
  onCreate: (opts: NewGameOptions) => void;
}

const SPEED_OPTIONS = [
  { label: "0.5× (contemplativo)", ms: 4000 },
  { label: "1× (padrão)", ms: 2000 },
  { label: "2× (ágil)", ms: 1000 },
  { label: "4× (acelerado)", ms: 500 },
];

/**
 * Tela de criação de partida (RF-010): nome, seed opcional e velocidade
 * inicial. O botão fica desabilitado enquanto os dados forem inválidos;
 * o runner ativo é informado (configurado no backend via RUNNER).
 */
export function NewGameModal({ open, runner, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [seedText, setSeedText] = useState("");
  const [speedMs, setSpeedMs] = useState(2000);

  useEffect(() => {
    if (open) {
      setName("");
      setSeedText("");
      setSpeedMs(2000);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = name.trim();
  const seedValid = seedText.trim() === "" || /^\d{1,10}$/.test(seedText.trim());
  const nameValid = trimmed.length >= 1 && trimmed.length <= 40;
  const valid = nameValid && seedValid;

  const submit = () => {
    if (!valid) return;
    onCreate({
      name: trimmed,
      seed: seedText.trim() === "" ? undefined : Number(seedText.trim()),
      speedMs,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card view-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-game-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">Fundar um novo mundo</p>
        <h2 id="new-game-title">Nova partida</h2>
        <p className="modal-subtitle">
          Quatro civilizações, um mapa gerado pela seed, e agentes de IA decidindo cada turno. Você observa.
        </p>

        <label className="modal-field">
          <span>Nome da partida *</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="ex.: Ascensão do Mediterrâneo"
            maxLength={40}
          />
          {!nameValid && name !== "" && <em className="field-error">1 a 40 caracteres.</em>}
        </label>

        <div className="modal-row">
          <label className="modal-field">
            <span>Seed (opcional)</span>
            <input
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="aleatória"
              inputMode="numeric"
            />
            {!seedValid && <em className="field-error">Apenas dígitos (até 10).</em>}
          </label>

          <label className="modal-field">
            <span>Velocidade inicial</span>
            <select value={speedMs} onChange={(e) => setSpeedMs(Number(e.target.value))}>
              {SPEED_OPTIONS.map((o) => (
                <option key={o.ms} value={o.ms}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="modal-runner">
          Runner ativo: <b>{runner ?? "—"}</b> <span className="muted">(configurado no backend via RUNNER)</span>
        </p>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!valid} onClick={submit}>
            ✨ Fundar civilizações
          </button>
        </div>
      </div>
    </div>
  );
}
