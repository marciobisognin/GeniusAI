import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";

export interface NodeShellProps {
  accentColor: string;
  kindLabel: string;
  /** Glyph tipográfico que identifica o tipo do nó mesmo de longe/no minimapa, sem depender só da cor. */
  icon: string;
  title: string;
  onDelete: () => void;
  children?: ReactNode;
}

/**
 * Casca visual comum aos quatro tipos de nó — grid de 8pt, borda discreta,
 * cor nunca é o único canal de estado (o rótulo do tipo e o ícone sempre acompanham a cor).
 */
export function NodeShell({ accentColor, kindLabel, icon, title, onDelete, children }: NodeShellProps) {
  return (
    <div
      style={{
        minWidth: 200,
        maxWidth: 280,
        borderRadius: 8,
        border: `1px solid ${accentColor}`,
        borderLeft: `4px solid ${accentColor}`,
        background: "var(--cor-fundo)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        fontFamily: "var(--fonte-ui)",
        fontSize: 13,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 8px",
          borderBottom: "1px solid var(--cor-borda)",
        }}
      >
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4 }}>
          <span aria-hidden style={{ color: accentColor }}>{icon}</span>
          {title || kindLabel}
        </span>
        <button
          type="button"
          aria-label={`Remover nó ${title || kindLabel}`}
          onClick={onDelete}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--cor-texto-apagado)",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: 8 }}>
        <span
          style={{
            display: "inline-block",
            marginBottom: 6,
            padding: "1px 6px",
            borderRadius: 4,
            background: accentColor,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {kindLabel}
        </span>
        {children}
      </div>
    </div>
  );
}
