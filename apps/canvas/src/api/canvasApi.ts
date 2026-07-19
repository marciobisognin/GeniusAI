import type { CanvasEdge, CanvasNode } from "@genius/canon";
import { apiClient } from "./client.js";

/** Persistência real do canvas — nenhuma posição ou conteúdo vive só no cliente. */
export const canvasApi = {
  listNodes: () => apiClient.list<CanvasNode>("canvas-nodes"),
  createNode: (node: CanvasNode) => apiClient.create<CanvasNode>("canvas-nodes", node),
  updateNode: (id: string, patch: Partial<CanvasNode>) =>
    apiClient.update<CanvasNode>("canvas-nodes", id, patch),
  removeNode: (id: string) => apiClient.remove("canvas-nodes", id),

  listEdges: () => apiClient.list<CanvasEdge>("canvas-edges"),
  createEdge: (edge: CanvasEdge) => apiClient.create<CanvasEdge>("canvas-edges", edge),
  removeEdge: (id: string) => apiClient.remove("canvas-edges", id),
};
