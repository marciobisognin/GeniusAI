import type { NodeProps } from "@xyflow/react";
import type { ExecutionNodeStatus } from "@genius/canon";
import { executionApi } from "../api/executionApi.js";
import { NodeShell } from "./NodeShell.js";
import type { CanvasFlowNode } from "./types.js";

const STATUS_COLOR: Record<ExecutionNodeStatus, string> = {
  aguardando: "#6b7280",
  executando: "#2563eb",
  aguardando_aprovacao: "#d97706",
  concluido: "#16a34a",
  erro: "#dc2626",
};

const STATUS_LABEL: Record<ExecutionNodeStatus, string> = {
  aguardando: "Aguardando",
  executando: "Executando",
  aguardando_aprovacao: "Aguardando aprovação",
  concluido: "Concluído",
  erro: "Erro",
};

const NEXT_STATUS: Record<ExecutionNodeStatus, ExecutionNodeStatus> = {
  aguardando: "executando",
  executando: "concluido",
  aguardando_aprovacao: "concluido",
  concluido: "aguardando",
  erro: "aguardando",
};

/**
 * Nó de execução: quando `refId` está presente é o `Run.id` real (Etapa 5) —
 * o CanvasBoard já mantém `status`/`log` sincronizados ao vivo via SSE, e
 * aqui só falta o gatilho humano de aprovação. Sem `refId` é um nó solto
 * (criado pela paleta de comandos), sem execução real por trás — mantém o
 * botão manual de simulação para prototipagem livre no canvas.
 */
export function ExecutionNode({ data }: NodeProps<CanvasFlowNode>) {
  const { canvasNode, onUpdate, onDelete, onNotify } = data;
  const status = canvasNode.status ?? "aguardando";
  const isRealRun = Boolean(canvasNode.refId);
  const approvalId = canvasNode.content || undefined;

  function avancar() {
    const next = NEXT_STATUS[status];
    const line = `[${new Date().toLocaleTimeString()}] ${STATUS_LABEL[status]} → ${STATUS_LABEL[next]}`;
    onUpdate({ status: next, log: [...canvasNode.log, line] });
  }

  async function decidir(decisao: "aprovado" | "rejeitado") {
    if (!approvalId) return;
    const resolution = await executionApi.resolveApproval(approvalId, decisao);
    // O aprendizado da Etapa 6 acontecia em silêncio — este é o momento de contar ao usuário.
    if (resolution.aprendizado) {
      onNotify?.("aprendizado", `Aprendizado registrado: "${resolution.aprendizado.taskPattern}"`);
      if (resolution.aprendizado.skillPromovida) {
        onNotify?.("aprendizado", `Nova skill promovida por uso real: "${resolution.aprendizado.skillPromovida}"`);
      }
    }
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
      {isRealRun ? (
        status === "aguardando_aprovacao" && approvalId ? (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={() => decidir("aprovado")}
              style={{ flex: 1, border: "1px solid #16a34a", borderRadius: 4, padding: 4, background: "#16a34a", color: "#fff", cursor: "pointer" }}
            >
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => decidir("rejeitado")}
              style={{ flex: 1, border: "1px solid #dc2626", borderRadius: 4, padding: 4, background: "#fff", color: "#dc2626", cursor: "pointer" }}
            >
              Rejeitar
            </button>
          </div>
        ) : null
      ) : (
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
      )}
    </NodeShell>
  );
}
