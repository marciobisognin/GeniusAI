import dagre from "@dagrejs/dagre";
import type { Edge } from "@xyflow/react";
import type { CanvasFlowNode } from "../nodes/types.js";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;

/** Auto-layout hierárquico — usado para organizar squads/agentes importados sem sobreposição. */
export function applyDagreLayout(nodes: CanvasFlowNode[], edges: Edge[]): CanvasFlowNode[] {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 32, ranksep: 64 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const position = graph.node(node.id);
    if (!position) return node;
    return {
      ...node,
      position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
    };
  });
}
