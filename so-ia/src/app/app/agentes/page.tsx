"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AgentCard } from "@/components/agents/agent-card";
import { AgentDetailSheet } from "@/components/agents/agent-detail-sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTenantMode } from "@/components/providers/mode-provider";
import { getAgents } from "@/lib/data/agents";
import { staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/data/types";

export default function AgentesPage() {
  const { mode } = useTenantMode();
  const agents = getAgents(mode);
  const areas = useMemo(() => ["Todas", ...Array.from(new Set(agents.map((a) => a.area)))], [agents]);

  const [query, setQuery] = useState("");
  const [area, setArea] = useState("Todas");
  const [selected, setSelected] = useState<Agent | null>(null);

  const filtered = agents.filter((a) => {
    const matchesArea = area === "Todas" || a.area === area;
    const matchesQuery =
      query.trim().length === 0 ||
      a.nome.toLowerCase().includes(query.toLowerCase()) ||
      a.skills.some((s) => s.includes(query.toLowerCase()));
    return matchesArea && matchesQuery;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Catálogo"
        title="Agentes & Skills"
        description="Cada agente combina skills reutilizáveis (SKILL.md), conectores MCP e uma política de modelo — sob o nível de autonomia adequado ao ato que executa."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por agente ou skill…"
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
        {filtered.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onSelect={setSelected} />
        ))}
      </motion.div>

      <AgentDetailSheet agent={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
