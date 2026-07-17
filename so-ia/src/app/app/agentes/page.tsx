"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AgentCard } from "@/components/agents/agent-card";
import { AgentDetailSheet } from "@/components/agents/agent-detail-sheet";
import { SkillsCatalog } from "@/components/agents/skills-catalog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/components/providers/organization-provider";
import { staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/data/types";

export default function AgentesPage() {
  const organization = useOrganization();
  const assignments = organization.assignments;

  const areas = useMemo(
    () => ["Todas", ...Array.from(new Set(assignments.map((a) => a.node.area).filter(Boolean)))],
    [assignments],
  );

  const [query, setQuery] = useState("");
  const [area, setArea] = useState("Todas");
  const [selected, setSelected] = useState<Agent | null>(null);

  const filtered = assignments.filter((a) => {
    const matchesArea = area === "Todas" || a.node.area === area;
    const q = query.toLowerCase();
    const matchesQuery =
      q.trim().length === 0 ||
      a.agent.nome.toLowerCase().includes(q) ||
      a.node.titulo.toLowerCase().includes(q) ||
      a.agent.skills.some((s) => s.includes(q));
    return matchesArea && matchesQuery;
  });

  const matched = assignments.filter((a) => a.origem === "catalogo").length;
  const created = assignments.filter((a) => a.origem === "gerado").length;

  return (
    <div>
      <PageHeader
        eyebrow="Catálogo"
        title="Agentes & Skills"
        description={`Montado a partir do seu organograma: ${matched} agente(s) do catálogo institucional e ${created} criado(s) sob medida. Cada agente combina skills reutilizáveis (SKILL.md), conectores MCP e uma política de modelo.`}
      />

      <Tabs defaultValue="agentes">
        <TabsList className="mb-6">
          <TabsTrigger value="agentes">Agentes</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="agentes">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por agente, função ou skill…"
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {areas.map((a) => (
                <Badge
                  key={a}
                  onClick={() => setArea(a)}
                  variant={a === area ? "default" : "secondary"}
                  className={cn(
                    "cursor-pointer font-normal",
                    a === area && "bg-gradient-brand text-white border-0",
                  )}
                >
                  {a}
                </Badge>
              ))}
            </div>
          </div>

          <motion.div
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {filtered.map((a) => (
              <AgentCard
                key={a.nodeId}
                agent={a.agent}
                roleLabel={a.node.titulo}
                origem={a.origem}
                onSelect={setSelected}
              />
            ))}
          </motion.div>
        </TabsContent>

        <TabsContent value="skills">
          <SkillsCatalog assignments={assignments} />
        </TabsContent>
      </Tabs>

      <AgentDetailSheet agent={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
