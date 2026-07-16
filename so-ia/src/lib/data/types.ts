export type TenantMode = "empresa" | "governo";

export type AutonomyLevel = "A0" | "A1" | "A2" | "A3" | "A4" | "A5";

export interface Skill {
  id: string;
  nome: string;
  descricao: string;
}

export interface Agent {
  id: string;
  nome: string;
  area: string;
  mode: TenantMode;
  autonomia: AutonomyLevel;
  descricao: string;
  skills: string[];
  connectors: string[];
  modelPolicy: {
    default: string;
    sensitive?: string;
  };
  execucoesMes: number;
  taxaAprovacao: number;
  status: "ativo" | "pausado" | "revisao";
}

export interface KpiCard {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  hint?: string;
}

export interface Citation {
  fonte: string;
  referencia: string;
  acessadoEm: string;
}

export interface ApprovalItem {
  id: string;
  titulo: string;
  tipo: string;
  agente: string;
  autonomia: AutonomyLevel;
  area: string;
  criadoEm: string;
  sla: string;
  resumo: string;
  valor?: string;
  citations: Citation[];
  risco: "baixo" | "medio" | "alto";
}

export interface WorkflowStep {
  id: string;
  tipo: "agent" | "human_approval" | "trigger";
  label: string;
  agente?: string;
  autonomia?: AutonomyLevel;
  regra?: string;
  descricao: string;
}

export interface AuditEvent {
  id: string;
  ator: string;
  acao: string;
  timestamp: string;
  detalhe: string;
}

export interface ActivityItem {
  id: string;
  agente: string;
  acao: string;
  area: string;
  timestamp: string;
  status: "concluido" | "aguardando" | "alerta";
}
