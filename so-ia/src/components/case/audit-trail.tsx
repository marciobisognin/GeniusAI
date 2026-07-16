"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fadeUp, staggerContainer } from "@/lib/motion";
import type { AuditEvent } from "@/lib/data/types";

export function AuditTrail({ events }: { events: AuditEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="size-4 text-[var(--brand-1)]" />
          Trilha de auditoria (append-only)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.ol
          variants={staggerContainer(0.1)}
          initial="hidden"
          animate="show"
          className="relative space-y-4 pl-4"
        >
          <div
            className="absolute left-[3px] top-1.5 bottom-1.5 w-px bg-gradient-to-b from-[var(--brand-1)] via-[var(--brand-2)] to-transparent opacity-40"
            aria-hidden
          />
          {events.map((event) => (
            <motion.li key={event.id} variants={fadeUp} className="relative">
              <span className="absolute -left-4 top-1.5 size-1.5 rounded-full bg-[var(--brand-1)]" />
              <p className="font-mono text-xs font-medium">{event.acao}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{event.detalhe}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {event.ator} · {event.timestamp}
              </p>
            </motion.li>
          ))}
        </motion.ol>
      </CardContent>
    </Card>
  );
}
