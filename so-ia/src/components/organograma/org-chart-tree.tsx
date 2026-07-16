"use client";

import { NodeAgentCard } from "@/components/organograma/node-agent-card";
import type { buildTree } from "@/lib/data/org-chart";
import type { AgentAssignment } from "@/lib/org/matching";

type TreeNode = ReturnType<typeof buildTree>[number];

export function OrgChartTree({
  node,
  assignmentsByNode,
  onOpenAgent,
}: {
  node: TreeNode;
  assignmentsByNode: Map<string, AgentAssignment>;
  onOpenAgent: (assignment: AgentAssignment) => void;
}) {
  const assignment = assignmentsByNode.get(node.id);
  if (!assignment) return null;

  return (
    <div className="flex flex-col items-center">
      <NodeAgentCard assignment={assignment} onOpenAgent={() => onOpenAgent(assignment)} />

      {node.children.length > 0 && (
        <>
          <div className="h-6 w-px bg-border" aria-hidden />
          <div className="flex items-start gap-6">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="h-4 w-px bg-border" aria-hidden />
                <OrgChartTree node={child} assignmentsByNode={assignmentsByNode} onOpenAgent={onOpenAgent} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
