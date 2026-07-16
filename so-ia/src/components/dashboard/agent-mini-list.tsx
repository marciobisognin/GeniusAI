"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { AutonomyBadge } from "@/components/agents/autonomy-badge";
import { fadeUp, staggerContainer } from "@/lib/motion";
import type { Agent } from "@/lib/data/types";

export function AgentMiniList({ agents }: { agents: Agent[] }) {
  const top = [...agents].sort((a, b) => b.execucoesMes - a.execucoesMes).slice(0, 5);
  const max = Math.max(...top.map((a) => a.execucoesMes));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Agentes mais ativos</CardTitle>
      </CardHeader>
      <CardContent>
        <motion.ul variants={staggerContainer(0.07)} initial="hidden" animate="show" className="space-y-3.5">
          {top.map((agent) => (
            <motion.li key={agent.id} variants={fadeUp} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{agent.nome}</span>
                <AutonomyBadge level={agent.autonomia} />
              </div>
              <div className="flex items-center gap-2.5">
                <Progress value={(agent.execucoesMes / max) * 100} className="flex-1">
                  <ProgressTrack className="h-1.5">
                    <ProgressIndicator className="bg-gradient-brand" />
                  </ProgressTrack>
                </Progress>
                <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                  {agent.execucoesMes}
                </span>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </CardContent>
    </Card>
  );
}
