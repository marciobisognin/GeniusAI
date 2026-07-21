import { useEffect, useState } from "react";
import type { Agent, Squad } from "@genius/canon";
import { libraryApi, type LibraryImportResult } from "../api/libraryApi.js";
import { humanizeApiError } from "../api/client.js";
import { useDialogKeyboard } from "../ui/useDialogKeyboard.js";

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
      setError(humanizeApiError(err));
    } finally {
      setImporting(false);
    }
  }

  const q = query.trim().toLowerCase();
  const filteredAgents = agents.filter(
    (a) => !q || a.nome.toLowerCase().includes(q) || a.skills.some((s) => s.toLowerCase().includes(q)),
  );
  const filteredSquads = squads.filter((s) => !q || s.nome.toLowerCase().includes(q));

  const dialogRef = useDialogKeyboard(open, onClose);

  if (!open) return null;

  function onDragStart(e: React.DragEvent, payload: LibraryDragPayload) {
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
      aria-label="Biblioteca de Agentes & Squads"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: 380,
        background: "var(--cor-fundo)",
        borderRight: "1px solid var(--cor-borda)",
        boxShadow: "4px 0 12px rgba(0,0,0,0.08)",
        zIndex: 900,
        fontFamily: "var(--fonte-ui)",
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
        <div style={{ color: "var(--cor-texto-suave)", fontSize: 11, marginBottom: 8 }}>
          {lastImport.agentesNovos.length} agente(s) novo(s), {lastImport.agentesExistentes.length} já existia(m) ·{" "}
          {lastImport.squadsNovos.length} squad(s) novo(s), {lastImport.squadsExistentes.length} já existia(m)
        </div>
      )}
      {error && <div style={{ color: "var(--cor-erro)", marginBottom: 8 }}>{error}</div>}

      <input
        placeholder="Buscar por nome ou skill..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", padding: 6, marginBottom: 12, border: "1px solid var(--cor-borda)", borderRadius: 4 }}
      />

      <strong style={{ fontSize: 12, color: "var(--cor-texto-suave)" }}>SQUADS ({filteredSquads.length})</strong>
      <ul style={{ listStyle: "none", margin: "6px 0 16px", padding: 0 }}>
        {filteredSquads.map((s) => (
          <li
            key={s.id}
            draggable
            onDragStart={(e) => onDragStart(e, { kind: "squad", id: s.id, nome: s.nome })}
            style={{
              border: "1px solid var(--cor-borda)",
              borderLeft: "4px solid var(--cor-squad)",
              borderRadius: 6,
              padding: 8,
              marginBottom: 6,
              cursor: "grab",
              background: "var(--cor-squad-fundo)",
            }}
          >
            <div style={{ fontWeight: 600 }}>{s.nome}</div>
            <div style={{ color: "var(--cor-texto-suave)", fontSize: 11 }}>{s.area ?? "sem área"} · origem: {s.origem}</div>
          </li>
        ))}
        {filteredSquads.length === 0 && <li style={{ color: "var(--cor-texto-apagado)" }}>Nenhum squad — clique em "Importar" acima.</li>}
      </ul>

      <strong style={{ fontSize: 12, color: "var(--cor-texto-suave)" }}>AGENTES ({filteredAgents.length})</strong>
      <ul style={{ listStyle: "none", margin: "6px 0", padding: 0 }}>
        {filteredAgents.map((a) => (
          <li
            key={a.id}
            draggable
            onDragStart={(e) => onDragStart(e, { kind: "agent", id: a.id, nome: a.nome })}
            style={{
              border: "1px solid var(--cor-borda)",
              borderLeft: "4px solid var(--cor-agente)",
              borderRadius: 6,
              padding: 8,
              marginBottom: 6,
              cursor: "grab",
              background: "var(--cor-selecao-fundo)",
            }}
          >
            <div style={{ fontWeight: 600 }}>{a.nome}</div>
            <div style={{ color: "var(--cor-texto-suave)", fontSize: 11 }}>
              {a.area ?? "sem área"} · {a.autonomia} · {a.origem}
            </div>
            {a.skills.length > 0 && (
              <div style={{ color: "var(--cor-texto-apagado)", fontSize: 11, marginTop: 2 }}>{a.skills.slice(0, 3).join(", ")}</div>
            )}
          </li>
        ))}
        {filteredAgents.length === 0 && <li style={{ color: "var(--cor-texto-apagado)" }}>Nenhum agente — clique em "Importar" acima.</li>}
      </ul>
    </div>
  );
}
