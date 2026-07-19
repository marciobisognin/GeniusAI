import { useState } from "react";
import type { MatchResponse, RoleSpec } from "../api/constructorApi.js";

export interface MatchFormProps<T extends { id: string; nome: string }> {
  label: string;
  placeholderTitulo: string;
  matchFn: (spec: RoleSpec) => Promise<MatchResponse<T>>;
  createFn: (draft: T) => Promise<T>;
  onLinked: (id: string) => void;
}

/**
 * Formulário guiado de "reaproveitar ou criar" (Etapa 4) — o mesmo padrão
 * para Agente e Squad: descreve o papel, o sistema busca um candidato
 * compatível na Biblioteca antes de deixar criar um novo do zero.
 */
export function MatchForm<T extends { id: string; nome: string }>({
  label,
  placeholderTitulo,
  matchFn,
  createFn,
  onLinked,
}: MatchFormProps<T>) {
  const [titulo, setTitulo] = useState("");
  const [area, setArea] = useState("");
  const [responsabilidades, setResponsabilidades] = useState("");
  const [result, setResult] = useState<MatchResponse<T> | null>(null);
  const [busy, setBusy] = useState(false);

  async function buscar() {
    setBusy(true);
    try {
      const spec: RoleSpec = {
        titulo,
        area: area || undefined,
        responsabilidades: responsabilidades
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      setResult(await matchFn(spec));
    } finally {
      setBusy(false);
    }
  }

  async function confirmarCriacao() {
    if (!result) return;
    setBusy(true);
    try {
      const created = await createFn(result.draft);
      onLinked(created.id);
      reset();
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setTitulo("");
    setArea("");
    setResponsabilidades("");
    setResult(null);
  }

  return (
    <div style={{ border: "1px dashed #d1d5db", borderRadius: 6, padding: 8, marginTop: 8 }}>
      <strong style={{ fontSize: 12 }}>{label}</strong>
      <input
        placeholder={placeholderTitulo}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        style={{ width: "100%", padding: 4, margin: "4px 0", border: "1px solid #e5e7eb", borderRadius: 4 }}
      />
      <input
        placeholder="Área (opcional)"
        value={area}
        onChange={(e) => setArea(e.target.value)}
        style={{ width: "100%", padding: 4, margin: "4px 0", border: "1px solid #e5e7eb", borderRadius: 4 }}
      />
      <input
        placeholder="Responsabilidades, separadas por vírgula"
        value={responsabilidades}
        onChange={(e) => setResponsabilidades(e.target.value)}
        style={{ width: "100%", padding: 4, margin: "4px 0", border: "1px solid #e5e7eb", borderRadius: 4 }}
      />
      <button type="button" onClick={buscar} disabled={busy || !titulo.trim()} style={{ padding: "4px 8px", cursor: "pointer" }}>
        Buscar compatível
      </button>

      {result && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          {result.candidate ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: 6 }}>
              <div>
                Encontrado: <strong>{result.candidate.nome}</strong> ({Math.round(result.score * 100)}% de aderência)
              </div>
              <button
                type="button"
                onClick={() => {
                  onLinked(result.candidate!.id);
                  reset();
                }}
                style={{ marginTop: 4, padding: "2px 8px", cursor: "pointer" }}
              >
                Reaproveitar este
              </button>{" "}
              <button type="button" onClick={confirmarCriacao} style={{ marginTop: 4, padding: "2px 8px", cursor: "pointer" }}>
                Criar novo mesmo assim
              </button>
            </div>
          ) : (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 4, padding: 6 }}>
              <div>Nada compatível encontrado. Será criado: "{result.draft.nome}"</div>
              <button type="button" onClick={confirmarCriacao} disabled={busy} style={{ marginTop: 4, padding: "2px 8px", cursor: "pointer" }}>
                Criar "{result.draft.nome}"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
