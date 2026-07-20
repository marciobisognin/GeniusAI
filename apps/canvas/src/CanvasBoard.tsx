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
import type { CanvasNode, CanvasNodeKind, ProviderConfig } from "@genius/canon";
import { canvasApi } from "./api/canvasApi.js";
import { apiClient } from "./api/client.js";
import { executionApi, friendlyExecutionError, type ExecutionStreamEvent } from "./api/executionApi.js";
import { providersApi } from "./api/providersApi.js";
import { applyDagreLayout } from "./layout/dagreLayout.js";
import { nodeTypes, type CanvasFlowNode } from "./nodes/index.js";
import { CommandPalette } from "./palette/CommandPalette.js";
import { ProvidersContext } from "./providers/ProvidersContext.js";
import { ProvidersPanel } from "./providers/ProvidersPanel.js";
import { LIBRARY_DRAG_MIME, LibraryPanel, type LibraryDragPayload } from "./library/LibraryPanel.js";
import { MemoryPanel } from "./memory/MemoryPanel.js";
import { EmptyStateGuide } from "./ui/EmptyStateGuide.js";
import { ToastHost, useToasts, type ToastKind } from "./ui/Toasts.js";

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
  onExecute?: (id: string, taskDescription: string) => void,
  onNotify?: (kind: ToastKind, text: string) => void,
): CanvasFlowNode {
  return {
    id: canvasNode.id,
    type: canvasNode.kind,
    position: canvasNode.position,
    data: {
      canvasNode,
      onUpdate: (patch: Partial<CanvasNode>) => onUpdate(canvasNode.id, patch),
      onDelete: () => onDelete(canvasNode.id),
      onExecute:
        onExecute && (canvasNode.kind === "agent" || canvasNode.kind === "squad")
          ? (taskDescription: string) => onExecute(canvasNode.id, taskDescription)
          : undefined,
      onNotify,
    },
  };
}

