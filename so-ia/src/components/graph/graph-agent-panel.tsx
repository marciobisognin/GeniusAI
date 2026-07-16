"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, CheckCircle2, Loader2, MousePointerClick, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutonomyBadge } from "@/components/agents/autonomy-badge";
import type { AgentAssignment } from "@/lib/org/matching";
import type { ExecutionRecord } from "@/components/providers/organization-provider";
import { fadeIn } from "@/lib/motion";

export function GraphAgentPanel({
  assignment,
  executions,
  onRun,
  onOpenDetail,
}: {
  assignment: AgentAssignment | null;
  executions: ExecutionRecord[];
  onRun: (assignment: AgentAssignment) => void;
  onOpenDetail: (assignment: AgentAssignment) => void;
}) {
  if (!assignment) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
          <MousePointerClick className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-[220px]">
            Clique em um nó do grafo para inspecionar e executar o agente daquela função.
          </p>
        </CardContent>
      </Card>
    );
  }

  const nodeExecutions = executions.filter((e) => e.nodeId === assignment.nodeId);
  const isRunning = nodeExecutions.some((e) => e.status === "executando");
  const lastDone = nodeExecutions.find((e) => e.status === "concluido");

  return (
    <AnimatePresence mode="wait">
      <motion.div key={assignment.nodeId} variants={fadeIn} initial="hidden" animate="show" exit="hidden">
        <Card className="h-full">
          <CardHeader>
            <p className="text-xs text-muted-foreground">{assignment.node.area} · {assignment.node.titulo}</p>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="size-4 text-[var(--brand-1)]" />
              {assignment.agent.nome}
            </CardTitle>
            <div className="flex items-center gap-1.5 pt-1">
              <AutonomyBadge level={assignment.agent.autonomia} showLabel />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{assignment.agent.descricao}</p>

            <div className="flex flex-wrap gap-1.5">
              {assignment.agent.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="font-mono text-[10px] font-normal">
                  {skill}
                </Badge>
              ))}
            </div>

            <div className="space-y-2">
              {isRunning ? (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--brand-1)]/30 bg-[var(--brand-1)]/[0.06] px-3 py-2.5 text-sm text-[var(--brand-1)]">
                  <Loader2 className="size-4 animate-spin" />
                  Executando skills desta função…
                </div>
              ) : (
                <Button
                  onClick={() => onRun(assignment)}
                  className="w-full bg-gradient-brand text-white hover:opacity-90 border-0"
                >
                  <PlayCircle className="size-4" />
                  Executar agora
                </Button>
              )}
              {lastDone && !isRunning && (
                <p className="flex items-center gap-1.5 text-[11px] text-success">
                  <CheckCircle2 className="size-3" />
                  Última execução concluída às{" "}
                  {new Date(lastDone.iniciadoEm).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  — registrada na trilha de auditoria.
                </p>
              )}
              <button
                onClick={() => onOpenDetail(assignment)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
              >
                Ver ficha completa do agente
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
