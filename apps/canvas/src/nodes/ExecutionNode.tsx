import type { NodeProps } from "@xyflow/react";
import type { ExecutionNodeStatus } from "@genius/canon";
import { NodeShell } from "./NodeShell.js";
import type { CanvasFlowNode } from "./types.js";

const STATUS_COLOR: Record<ExecutionNodeStatus, string> = {
  aguardando: "#6b7280",
  executando: "#2563eb",
  concluido: "#16a34a",
  erro: "#dc2626",
};

const STATUS_LABEL: Record<ExecutionNodeStatus, string> = {
  aguardando: "Aguardando",
  executando: "Executando",
  concluido: "Concluído",
  erro: "Erro",
};

const NEXT_STATUS: Record<ExecutionNodeStatus, ExecutionNodeStatus> = {
  aguardando: "executando",
  executando: "concluido",
  concluido: "aguardando",
  erro: "aguardando",
};

/**
 * O motor de execução real chega na Etapa 5 — por ora este nó só prova a
 * estrutura (status + log persistidos) com um botão manual, sem fingir que
 * já existe orquestração de verdade.
 */
export function ExecutionNode({ data }: NodeProps<CanvasFlowNode>) {
  const { canvasNode, onUpdate, onDelete } = data;
  const status = canvasNode.status ?? "aguardando";

  function avancar() {
    const next = NEXT_STATUS[status];
    const line = `[${new Date().toLocaleTimeString()}] ${STATUS_LABEL[status]} → ${STATUS_LABEL[next]}`;
    onUpdate({ status: next, log: [...canvasNode.log, line] });
  }

  return (
    <NodeShell
      accentColor={STATUS_COLOR[status]}
      kindLabel={`Execução — ${STATUS_LABEL[status]}`}
      title={canvasNode.title}
      onDelete={onDelete}
    >
      <input
        value={canvasNode.title}
        placeholder="O que esta execução representa"
        onChange={(e) => onUpdate({ title: e.target.value })}
        style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: 4, marginBottom: 4 }}
      />
      <div
        style={{
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 4,
          padding: 4,
          maxHeight: 80,
          overflowY: "auto",
          fontFamily: "monospace",
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        {canvasNode.log.length === 0 ? (
          <span style={{ color: "#9ca3af" }}>sem eventos ainda</span>
        ) : (
          canvasNode.log.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
      <button
        type="button"
        onClick={avancar}
        style={{
          width: "100%",
          border: "1px solid #e5e7eb",
          borderRadius: 4,
          padding: 4,
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Simular próximo passo
      </button>
    </NodeShell>
  );
}
