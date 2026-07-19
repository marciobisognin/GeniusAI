/**
 * Eventos de progresso da execução — os mesmos quatro tipos do prompt da
 * Etapa 5 do Guia de Construção. `packages/constructor` persiste cada um
 * como `RunStep` (canon) e retransmite ao vivo por SSE; `ExecutionNode` no
 * canvas consome e mostra.
 */
export type ExecutionEventType =
  | "task.step"
  | "task.tool_call"
  | "task.awaiting_approval"
  | "task.completed"
  | "task.failed";

export interface ExecutionEvent {
  type: ExecutionEventType;
  runId: string;
  message: string;
  ts: string;
  /** Presente só em `task.awaiting_approval` — id do registro de Approval criado. */
  approvalId?: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}
