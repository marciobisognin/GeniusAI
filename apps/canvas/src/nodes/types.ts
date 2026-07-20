import type { CanvasNode } from "@genius/canon";
import type { Node } from "@xyflow/react";

/** Payload que cada nó do React Flow carrega — o `CanvasNode` persistido mais os callbacks do board. */
export interface CanvasNodeData {
  canvasNode: CanvasNode;
  onUpdate: (patch: Partial<CanvasNode>) => void;
  onDelete: () => void;
  /** Só presente em nós "agent"/"squad" — dispara o Motor de Execução (Etapa 5) com uma tarefa em linguagem natural. */
  onExecute?: (taskDescription: string) => void;
  /** Canal de feedback do board (toasts) — usado, por ex., para contar o que o sistema aprendeu numa aprovação. */
  onNotify?: (kind: "sucesso" | "erro" | "aprendizado" | "info", text: string) => void;
  [key: string]: unknown;
}

export type CanvasFlowNode = Node<CanvasNodeData>;
