/**
 * O campo `content` de um `CanvasNode` de execução guarda, enquanto pausado
 * em "aguardando_aprovacao", tanto o id da Approval quanto a autonomia do
 * Agent/líder responsável (para o ExecutionNode explicar o porquê da pausa
 * mesmo depois de um reload) — um envelope JSON pequeno em vez de um campo
 * novo no schema só para isso.
 */
export interface ApprovalContent {
  approvalId?: string;
  autonomia?: string;
}

export function encodeApprovalContent(data: ApprovalContent): string {
  return JSON.stringify(data);
}

export function decodeApprovalContent(content: string): ApprovalContent {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    // conteúdo de antes desta mudança (approvalId como string pura) — ainda funciona para o essencial
    return { approvalId: content };
  }
}
