import type { NodeProps } from "@xyflow/react";
import { NodeShell } from "./NodeShell.js";
import { ProviderSelect } from "./ProviderSelect.js";
import type { CanvasFlowNode } from "./types.js";

const AGENT_BLUE = "#2563eb";

export function AgentNode({ data }: NodeProps<CanvasFlowNode>) {
  const { canvasNode, onUpdate, onDelete } = data;
  return (
    <NodeShell accentColor={AGENT_BLUE} kindLabel="Agente" title={canvasNode.title} onDelete={onDelete}>
      <input
        value={canvasNode.title}
        placeholder="Nome do agente"
        onChange={(e) => onUpdate({ title: e.target.value })}
        style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: 4, marginBottom: 4 }}
      />
      <ProviderSelect value={canvasNode.providerId} onChange={(providerId) => onUpdate({ providerId })} />
      {canvasNode.refId && <div style={{ color: "#6b7280", fontSize: 11 }}>refId: {canvasNode.refId}</div>}
    </NodeShell>
  );
}
