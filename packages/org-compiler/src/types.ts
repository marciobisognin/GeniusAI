/**
 * Tipos do domínio de organograma — subconjunto de `so-ia/src/lib/data/types.ts`
 * de que o compilador precisa. Os tipos de UI (KpiCard, ActivityItem, …) ficam
 * no app: não são parte do motor.
 */
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

export interface WorkflowStep {
  id: string;
  tipo: "agent" | "human_approval" | "trigger";
  label: string;
  agente?: string;
  autonomia?: AutonomyLevel;
  regra?: string;
  descricao: string;
}

