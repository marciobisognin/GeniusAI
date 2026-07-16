import { slugify } from "@/lib/data/org-chart";
import type { AgentAssignment } from "@/lib/org/matching";

export interface Squad {
  id: string;
  nome: string;
  area: string;
  liderTitulo: string | null;
  membros: AgentAssignment[];
  skills: string[];
}

/**
 * Groups the assembled agents into squads by area of the organograma —
 * the same grouping the system graph already draws as hubs, made into a
 * first-class entity with a lead (the member whose reporting chain exits
 * the area first) and a consolidated skill set.
 */
export function buildSquads(assignments: AgentAssignment[]): Squad[] {
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

    const skills = Array.from(new Set(membros.flatMap((m) => m.agent.skills)));

    return {
      id: `squad-${slugify(area)}`,
      nome: `Squad de ${area}`,
      area,
      liderTitulo: lider?.node.titulo ?? null,
      membros,
      skills,
    };
  });
}
