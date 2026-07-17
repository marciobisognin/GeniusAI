import type { WorkflowStep } from "@/lib/data/types";
import { slugify } from "@/lib/data/org-chart";
import type { AgentAssignment } from "./matching";
import { getSkill } from "./skills-registry";

export interface OrgWorkflow {
  id: string;
  titulo: string;
  descricao: string;
  steps: WorkflowStep[];
}

/**
 * Gera um workflow real a partir de uma função do organograma: as etapas são
 * as skills do agente atribuído, sempre encerradas por um gate de revisão
 * humana. Usado quando nenhum workflow de exemplo cobre as áreas da
 * organização — o sistema nunca exibe um processo de uma área que não existe.
 */
export function buildOrgWorkflow(assignment: AgentAssignment): OrgWorkflow {
  const skills = assignment.agent.skills.slice(0, 4);

  const steps: WorkflowStep[] = [
    {
      id: "trigger",
      tipo: "trigger",
      label: `Demanda para ${assignment.node.titulo}`,
      descricao: `Uma solicitação chega para a função "${assignment.node.titulo}" (${assignment.node.area}).`,
    },
    ...skills.map((skill, i) => ({
      id: `s${i + 1}`,
      tipo: "agent" as const,
      label: skill,
      agente: assignment.agent.nome,
      autonomia: assignment.agent.autonomia,
      descricao: getSkill(skill)?.descricao ?? `Skill da função ${assignment.node.titulo}.`,
    })),
    {
      id: "gate",
      tipo: "human_approval",
      label: "Revisão humana",
      regra: "aprovador = responsável pela função",
      descricao:
        "O resultado só segue após revisão do responsável no organograma — a decisão é registrada na trilha de auditoria append-only.",
    },
  ];

  return {
    id: `wf-${slugify(assignment.node.titulo)}`,
    titulo: `wf-${slugify(assignment.node.titulo)}`,
    descricao: `Workflow gerado do seu organograma: a função "${assignment.node.titulo}" executada pelas skills de ${assignment.agent.nome}, com aprovação humana ao final.`,
    steps,
  };
}

/** A função mais rica do organograma (mais skills) — melhor exemplo de workflow. */
export function pickWorkflowAssignment(assignments: AgentAssignment[]): AgentAssignment | null {
  if (assignments.length === 0) return null;
  return [...assignments].sort((a, b) => b.agent.skills.length - a.agent.skills.length)[0];
}
