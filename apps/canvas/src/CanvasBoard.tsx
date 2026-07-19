import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { CanvasNode, CanvasNodeKind } from "@genius/canon";
import { canvasApi } from "./api/canvasApi.js";
import { apiClient } from "./api/client.js";
import { applyDagreLayout } from "./layout/dagreLayout.js";
import { nodeTypes, type CanvasFlowNode } from "./nodes/index.js";
import { CommandPalette } from "./palette/CommandPalette.js";

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function toFlowNode(
  canvasNode: CanvasNode,
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void,
  onDelete: (id: string) => void,
): CanvasFlowNode {
  return {
    id: canvasNode.id,
    type: canvasNode.kind,
    position: canvasNode.position,
    data: {
      canvasNode,
      onUpdate: (patch: Partial<CanvasNode>) => onUpdate(canvasNode.id, patch),
      onDelete: () => onDelete(canvasNode.id),
    },
  };
}

function CanvasBoardInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<"carregando" | "conectado" | "offline">("carregando");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { setCenter, getNode } = useReactFlow<CanvasFlowNode>();
  const persistPositionDebounced = useRef(
    debounce((id: string, position: { x: number; y: number }) => {
      void canvasApi.updateNode(id, { position }).catch(() => setStatus("offline"));
    }, 150),
  ).current;
  const persistContentDebounced = useRef(
    debounce((id: string, patch: Partial<CanvasNode>) => {
      void canvasApi.updateNode(id, patch).catch(() => setStatus("offline"));
    }, 300),
  ).current;

  const handleUpdateNode = useCallback(
    (id: string, patch: Partial<CanvasNode>) => {
      setNodes((current) =>
        current.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, canvasNode: { ...n.data.canvasNode, ...patch } } } : n,
        ),
      );
      if (patch.position) {
        persistPositionDebounced(id, patch.position as { x: number; y: number });
      } else {
        persistContentDebounced(id, patch);
      }
    },
    [setNodes, persistPositionDebounced, persistContentDebounced],
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((current) => current.filter((n) => n.id !== id));
      setEdges((current) => current.filter((e) => e.source !== id && e.target !== id));
      void canvasApi.removeNode(id).catch(() => setStatus("offline"));
    },
    [setNodes, setEdges],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await apiClient.health();
        const [canvasNodes, canvasEdges] = await Promise.all([canvasApi.listNodes(), canvasApi.listEdges()]);
        if (cancelled) return;
        setNodes(canvasNodes.map((n) => toFlowNode(n, handleUpdateNode, handleDeleteNode)));
        setEdges(canvasEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })));
        setStatus("conectado");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNodeDragStop = useCallback(
    (_event: unknown, node: CanvasFlowNode) => {
      void canvasApi.updateNode(node.id, { position: node.position }).catch(() => setStatus("offline"));
    },
    [],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const id = crypto.randomUUID();
      setEdges((current) => addEdge({ ...connection, id }, current));
      void canvasApi
        .createEdge({ id, source: connection.source!, target: connection.target!, createdAt: new Date().toISOString() })
        .catch(() => setStatus("offline"));
    },
    [setEdges],
  );

  const onEdgesDeleteHandler = useCallback((deleted: Edge[]) => {
    for (const edge of deleted) {
      void canvasApi.removeEdge(edge.id).catch(() => setStatus("offline"));
    }
  }, []);

  const createNode = useCallback(
    (kind: CanvasNodeKind) => {
      const id = crypto.randomUUID();
      const position = { x: 80 + Math.random() * 160, y: 80 + Math.random() * 160 };
      const canvasNode: CanvasNode = {
        id,
        kind,
        title: "",
        content: "",
        log: [],
        position,
        createdAt: new Date().toISOString(),
        ...(kind === "execution" ? { status: "aguardando" as const } : {}),
      };
      setNodes((current) => [...current, toFlowNode(canvasNode, handleUpdateNode, handleDeleteNode)]);
      void canvasApi.createNode(canvasNode).catch(() => setStatus("offline"));
    },
    [setNodes, handleUpdateNode, handleDeleteNode],
  );

  const focusNode = useCallback(
    (id: string) => {
      const node = getNode(id);
      if (!node) return;
      setCenter(node.position.x + 120, node.position.y + 60, { zoom: 1.2, duration: 400 });
    },
    [getNode, setCenter],
  );

  const organizeAutomatically = useCallback(() => {
    setNodes((current) => {
      const laidOut = applyDagreLayout(current, edges);
      for (const node of laidOut) {
        void canvasApi.updateNode(node.id, { position: node.position }).catch(() => setStatus("offline"));
      }
      return laidOut;
    });
  }, [setNodes, edges]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const existingCanvasNodes = useMemo(() => nodes.map((n) => n.data.canvasNode), [nodes]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 10,
          display: "flex",
          gap: 8,
          alignItems: "center",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
        }}
      >
        <strong>Genius Allspark Canvas</strong>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            background: status === "conectado" ? "#16a34a" : status === "offline" ? "#dc2626" : "#6b7280",
            color: "#fff",
          }}
        >
          Super Construtor: {status}
        </span>
        <button type="button" onClick={() => setPaletteOpen(true)} style={{ padding: "4px 8px", cursor: "pointer" }}>
          ⌘K Comandos
        </button>
        <button type="button" onClick={organizeAutomatically} style={{ padding: "4px 8px", cursor: "pointer" }}>
          Organizar automaticamente
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDeleteHandler}
        snapToGrid
        snapGrid={[8, 8]}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        existingNodes={existingCanvasNodes}
        onCreateNode={createNode}
        onFocusNode={focusNode}
      />
    </div>
  );
}

export function CanvasBoard() {
  return (
    <ReactFlowProvider>
      <CanvasBoardInner />
    </ReactFlowProvider>
  );
}
