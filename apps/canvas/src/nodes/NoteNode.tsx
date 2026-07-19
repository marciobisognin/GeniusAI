import type { NodeProps } from "@xyflow/react";
import { NodeShell } from "./NodeShell.js";
import type { CanvasFlowNode } from "./types.js";

const NOTE_GRAY = "#6b7280";

export function NoteNode({ data }: NodeProps<CanvasFlowNode>) {
  const { canvasNode, onUpdate, onDelete } = data;
  return (
    <NodeShell accentColor={NOTE_GRAY} kindLabel="Nota" title={canvasNode.title} onDelete={onDelete}>
      <input
        value={canvasNode.title}
        placeholder="Título"
        onChange={(e) => onUpdate({ title: e.target.value })}
        style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: 4, marginBottom: 4 }}
      />
      <textarea
        value={canvasNode.content}
        placeholder="Escreva aqui..."
        onChange={(e) => onUpdate({ content: e.target.value })}
        rows={3}
        style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: 4, resize: "vertical" }}
      />
    </NodeShell>
  );
}
