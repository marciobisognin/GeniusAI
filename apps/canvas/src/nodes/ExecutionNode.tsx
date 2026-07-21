import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import type { ExecutionNodeStatus } from "@genius/canon";
import { executionApi } from "../api/executionApi.js";
import { decodeApprovalContent } from "./approvalContent.js";
import { NodeShell } from "./NodeShell.js";
import type { CanvasFlowNode } from "./types.js";

const STATUS_COLOR: Record<ExecutionNodeStatus, string> = {
  aguardando: "var(--cor-texto-suave)",
  executando: "var(--cor-agente)",
  aguardando_aprovacao: "var(--cor-aprovacao)",
  concluido: "var(--cor-sucesso)",
  erro: "var(--cor-erro)",
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

/** Nós que já chegaram a um veredito — a última linha do log É o resultado, não mais um passo de protocolo. */
const TERMINAL_STATUSES = new Set<ExecutionNodeStatus>(["concluido", "aguardando_aprovacao", "erro"]);

/** Tira o "[HH:MM:SS] " do início da linha — sobra só o texto que interessa no destaque do resultado. */
function stripTimestamp(line: string): string {
  return line.replace(/^\[[^\]]+\]\s*/, "");
}

/**
 * Nó de execução: quando `refId` está presente é o `Run.id` real (Etapa 5) —
 * o CanvasBoard já mantém `status`/`log` sincronizados ao vivo via SSE, e
 * aqui só falta o gatilho humano de aprovação. Sem `refId` é um nó solto
 * (criado pela paleta de comandos), sem execução real por trás — mantém o
 * botão manual de simulação para prototipagem livre no canvas.
 *
 * O resultado (a resposta real do agente) é a coisa mais valiosa desta
 * tela — por isso fica em destaque, separado dos passos de protocolo
 * ("chamando o modelo...", "Memória: N trecho(s)..."), que ficam
 * colapsados por padrão.
 */
export function ExecutionNode({ data }: NodeProps<CanvasFlowNode>) {
  const { canvasNode, onUpdate, onDelete, onNotify } = data;
  const status = canvasNode.status ?? "aguardando";
  const isRealRun = Boolean(canvasNode.refId);
  const { approvalId, autonomia: autonomiaResponsavel } = decodeApprovalContent(canvasNode.content);
  const [passosAbertos, setPassosAbertos] = useState(false);
  const [resultadoExpandido, setResultadoExpandido] = useState(false);

  const isTerminal = TERMINAL_STATUSES.has(status);
  const passos = isTerminal ? canvasNode.log.slice(0, -1) : canvasNode.log;
  const resultado = isTerminal ? canvasNode.log.at(-1) : undefined;

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
      icon="▶"
      title={canvasNode.title}
      onDelete={onDelete}
    >
      <input
        value={canvasNode.title}
        placeholder="O que esta execução representa"
        onChange={(e) => onUpdate({ title: e.target.value })}
        style={{ width: "100%", border: "1px solid var(--cor-borda)", borderRadius: 4, padding: 4, marginBottom: 4 }}
      />

      {resultado !== undefined && (
        <div
          data-testid="execution-result"
          onClick={() => setResultadoExpandido((v) => !v)}
          title="Clique para expandir/recolher"
          style={{
            background: status === "erro" ? "var(--cor-aviso-fundo)" : "var(--cor-sucesso-fundo)",
            border: `1px solid ${status === "erro" ? "var(--cor-erro)" : "var(--cor-sucesso-borda)"}`,
            borderRadius: 4,
            padding: 6,
            marginBottom: 4,
            fontSize: 12,
            lineHeight: 1.4,
            cursor: "pointer",
            maxHeight: resultadoExpandido ? "none" : 72,
            overflow: resultadoExpandido ? "visible" : "hidden",
          }}
        >
          {stripTimestamp(resultado)}
        </div>
      )}

      {passos.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <button
            type="button"
            onClick={() => setPassosAbertos((v) => !v)}
            style={{
              width: "100%",
              textAlign: "left",
              border: "none",
              background: "transparent",
              color: "var(--cor-texto-apagado)",
              fontSize: 11,
              cursor: "pointer",
              padding: "2px 0",
            }}
          >
            {passosAbertos ? "▾" : "▸"} {passos.length} passo{passos.length === 1 ? "" : "s"} de execução
          </button>
          {passosAbertos && (
            <div
              style={{
                background: "var(--cor-fundo-suave)",
                border: "1px solid var(--cor-borda)",
                borderRadius: 4,
                padding: 4,
                maxHeight: 80,
                overflowY: "auto",
                fontFamily: "var(--fonte-mono)",
                fontSize: 11,
              }}
            >
              {passos.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {resultado === undefined && passos.length === 0 && (
        <div
          style={{
            background: "var(--cor-fundo-suave)",
            border: "1px solid var(--cor-borda)",
            borderRadius: 4,
            padding: 4,
            fontSize: 11,
            color: "var(--cor-texto-apagado)",
            marginBottom: 4,
          }}
        >
          sem eventos ainda
        </div>
      )}

      {isRealRun ? (
        status === "aguardando_aprovacao" && approvalId ? (
          <div>
            {autonomiaResponsavel && (
              <p style={{ fontSize: 11, color: "var(--cor-texto-suave)", margin: "0 0 4px" }}>
                Este agente tem autonomia {autonomiaResponsavel} — atos vinculados exigem aprovação humana.
              </p>
            )}
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => decidir("aprovado")}
                style={{ flex: 1, border: "1px solid var(--cor-sucesso)", borderRadius: 4, padding: 4, background: "var(--cor-sucesso)", color: "#fff", cursor: "pointer" }}
              >
                Aprovar
              </button>
              <button
                type="button"
                onClick={() => decidir("rejeitado")}
                style={{ flex: 1, border: "1px solid var(--cor-erro)", borderRadius: 4, padding: 4, background: "var(--cor-fundo)", color: "var(--cor-erro)", cursor: "pointer" }}
              >
                Rejeitar
              </button>
            </div>
          </div>
        ) : null
      ) : (
        <button
          type="button"
          onClick={avancar}
          style={{
            width: "100%",
            border: "1px solid var(--cor-borda)",
            borderRadius: 4,
            padding: 4,
            background: "var(--cor-fundo)",
            cursor: "pointer",
          }}
        >
          Simular próximo passo
        </button>
      )}
    </NodeShell>
  );
}
