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

/** Erro estruturado da API — carrega o `code` do servidor para o canvas traduzir em mensagem acionável. */
export class ExecutionApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

/** As mensagens que o usuário lê — em português, dizendo o que FAZER, não o JSON do servidor. */
export const EXECUTION_ERROR_MESSAGES: Record<string, string> = {
  missing_provider: "Este nó ainda não tem um provedor de IA — escolha um no seletor do próprio nó.",
  missing_ref: "Este nó não está ligado a um agente/squad real — arraste um da Biblioteca em vez de criar um vazio.",
  empty_squad: "Este squad ainda não tem membros — adicione agentes a ele no Super Construtor.",
  not_executable: "Só nós de Agente ou Squad podem ser executados.",
  adapter_error: "O provedor configurado não pôde ser iniciado — confira a configuração no painel Provedores.",
  not_found: "Algo que este nó referencia não existe mais (agente, squad ou provedor removido).",
};

export function friendlyExecutionError(err: unknown): string {
  if (err instanceof ExecutionApiError) {
    return EXECUTION_ERROR_MESSAGES[err.code] ?? `Não foi possível executar: ${err.detail}`;
  }
  return `Não foi possível falar com o Super Construtor: ${(err as Error).message}`;
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
      const body = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null;
      throw new ExecutionApiError(body?.error ?? `http_${res.status}`, body?.detail ?? "");
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
