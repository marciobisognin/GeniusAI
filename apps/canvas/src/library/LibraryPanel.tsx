import { useEffect, useState } from "react";
import type { Agent, Squad } from "@genius/canon";
import { libraryApi, type LibraryImportResult } from "../api/libraryApi.js";

export const LIBRARY_DRAG_MIME = "application/allspark-library-item";

export interface LibraryDragPayload {
  kind: "agent" | "squad";
  id: string;
  nome: string;
}

export interface LibraryPanelProps {
  open: boolean;
  onClose: () => void;
}

export function LibraryPanel({ open, onClose }: LibraryPanelProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<LibraryImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [a, s] = await Promise.all([libraryApi.listAgents(), libraryApi.listSquads()]);
    setAgents(a);
    setSquads(s);
  }

  useEffect(() => {
    if (open) void reload();
  }, [open]);

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const result = await libraryApi.importFromRepo();
      setLastImport(result);
      await reload();
    } catch (err) {
      setError(String(err));
    } finally {
      setImporting(false);
    }
  }

  const q = query.trim().toLowerCase();
  const filteredAgents = agents.filter(
    (a) => !q || a.nome.toLowerCase().includes(q) || a.skills.some((s) => s.toLowerCase().includes(q)),
  );
  const filteredSquads = squads.filter((s) => !q || s.nome.toLowerCase().includes(q));

  if (!open) return null;

  function onDragStart(e: React.DragEvent, payload: LibraryDragPayload) {
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      role="dialog"
      aria-label="Biblioteca de Agentes & Squads"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: 380,
        background: "#fff",
        borderRight: "1px solid #e5e7eb",
        boxShadow: "4px 0 12px rgba(0,0,0,0.08)",
        zIndex: 900,
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        overflowY: "auto",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 15 }}>Biblioteca de Agentes & Squads</strong>
        <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16 }}>
          ×
        </button>
      </div>

      <button type="button" onClick={handleImport} disabled={importing} style={{ width: "100%", padding: 6, marginBottom: 4, cursor: "pointer" }}>
        {importing ? "Importando..." : "Importar da Biblioteca (so-ia · foresight · civilizations)"}
      </button>
      {lastImport && (
        <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>
          {lastImport.agentesNovos.length} agente(s) novo(s), {lastImport.agentesExistentes.length} já existia(m) ·{" "}
          {lastImport.squadsNovos.length} squad(s) novo(s), {lastImport.squadsExistentes.length} já existia(m)
        </div>
      )}
      {error && <div style={{ color: "#dc2626", marginBottom: 8 }}>{error}</div>}

      <input
        placeholder="Buscar por nome ou skill..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", padding: 6, marginBottom: 12, border: "1px solid #e5e7eb", borderRadius: 4 }}
      />

      <strong style={{ fontSize: 12, color: "#6b7280" }}>SQUADS ({filteredSquads.length})</strong>
      <ul style={{ listStyle: "none", margin: "6px 0 16px", padding: 0 }}>
        {filteredSquads.map((s) => (
          <li
            key={s.id}
            draggable
            onDragStart={(e) => onDragStart(e, { kind: "squad", id: s.id, nome: s.nome })}
            style={{
              border: "1px solid #e5e7eb",
              borderLeft: "4px solid #7c3aed",
              borderRadius: 6,
              padding: 8,
              marginBottom: 6,
              cursor: "grab",
              background: "#faf5ff",
            }}
          >
            <div style={{ fontWeight: 600 }}>{s.nome}</div>
            <div style={{ color: "#6b7280", fontSize: 11 }}>{s.area ?? "sem área"} · origem: {s.origem}</div>
          </li>
        ))}
        {filteredSquads.length === 0 && <li style={{ color: "#9ca3af" }}>Nenhum squad — clique em "Importar" acima.</li>}
      </ul>

      <strong style={{ fontSize: 12, color: "#6b7280" }}>AGENTES ({filteredAgents.length})</strong>
      <ul style={{ listStyle: "none", margin: "6px 0", padding: 0 }}>
        {filteredAgents.map((a) => (
          <li
            key={a.id}
            draggable
            onDragStart={(e) => onDragStart(e, { kind: "agent", id: a.id, nome: a.nome })}
            style={{
              border: "1px solid #e5e7eb",
              borderLeft: "4px solid #2563eb",
              borderRadius: 6,
              padding: 8,
              marginBottom: 6,
              cursor: "grab",
              background: "#eff6ff",
            }}
          >
            <div style={{ fontWeight: 600 }}>{a.nome}</div>
            <div style={{ color: "#6b7280", fontSize: 11 }}>
              {a.area ?? "sem área"} · {a.autonomia} · {a.origem}
            </div>
            {a.skills.length > 0 && (
              <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>{a.skills.slice(0, 3).join(", ")}</div>
            )}
          </li>
        ))}
        {filteredAgents.length === 0 && <li style={{ color: "#9ca3af" }}>Nenhum agente — clique em "Importar" acima.</li>}
      </ul>
    </div>
  );
}
