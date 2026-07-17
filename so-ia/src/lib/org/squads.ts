import { slugify } from "@/lib/data/org-chart";
import type { AgentAssignment } from "@/lib/org/matching";
import {
  createSquadTemplate,
  findSquadTemplate,
  loadRepository,
  type SquadTemplate,
} from "@/lib/org/squad-registry";

export interface Squad {
  id: string;
  nome: string;
  area: string;
  liderTitulo: string | null;
  membros: AgentAssignment[];
  skills: string[];
  /** De onde o squad veio na montagem: reaproveitado do repositório ou criado agora. */
  origem: "repositorio" | "criado";
  templateId: string;
  descricao: string;
  desempenho: number;
  criadoPor?: string;
}

interface AreaGroup {
  area: string;
  membros: AgentAssignment[];
  liderTitulo: string | null;
  skills: string[];
}

function groupByArea(assignments: AgentAssignment[]): AreaGroup[] {
  const byArea = new Map<string, AgentAssignment[]>();
  for (const a of assignments) {
    const area = a.node.area || "Geral";
    byArea.set(area, [...(byArea.get(area) ?? []), a]);
  }

  const byNodeId = new Map(assignments.map((a) => [a.nodeId, a] as const));

  return Array.from(byArea.entries()).map(([area, membros]) => {
    const lider =
      membros.find((m) => {
        if (!m.node.parentId) return true;
        const parent = byNodeId.get(m.node.parentId);
        return !parent || parent.node.area !== area;
      }) ?? membros[0];

    return {
      area,
      membros,
      liderTitulo: lider?.node.titulo ?? null,
      skills: Array.from(new Set(membros.flatMap((m) => m.agent.skills))),
    };
  });
}

/**
 * Monta os squads da organização a partir dos agentes atribuídos, área a área:
 * primeiro procura um squad compatível no repositório institucional; se não
 * houver, aciona a Ferramenta de Criação de Squads (operada pelo squad de
 * melhor desempenho do repositório) para criar — e registrar — um novo.
 */
export function buildSquads(
  assignments: AgentAssignment[],
  { dryRun = false }: { dryRun?: boolean } = {},
): Squad[] {
  const repo = loadRepository();

  return groupByArea(assignments).map((group) => {
    const found = findSquadTemplate(group.area, repo);
    const template: SquadTemplate =
      found ??
      createSquadTemplate(
        group.area,
        group.membros.flatMap((m) => m.node.responsabilidades),
        { dryRun },
      );

    return {
      id: `squad-${slugify(group.area)}`,
      nome: template.nome,
      area: group.area,
      liderTitulo: group.liderTitulo,
      membros: group.membros,
      skills: group.skills,
      origem: found ? "repositorio" : "criado",
      templateId: template.id,
      descricao: template.descricao,
      desempenho: template.desempenho,
      criadoPor: template.criadoPor,
    };
  });
}
