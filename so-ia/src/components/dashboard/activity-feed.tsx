"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/lib/data/types";

const statusDot: Record<ActivityItem["status"], string> = {
  concluido: "bg-success",
  aguardando: "bg-[var(--brand-1)]",
  alerta: "bg-warning",
};

const statusLabel: Record<ActivityItem["status"], string> = {
  concluido: "Concluído",
  aguardando: "Aguardando revisão",
  alerta: "Requer atenção",
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Atividade recente dos agentes</CardTitle>
      </CardHeader>
      <CardContent>
        <motion.ul
          variants={staggerContainer(0.07)}
          initial="hidden"
          animate="show"
          className="space-y-1"
        >
          {items.map((item) => (
            <motion.li
              key={item.id}
              variants={fadeUp}
              className="flex items-start gap-3 rounded-lg px-2 py-2.5 -mx-2 hover:bg-accent/50 transition-colors"
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", statusDot[item.status])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{item.acao}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.agente} · {item.area}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                <p
                  className={cn(
                    "text-[11px] font-medium mt-0.5",
                    item.status === "alerta" && "text-warning",
                    item.status === "aguardando" && "text-[var(--brand-1)]",
                    item.status === "concluido" && "text-success",
                  )}
                >
                  {statusLabel[item.status]}
                </p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </CardContent>
    </Card>
  );
}
