"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutonomyBadge } from "@/components/agents/autonomy-badge";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/data/types";
import type { AgentOrigin } from "@/lib/org/matching";

const statusDot = {
  ativo: "bg-success",
  pausado: "bg-muted-foreground",
  revisao: "bg-warning",
};

export function AgentCard({
  agent,
  onSelect,
  roleLabel,
  origem,
}: {
  agent: Agent;
  onSelect: (agent: Agent) => void;
  roleLabel?: string;
  origem?: AgentOrigin;
}) {
  const visibleSkills = agent.skills.slice(0, 3);
  const extra = agent.skills.length - visibleSkills.length;

  return (
    <motion.div variants={fadeUp}>
      <Card
        onClick={() => onSelect(agent)}
        className="group cursor-pointer p-5 gap-3 h-full hover:glow-ring hover:-translate-y-0.5 transition-all duration-300"
      >
        {roleLabel && (
          <div className="flex items-center justify-between gap-2 -mt-1 -mb-1">
            <span className="text-[11px] font-medium text-muted-foreground truncate">
              Atende: {roleLabel}
            </span>
            {origem === "catalogo" ? (
              <Badge variant="outline" className="text-[10px] border-success/30 text-success font-normal shrink-0">
                <CheckCircle2 className="size-3" /> Do catálogo
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] border-[var(--brand-1)]/30 text-[var(--brand-1)] font-normal shrink-0"
              >
                <Sparkles className="size-3" /> Sob medida
              </Badge>
            )}
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("size-1.5 rounded-full shrink-0", statusDot[agent.status])} />
              <p className="text-xs text-muted-foreground truncate">{agent.area}</p>
            </div>
            <h3 className="font-medium leading-snug mt-1 group-hover:text-gradient-brand transition-colors">
              {agent.nome}
            </h3>
          </div>
          <AutonomyBadge level={agent.autonomia} className="shrink-0" />
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2">{agent.descricao}</p>

        <div className="flex flex-wrap gap-1.5 mt-1">
          {visibleSkills.map((skill) => (
            <Badge key={skill} variant="secondary" className="font-mono text-[11px] font-normal">
              {skill}
            </Badge>
          ))}
          {extra > 0 && (
            <Badge variant="secondary" className="text-[11px] font-normal">
              +{extra}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/70 text-xs text-muted-foreground">
          <span>{agent.execucoesMes.toLocaleString("pt-BR")} execuções/mês</span>
          <span>{Math.round(agent.taxaAprovacao * 100)}% aprovação</span>
        </div>
      </Card>
    </motion.div>
  );
}
