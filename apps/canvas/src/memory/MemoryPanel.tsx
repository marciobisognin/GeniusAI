import { useState } from "react";
import { memoryApi, type MemorySearchResult } from "../api/memoryApi.js";

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
      setError(String(err));
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
        background: "#fff",
        borderLeft: "1px solid #e5e7eb",
        boxShadow: "-4px 0 12px rgba(0,0,0,0.08)",
        zIndex: 900,
        fontFamily: "system-ui, sans-serif",
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

      <p style={{ color: "#6b7280", marginTop: 0 }}>
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
          style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 4, padding: 6 }}
        />
        <button type="button" onClick={handleSearch} disabled={searching || !query.trim()} style={{ padding: "6px 10px", cursor: "pointer" }}>
          {searching ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && <div style={{ color: "#dc2626", marginBottom: 8 }}>{error}</div>}

      {searched && results.length === 0 && !error && (
        <div style={{ color: "#9ca3af" }}>Nada relevante encontrado na memória ainda.</div>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {results.map((r) => (
          <li key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "#fff",
                  background: "#7c3aed",
                }}
              >
                {SOURCE_LABEL[r.sourceType] ?? r.sourceType}
              </span>
              <span style={{ color: "#6b7280", fontSize: 11 }}>score {r.score.toFixed(2)}</span>
            </div>
            <div>{r.text}</div>
            <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>
              origem: {r.sourceId} · {new Date(r.createdAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
