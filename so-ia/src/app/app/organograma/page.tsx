"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { OrgChartTree } from "@/components/organograma/org-chart-tree";
import { AgentDetailSheet } from "@/components/agents/agent-detail-sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/components/providers/organization-provider";
import { buildTree } from "@/lib/data/org-chart";
import type { AgentAssignment } from "@/lib/org/matching";
import type { Agent } from "@/lib/data/types";

export default function OrganogramaPage() {
  const organization = useOrganization();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const tree = useMemo(() => buildTree(organization.nodes), [organization.nodes]);
  const assignmentsByNode = useMemo(
    () => new Map(organization.assignments.map((a) => [a.nodeId, a] as const)),
    [organization.assignments],
  );

  const matched = organization.assignments.filter((a) => a.origem === "catalogo").length;
  const created = organization.assignments.filter((a) => a.origem === "gerado").length;

  return (
    <div>
      <PageHeader
        eyebrow="Organograma"
        title={organization.orgName || "Minha organização"}
        description="Cada função tem um agente atribuído — encontrado no catálogo institucional ou criado sob medida na montagem do sistema."
        actions={
          <Button
            render={<Link href="/onboarding/organograma" />}
            nativeButton={false}
            variant="outline"
          >
            Editar organograma
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-6 max-w-xl">
        <Card className="p-4 gap-1">
          <p className="text-xs text-muted-foreground">Funções</p>
          <p className="text-xl font-semibold">{organization.assignments.length}</p>
        </Card>
        <Card className="p-4 gap-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="size-3 text-success" /> Do catálogo
          </p>
          <p className="text-xl font-semibold">{matched}</p>
        </Card>
        <Card className="p-4 gap-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="size-3 text-[var(--brand-1)]" /> Sob medida
          </p>
          <p className="text-xl font-semibold">{created}</p>
        </Card>
      </div>

      <div className="overflow-x-auto pb-6">
        <div className="flex gap-10 w-max px-2">
          {tree.map((root) => (
            <OrgChartTree
              key={root.id}
              node={root}
              assignmentsByNode={assignmentsByNode}
              onOpenAgent={(a: AgentAssignment) => setSelectedAgent(a.agent)}
            />
          ))}
        </div>
      </div>

      <AgentDetailSheet agent={selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)} />
    </div>
  );
}
