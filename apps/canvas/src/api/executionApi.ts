const BASE_URL = import.meta.env.VITE_CONSTRUCTOR_URL ?? "http://127.0.0.1:4001";

export interface ExecutionStreamEvent {
  type: "task.step" | "task.tool_call" | "task.awaiting_approval" | "task.completed" | "task.failed";
  runId: string;
  message: string;
  ts: string;
  approvalId?: string;
}

/** Resposta do resolve — inclui o que o sistema aprendeu com a aprovação (Etapa 6), quando houve. */
export interface ApprovalResolution {
  status: "aprovado" | "rejeitado";
  aprendizado?: {
    taskPattern: string;
    tags: string[];
    skillPromovida: string | null;
  } | null;
}

/** Cliente do Motor de Execução (Etapa 5) — dispara a corrida e consome o SSE ao vivo. */
export const executionApi = {
  async run(canvasNodeId: string, taskDescription: string): Promise<{ runId: string; taskId: string }> {
    const res = await fetch(`${BASE_URL}/execution/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvasNodeId, taskDescription }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`POST /execution/run -> ${res.status}: ${body}`);
    }
    return res.json();
  },

  /** Abre o SSE de um run; devolve a função de fechar a conexão. */
  streamEvents(runId: string, onEvent: (event: ExecutionStreamEvent) => void): () => void {
    const source = new EventSource(`${BASE_URL}/execution/runs/${runId}/events`);
    source.onmessage = (msg) => {
      onEvent(JSON.parse(msg.data) as ExecutionStreamEvent);
    };
    return () => source.close();
  },

  async resolveApproval(
    approvalId: string,
    status: "aprovado" | "rejeitado",
    comentario?: string,
  ): Promise<ApprovalResolution> {
    const res = await fetch(`${BASE_URL}/approvals/${approvalId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, comentario }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`POST /approvals/${approvalId}/resolve -> ${res.status}: ${body}`);
    }
    return res.json();
  },
};
