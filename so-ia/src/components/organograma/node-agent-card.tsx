"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, CheckCircle2, PlayCircle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AutonomyBadge } from "@/components/agents/autonomy-badge";
import type { AgentAssignment } from "@/lib/org/matching";

export function NodeAgentCard({
  assignment,
  onOpenAgent,
}: {
  assignment: AgentAssignment;
  onOpenAgent: () => void;
}) {
  const [running, setRunning] = useState(false);
  const { node, agent, origem } = assignment;

  function handleRun() {
    setRunning(true);
    setTimeout(() => setRunning(false), 2200);
  }

  return (
    <Card className="p-4 gap-3 w-72 shrink-0">
      <div>
        <p className="font-medium text-sm leading-snug">{node.titulo}</p>
        <p className="text-xs text-muted-foreground">{node.area}</p>
      </div>

      {node.responsabilidades.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {node.responsabilidades.slice(0, 3).map((r) => (
            <Badge key={r} variant="secondary" className="text-[10px] font-normal">
              {r}
            </Badge>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border/70 p-2.5 space-y-2 bg-secondary/30">
        <button
          onClick={onOpenAgent}
          className="flex items-center gap-1.5 text-left cursor-pointer group"
        >
          <Bot className="size-3.5 text-[var(--brand-1)] shrink-0" />
          <span className="text-xs font-medium group-hover:underline">{agent.nome}</span>
        </button>
        <div className="flex items-center gap-1.5 flex-wrap">
          <AutonomyBadge level={agent.autonomia} />
          {origem === "catalogo" ? (
            <Badge variant="outline" className="text-[10px] border-success/30 text-success font-normal">
              <CheckCircle2 className="size-3" /> Do catálogo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-[var(--brand-1)]/30 text-[var(--brand-1)] font-normal">
              <Sparkles className="size-3" /> Criado sob medida
            </Badge>
          )}
        </div>

        <AnimatePresence mode="wait">
          {running ? (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[11px] text-success"
            >
              <CheckCircle2 className="size-3" />
              Execução simulada concluída
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRun}
                className="h-7 w-full text-xs"
              >
                <PlayCircle className="size-3.5" />
                Executar agora
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
