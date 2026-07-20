import type { NodeProps } from "@xyflow/react";
import { ExecuteTrigger } from "./ExecuteTrigger.js";
import { NodeShell } from "./NodeShell.js";
import { ProviderSelect } from "./ProviderSelect.js";
import type { CanvasFlowNode } from "./types.js";

const SQUAD_PURPLE = "var(--cor-squad)";

export function SquadNode({ data }: NodeProps<CanvasFlowNode>) {
  const { canvasNode, onUpdate, onDelete, onExecute } = data;
  return (
    <NodeShell accentColor={SQUAD_PURPLE} kindLabel="Squad" title={canvasNode.title} onDelete={onDelete}>
      <input
        value={canvasNode.title}
        placeholder="Nome do squad"
        onChange={(e) => onUpdate({ title: e.target.value })}
        style={{ width: "100%", border: "1px solid var(--cor-borda)", borderRadius: 4, padding: 4, marginBottom: 4 }}
      />
      <ProviderSelect value={canvasNode.providerId} onChange={(providerId) => onUpdate({ providerId })} />
      {canvasNode.refId && <div style={{ color: "var(--cor-texto-suave)", fontSize: 11 }}>refId: {canvasNode.refId}</div>}
      <ExecuteTrigger onExecute={onExecute} />
    </NodeShell>
  );
}
