import { useEffect, useMemo, useState } from "react";
import type { CanvasNode, CanvasNodeKind } from "@genius/canon";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  existingNodes: CanvasNode[];
  onCreateNode: (kind: CanvasNodeKind) => void;
  onFocusNode: (nodeId: string) => void;
}

const CREATE_ACTIONS: Array<{ kind: CanvasNodeKind; label: string }> = [
  { kind: "agent", label: "Criar nó de Agente" },
  { kind: "squad", label: "Criar nó de Squad" },
  { kind: "note", label: "Criar Nota" },
  { kind: "execution", label: "Criar nó de Execução" },
];

/** Paleta de comandos (⌘K/Ctrl+K) — alcançar qualquer nó ou criar um novo pelo teclado. */
export function CommandPalette({ open, onClose, existingNodes, onCreateNode, onFocusNode }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const actions: PaletteAction[] = useMemo(() => {
    const create = CREATE_ACTIONS.map((a) => ({
      id: `create-${a.kind}`,
      label: a.label,
      hint: "novo",
      run: () => onCreateNode(a.kind),
    }));
    const focus = existingNodes.map((node) => ({
      id: `focus-${node.id}`,
      label: node.title || `(${node.kind} sem título)`,
      hint: node.kind,
      run: () => onFocusNode(node.id),
    }));
    const all = [...create, ...focus];
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((a) => a.label.toLowerCase().includes(q) || a.hint?.toLowerCase().includes(q));
  }, [existingNodes, query, onCreateNode, onFocusNode]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Paleta de comandos"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          background: "var(--cor-fundo)",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          overflow: "hidden",
          fontFamily: "var(--fonte-ui)",
        }}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Criar nó ou buscar por nome..."
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && actions[0]) {
              actions[0].run();
              onClose();
            }
          }}
          style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "none", borderBottom: "1px solid var(--cor-borda)", fontSize: 14 }}
        />
        <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 320, overflowY: "auto" }}>
          {actions.length === 0 && <li style={{ padding: 12, color: "var(--cor-texto-apagado)" }}>Nada encontrado.</li>}
          {actions.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => {
                  action.run();
                  onClose();
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{action.label}</span>
                {action.hint && <span style={{ color: "var(--cor-texto-apagado)", fontSize: 12 }}>{action.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
