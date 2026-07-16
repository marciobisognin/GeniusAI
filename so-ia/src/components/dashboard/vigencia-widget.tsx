"use client";

import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { VigenciaAlerta } from "@/lib/data/dashboard";

const urgencyStyles: Record<VigenciaAlerta["urgencia"], string> = {
  alto: "bg-warning/15 text-warning border-warning/30",
  medio: "bg-[var(--brand-1)]/12 text-[var(--brand-1)] border-[var(--brand-1)]/25",
  baixo: "bg-success/12 text-success border-success/25",
};

export function VigenciaWidget({ alertas }: { alertas: VigenciaAlerta[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="size-4 text-[var(--brand-1)]" />
          Vigências em risco
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.ul variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-2.5">
          {alertas.map((v) => (
            <motion.li
              key={v.contrato}
              variants={fadeUp}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">Contrato {v.contrato}</p>
                <p className="text-xs text-muted-foreground truncate">{v.objeto}</p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className={cn("mb-1", urgencyStyles[v.urgencia])}>
                  D-{v.dias}
                </Badge>
                <p className="text-[11px] text-muted-foreground">{v.vencimento}</p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </CardContent>
    </Card>
  );
}
