"use client";

import { motion } from "framer-motion";
import { Bot, ShieldAlert, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutonomyBadge } from "@/components/agents/autonomy-badge";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { WorkflowStep } from "@/lib/data/types";

const iconByType = {
  trigger: Zap,
  agent: Bot,
  human_approval: ShieldAlert,
};

export function WorkflowCanvas({ steps }: { steps: WorkflowStep[] }) {
  return (
    <motion.div
      variants={staggerContainer(0.12)}
      initial="hidden"
      animate="show"
      className="relative pl-4"
    >
      <div
        className="absolute left-[27px] top-6 bottom-6 w-px bg-gradient-to-b from-[var(--brand-1)] via-[var(--brand-2)] to-transparent opacity-40"
        aria-hidden
      />

      <div className="space-y-5">
        {steps.map((step, i) => {
          const Icon = iconByType[step.tipo];
          const isGate = step.tipo === "human_approval";
          return (
            <motion.div key={step.id} variants={fadeUp} className="relative flex gap-4">
              <div
                className={cn(
                  "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2 bg-card",
                  isGate
                    ? "border-warning text-warning"
                    : step.tipo === "trigger"
                      ? "border-muted-foreground/40 text-muted-foreground"
                      : "border-[var(--brand-1)] text-[var(--brand-1)]",
                )}
              >
                <Icon className="size-4.5" />
              </div>

              <Card
                className={cn(
                  "flex-1 p-4 gap-1.5",
                  isGate && "border-warning/40 bg-warning/[0.04]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-sm font-medium">{step.label}</p>
                  {step.autonomia && <AutonomyBadge level={step.autonomia} />}
                </div>
                <p className="text-sm text-muted-foreground">{step.descricao}</p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {step.agente && (
                    <Badge variant="secondary" className="font-normal">
                      {step.agente}
                    </Badge>
                  )}
                  {step.regra && (
                    <Badge variant="outline" className="border-warning/40 text-warning font-mono text-[11px]">
                      regra: {step.regra}
                    </Badge>
                  )}
                </div>
              </Card>
              <span className="absolute -left-4 top-3 text-[11px] tabular-nums text-muted-foreground/50 w-4 text-right">
                {i + 1}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
