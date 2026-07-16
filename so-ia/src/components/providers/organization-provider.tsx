"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { OrgNode } from "@/lib/data/org-chart";
import { createEmptyNode } from "@/lib/data/org-chart";
import { assembleOrganization, type AgentAssignment } from "@/lib/org/matching";
import type { TenantMode } from "@/components/providers/mode-provider";

export type OrgStatus = "empty" | "draft" | "ready";

export interface ExecutionRecord {
  id: string;
  nodeId: string;
  agentId: string;
  agentNome: string;
  funcao: string;
  area: string;
  iniciadoEm: string;
  status: "executando" | "concluido";
}

interface OrganizationState {
  orgType: TenantMode | null;
  orgName: string;
  nodes: OrgNode[];
  assignments: AgentAssignment[];
  status: OrgStatus;
  executions: ExecutionRecord[];
}

interface OrganizationContextValue extends OrganizationState {
  setOrgType: (type: TenantMode) => void;
  setOrgName: (name: string) => void;
  setNodes: (nodes: OrgNode[]) => void;
  addNode: (node?: Partial<OrgNode>) => OrgNode;
  updateNode: (id: string, patch: Partial<OrgNode>) => void;
  removeNode: (id: string) => void;
  assemble: () => void;
  runAgent: (assignment: AgentAssignment) => string;
  completeExecution: (executionId: string) => void;
  reset: () => void;
  hydrated: boolean;
}

const STORAGE_KEY = "so-ia:organization";

const emptyState: OrganizationState = {
  orgType: null,
  orgName: "",
  nodes: [],
  assignments: [],
  status: "empty",
  executions: [],
};

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OrganizationState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<OrganizationState>;
        // Merge over emptyState so stored payloads from older versions
        // (without `executions`) hydrate with sane defaults.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState({ ...emptyState, ...parsed });
      } catch {
        // ignore corrupt storage
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const setOrgType = useCallback((orgType: TenantMode) => {
    setState((s) => ({ ...s, orgType, status: s.status === "empty" ? "draft" : s.status }));
  }, []);

  const setOrgName = useCallback((orgName: string) => {
    setState((s) => ({ ...s, orgName }));
  }, []);

  const setNodes = useCallback((nodes: OrgNode[]) => {
    setState((s) => ({ ...s, nodes, status: nodes.length > 0 ? "draft" : s.status }));
  }, []);

  const addNode = useCallback((overrides: Partial<OrgNode> = {}) => {
    const node = createEmptyNode(overrides);
    setState((s) => ({ ...s, nodes: [...s.nodes, node], status: "draft" }));
    return node;
  }, []);

  const updateNode = useCallback((id: string, patch: Partial<OrgNode>) => {
    setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  }, []);

  const removeNode = useCallback((id: string) => {
    setState((s) => {
      const target = s.nodes.find((n) => n.id === id);
      const parentId = target?.parentId ?? null;
      const nodes = s.nodes
        .filter((n) => n.id !== id)
        .map((n) => (n.parentId === id ? { ...n, parentId } : n));
      return { ...s, nodes };
    });
  }, []);

  const assemble = useCallback(() => {
    setState((s) => ({ ...s, assignments: assembleOrganization(s.nodes), status: "ready" }));
  }, []);

  const runAgent = useCallback((assignment: AgentAssignment) => {
    const id = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record: ExecutionRecord = {
      id,
      nodeId: assignment.nodeId,
      agentId: assignment.agent.id,
      agentNome: assignment.agent.nome,
      funcao: assignment.node.titulo,
      area: assignment.node.area,
      iniciadoEm: new Date().toISOString(),
      status: "executando",
    };
    setState((s) => ({ ...s, executions: [record, ...s.executions].slice(0, 50) }));
    return id;
  }, []);

  const completeExecution = useCallback((executionId: string) => {
    setState((s) => ({
      ...s,
      executions: s.executions.map((e) =>
        e.id === executionId ? { ...e, status: "concluido" } : e,
      ),
    }));
  }, []);

  const reset = useCallback(() => {
    setState(emptyState);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <OrganizationContext.Provider
      value={{
        ...state,
        setOrgType,
        setOrgName,
        setNodes,
        addNode,
        updateNode,
        removeNode,
        assemble,
        runAgent,
        completeExecution,
        reset,
        hydrated,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
