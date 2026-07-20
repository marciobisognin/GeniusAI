import { useState } from "react";
import { memoryApi, type MemorySearchResult } from "../api/memoryApi.js";
import { humanizeApiError } from "../api/client.js";

export interface MemoryPanelProps {
  open: boolean;
  onClose: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  "learning-flow": "Fluxo de aprendizado",
  "mind-clone-doc": "Documento de Mind-Clone",
  "approved-result": "Resultado aprovado",
};

/**
 * Painel "Memória" (Etapa 6): busca por significado no índice vetorial
 * local, mostrando de qual execução/aprovação cada trecho veio — a
 * procedência é a prova de que não é texto inventado.
 */
export function MemoryPanel({ open, onClose }: MemoryPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemorySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await memoryApi.search(query.trim(), 5));
      setSearched(true);
    } catch (err) {
      setError(humanizeApiError(err));
    } finally {
      setSearching(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Memória"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        background: "var(--cor-fundo)",
        borderLeft: "1px solid var(--cor-borda)",
        boxShadow: "-4px 0 12px rgba(0,0,0,0.08)",
        zIndex: 900,
        fontFamily: "var(--fonte-ui)",
        fontSize: 13,
        overflowY: "auto",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>Memória</strong>
        <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16 }}>
          ×
        </button>
      </div>

      <p style={{ color: "var(--cor-texto-suave)", marginTop: 0 }}>
        Busca por significado em execuções aprovadas, não por palavra-chave exata.
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input
          value={query}
          placeholder="O que você quer lembrar?"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSearch();
          }}
          style={{ flex: 1, border: "1px solid var(--cor-borda)", borderRadius: 4, padding: 6 }}
        />
        <button type="button" onClick={handleSearch} disabled={searching || !query.trim()} style={{ padding: "6px 10px", cursor: "pointer" }}>
          {searching ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && <div style={{ color: "var(--cor-erro)", marginBottom: 8 }}>{error}</div>}

      {searched && results.length === 0 && !error && (
        <div style={{ color: "var(--cor-texto-apagado)" }}>Nada relevante encontrado na memória ainda.</div>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {results.map((r) => (
          <li key={r.id} style={{ border: "1px solid var(--cor-borda)", borderRadius: 6, padding: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "#fff",
                  background: "var(--cor-squad)",
                }}
              >
                {SOURCE_LABEL[r.sourceType] ?? r.sourceType}
              </span>
              <span style={{ color: "var(--cor-texto-suave)", fontSize: 11 }}>score {r.score.toFixed(2)}</span>
            </div>
            <div>{r.text}</div>
            <div style={{ color: "var(--cor-texto-apagado)", fontSize: 11, marginTop: 4 }}>
              {r.procedencia ? (
                <>
                  da tarefa "{r.procedencia.taskDescricao}"
                  {r.procedencia.agenteNome ? ` (${r.procedencia.agenteNome})` : ""} · aprovado em{" "}
                  {new Date(r.procedencia.aprovadoEm).toLocaleString()}
                </>
              ) : (
                <>origem: {r.sourceId} · {new Date(r.createdAt).toLocaleString()}</>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
