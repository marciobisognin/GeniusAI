"use client";

import { motion } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { AutonomyBadge } from "@/components/agents/autonomy-badge";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ApprovalItem } from "@/lib/data/types";

export function ApprovalListItem({
  item,
  active,
  approved,
  onClick,
}: {
  item: ApprovalItem;
  active: boolean;
  approved: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      variants={fadeUp}
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border px-4 py-3 transition-colors cursor-pointer",
        active ? "border-[var(--brand-1)]/50 bg-[var(--brand-1)]/[0.06]" : "border-border/70 hover:bg-accent/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm font-medium leading-snug", approved && "line-through text-muted-foreground")}>
          {item.titulo}
        </p>
        {approved ? (
          <Check className="size-3.5 text-success shrink-0 mt-0.5" />
        ) : (
          <AutonomyBadge level={item.autonomia} className="shrink-0" />
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{item.agente}</p>
      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
        <Clock className="size-3" />
        {approved ? "aprovado agora mesmo" : item.sla}
      </div>
    </motion.button>
  );
}
