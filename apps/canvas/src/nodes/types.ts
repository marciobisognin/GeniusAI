import type { CanvasNode } from "@genius/canon";
import type { Node } from "@xyflow/react";

/** Payload que cada nó do React Flow carrega — o `CanvasNode` persistido mais os callbacks do board. */
export interface CanvasNodeData {
  canvasNode: CanvasNode;
  onUpdate: (patch: Partial<CanvasNode>) => void;
  onDelete: () => void;
  [key: string]: unknown;
}

export type CanvasFlowNode = Node<CanvasNodeData>;