function CanvasBoardInner({ onOpenConstructor }: CanvasBoardProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<"carregando" | "conectado" | "offline">("carregando");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [providersOpen, setProvidersOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [libraryCount, setLibraryCount] = useState(0);
  const { toasts, notify, dismiss } = useToasts();
  const reloadProviders = useCallback(() => {
    void providersApi.list().then(setProviders);
  }, []);
  const reloadLibraryCount = useCallback(() => {
    void apiClient.list("agents").then((agents) => setLibraryCount(agents.length));
  }, []);
  const { setCenter, getNode, screenToFlowPosition } = useReactFlow<CanvasFlowNode>();
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

  /** runId -> função de fechar o EventSource; usado para não vazar conexões quando um run termina ou o board desmonta. */
  const activeStreams = useRef(new Map<string, () => void>());
  useEffect(() => {
    const streams = activeStreams.current;
    return () => {
      for (const close of streams.values()) close();
      streams.clear();
    };
  }, []);

  /** Aplica um evento SSE do Motor de Execução ao ExecutionNode correspondente — log e status ao vivo, com persistência. */
  const applyExecutionEvent = useCallback(
    (executionNodeId: string, event: ExecutionStreamEvent) => {
      setNodes((current) =>
        current.map((n) => {
          if (n.id !== executionNodeId) return n;
          const cn = n.data.canvasNode;
          const line = `[${new Date(event.ts).toLocaleTimeString()}] ${event.message}`;
          const patch: Partial<CanvasNode> = { log: [...cn.log, line] };
          if (event.type === "task.completed") patch.status = "concluido";
          else if (event.type === "task.failed") patch.status = "erro";
          else if (event.type === "task.awaiting_approval") {
            patch.status = "aguardando_aprovacao";
            patch.content = event.approvalId ?? cn.content;
          } else patch.status = "executando";
          void canvasApi.updateNode(executionNodeId, patch).catch(() => setStatus("offline"));
          return { ...n, data: { ...n.data, canvasNode: { ...cn, ...patch } } };
        }),
      );
      if (event.type === "task.completed" || event.type === "task.failed") {
        activeStreams.current.get(event.runId)?.();
        activeStreams.current.delete(event.runId);
      }
    },
    [setNodes],
  );

  /** "▶ Executar" de um AgentNode/SquadNode: dispara o run, cria o ExecutionNode ligado e assina o SSE. */
  const handleExecute = useCallback(
    (sourceNodeId: string, taskDescription: string) => {
      void (async () => {
        let runId: string;
        try {
          ({ runId } = await executionApi.run(sourceNodeId, taskDescription));
        } catch (err) {
          notify("erro", friendlyExecutionError(err));
          return;
        }

        const sourceFlowNode = getNode(sourceNodeId);
        const basePosition = sourceFlowNode?.position ?? { x: 80, y: 80 };
        const executionNodeId = crypto.randomUUID();
        const executionCanvasNode: CanvasNode = {
          id: executionNodeId,
          kind: "execution",
          refId: runId,
          title: taskDescription,
          content: "",
          status: "executando",
          log: [],
          position: { x: basePosition.x + 320, y: basePosition.y },
          createdAt: new Date().toISOString(),
        };
        setNodes((current) => [
          ...current,
          toFlowNode(executionCanvasNode, handleUpdateNode, handleDeleteNode, handleExecute, notify),
        ]);
        void canvasApi.createNode(executionCanvasNode).catch(() => setStatus("offline"));

        const edgeId = crypto.randomUUID();
        setEdges((current) => [...current, { id: edgeId, source: sourceNodeId, target: executionNodeId }]);
        void canvasApi
          .createEdge({ id: edgeId, source: sourceNodeId, target: executionNodeId, createdAt: new Date().toISOString() })
          .catch(() => setStatus("offline"));

        const close = executionApi.streamEvents(runId, (event) => applyExecutionEvent(executionNodeId, event));
        activeStreams.current.set(runId, close);
      })();
    },
    [getNode, setNodes, setEdges, handleUpdateNode, handleDeleteNode, applyExecutionEvent, notify],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await apiClient.health();
        const [canvasNodes, canvasEdges] = await Promise.all([canvasApi.listNodes(), canvasApi.listEdges()]);
        if (cancelled) return;
        setNodes(canvasNodes.map((n) => toFlowNode(n, handleUpdateNode, handleDeleteNode, handleExecute, notify)));
        setEdges(canvasEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })));
        setStatus("conectado");

        // Runs reais ainda em andamento (execução ou aguardando aprovação) voltam a receber eventos ao vivo após um reload.
        for (const node of canvasNodes) {
          if (node.kind === "execution" && node.refId && (node.status === "executando" || node.status === "aguardando_aprovacao")) {
            const close = executionApi.streamEvents(node.refId, (event) => applyExecutionEvent(node.id, event));
            activeStreams.current.set(node.refId, close);
          }
        }
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

  useEffect(() => {
    reloadProviders();
    reloadLibraryCount();
  }, [reloadProviders, reloadLibraryCount]);

  // Fechar a Biblioteca é o momento natural de reconferir se o passo 2 do primeiro contato foi cumprido.
  useEffect(() => {
    if (!libraryOpen) reloadLibraryCount();
  }, [libraryOpen, reloadLibraryCount]);

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
      setNodes((current) => [...current, toFlowNode(canvasNode, handleUpdateNode, handleDeleteNode, handleExecute, notify)]);
      void canvasApi.createNode(canvasNode).catch(() => setStatus("offline"));
    },
    [setNodes, handleUpdateNode, handleDeleteNode, handleExecute, notify],
  );

  /** Instancia um nó real ligado a um Agent/Squad do banco (refId) — não uma cópia solta. */
  const createNodeFromLibrary = useCallback(
    (payload: LibraryDragPayload, position: { x: number; y: number }) => {
      const id = crypto.randomUUID();
      const canvasNode: CanvasNode = {
        id,
        kind: payload.kind,
        refId: payload.id,
        title: payload.nome,
        content: "",
        log: [],
        position,
        createdAt: new Date().toISOString(),
      };
      setNodes((current) => [...current, toFlowNode(canvasNode, handleUpdateNode, handleDeleteNode, handleExecute, notify)]);
      void canvasApi.createNode(canvasNode).catch(() => setStatus("offline"));
    },
    [setNodes, handleUpdateNode, handleDeleteNode, handleExecute, notify],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData(LIBRARY_DRAG_MIME);
      if (!raw) return;
      const payload = JSON.parse(raw) as LibraryDragPayload;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      createNodeFromLibrary(payload, position);
    },
    [screenToFlowPosition, createNodeFromLibrary],
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
          fontFamily: "var(--fonte-ui)",
          fontSize: 13,
        }}
      >
        <strong>Genius Allspark Canvas</strong>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            background: status === "conectado" ? "var(--cor-sucesso)" : status === "offline" ? "var(--cor-erro)" : "var(--cor-texto-suave)",
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
        <button type="button" onClick={() => setProvidersOpen(true)} style={{ padding: "4px 8px", cursor: "pointer" }}>
          Provedores
        </button>
        <button type="button" onClick={() => setLibraryOpen(true)} style={{ padding: "4px 8px", cursor: "pointer" }}>
          Biblioteca
        </button>
        <button type="button" onClick={() => setMemoryOpen(true)} style={{ padding: "4px 8px", cursor: "pointer" }}>
          Memória
        </button>
        <button type="button" onClick={onOpenConstructor} style={{ padding: "4px 8px", cursor: "pointer" }}>
          Super Construtor
        </button>
      </div>

      <ProvidersContext.Provider value={providers}>
        <div style={{ width: "100%", height: "100%" }} onDragOver={onDragOver} onDrop={onDrop}>
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
        </div>
      </ProvidersContext.Provider>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        existingNodes={existingCanvasNodes}
        onCreateNode={createNode}
        onFocusNode={focusNode}
      />

      {status === "conectado" && nodes.length === 0 && (
        <EmptyStateGuide
          onOpenProviders={() => setProvidersOpen(true)}
          onOpenLibrary={() => setLibraryOpen(true)}
          hasProvider={providers.length > 0}
          hasLibrary={libraryCount > 0}
        />
      )}

      <ProvidersPanel open={providersOpen} onClose={() => setProvidersOpen(false)} onChanged={reloadProviders} />
      <LibraryPanel open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export interface CanvasBoardProps {
  onOpenConstructor: () => void;
}

export function CanvasBoard({ onOpenConstructor }: CanvasBoardProps) {
  return (
    <ReactFlowProvider>
      <CanvasBoardInner onOpenConstructor={onOpenConstructor} />
    </ReactFlowProvider>
  );
}
