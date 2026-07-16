"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { AutonomyBadge } from "@/components/agents/autonomy-badge";
import type { AgentAssignment } from "@/lib/org/matching";

export function AssemblyRow({
  assignment,
  phase,
}: {
  assignment: AgentAssignment;
  phase: "scanning" | "resolved";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border/70 px-4 py-3"
    >
      <div className="flex items-center gap-2">
        {phase === "scanning" ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : assignment.origem === "catalogo" ? (
          <CheckCircle2 className="size-3.5 text-success" />
        ) : (
          <Sparkles className="size-3.5 text-[var(--brand-1)]" />
        )}
        <p className="text-sm font-medium">{assignment.node.titulo}</p>
        <span className="text-xs text-muted-foreground">· {assignment.node.area}</span>
      </div>

      <div className="mt-1.5 pl-5.5 text-xs">
        {phase === "scanning" ? (
          <span className="text-muted-foreground">Buscando agente compatível no catálogo…</span>
        ) : assignment.origem === "catalogo" ? (
          <span className="text-success">
            Encontrado no catálogo: <span className="font-medium">{assignment.agent.nome}</span>
          </span>
        ) : (
          <span className="text-[var(--brand-1)]">
            Nenhuma correspondência — criado sob medida:{" "}
            <span className="font-medium">{assignment.agent.nome}</span>
          </span>
        )}
      </div>

      {phase === "resolved" && (
        <div className="mt-2 pl-5.5">
          <AutonomyBadge level={assignment.agent.autonomia} />
        </div>
      )}
    </motion.div>
  );
}
