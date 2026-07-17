"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Bot, Crown, Gauge, Loader2, PlayCircle, Sparkles, Users, Warehouse } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AutonomyBadge } from "@/components/agents/autonomy-badge";
import { useOrganization } from "@/components/providers/organization-provider";
import { fadeUp, staggerContainer } from "@/lib/motion";
import type { Squad } from "@/lib/org/squads";

const EXECUTION_DURATION_MS = 2400;

export function SquadCard({ squad }: { squad: Squad }) {
  const organization = useOrganization();

  const nodeIds = useMemo(() => new Set(squad.membros.map((m) => m.nodeId)), [squad]);
  const anyRunning = organization.executions.some(
    (e) => e.status === "executando" && nodeIds.has(e.nodeId),
  );

  function handleRunSquad() {
    for (const membro of squad.membros) {
      const execId = organization.runAgent(membro);
      window.setTimeout(() => organization.completeExecution(execId), EXECUTION_DURATION_MS);
    }
  }

  return (
    <Card className="p-5 gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{squad.area}</p>
          <CardTitle className="text-base">{squad.nome}</CardTitle>
          {squad.liderTitulo && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Crown className="size-3 text-[var(--brand-1)]" />
              Líder: {squad.liderTitulo}
            </p>
          )}
        </div>
        <Badge variant="secondary" className="shrink-0 gap-1 font-normal">
          <Users className="size-3" />
          {squad.membros.length}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {squad.origem === "repositorio" ? (
          <Badge variant="outline" className="text-[10px] border-success/30 text-success font-normal">
            <Warehouse className="size-3" /> Do repositório
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] border-[var(--brand-1)]/30 text-[var(--brand-1)] font-normal">
            <Sparkles className="size-3" /> Criado pela ferramenta
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] font-normal">
          <Gauge className="size-3" /> {Math.round(squad.desempenho * 100)}% desempenho
        </Badge>
        {squad.criadoPor && (
          <span className="text-[10px] text-muted-foreground">por {squad.criadoPor}</span>
        )}
      </div>

      <motion.ul variants={staggerContainer(0.05)} initial="hidden" animate="show" className="space-y-2">
        {squad.membros.map((membro) => {
          const isRunning = organization.executions.some(
            (e) => e.nodeId === membro.nodeId && e.status === "executando",
          );
          return (
            <motion.li
              key={membro.nodeId}
              variants={fadeUp}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
            >
              <div className="min-w-0 flex items-center gap-2">
                <Bot className="size-3.5 text-[var(--brand-1)] shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{membro.agent.nome}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{membro.node.titulo}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isRunning && <Loader2 className="size-3 animate-spin text-[var(--brand-1)]" />}
                <AutonomyBadge level={membro.agent.autonomia} />
              </div>
            </motion.li>
          );
        })}
      </motion.ul>

      <div className="flex flex-wrap gap-1.5">
        {squad.skills.slice(0, 6).map((skill) => (
          <Badge key={skill} variant="secondary" className="font-mono text-[10px] font-normal">
            {skill}
          </Badge>
        ))}
        {squad.skills.length > 6 && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            +{squad.skills.length - 6}
          </Badge>
        )}
      </div>

      <Button
        onClick={handleRunSquad}
        disabled={anyRunning}
        variant="outline"
        className="w-full"
      >
        {anyRunning ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Squad em execução…
          </>
        ) : (
          <>
            <PlayCircle className="size-4" />
            Executar squad ({squad.membros.length} agentes)
          </>
        )}
      </Button>
    </Card>
  );
}
