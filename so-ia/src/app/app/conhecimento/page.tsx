"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FileSearch, History, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SystemGraph } from "@/components/graph/system-graph";
import { GraphAgentPanel } from "@/components/graph/graph-agent-panel";
import { AgentDetailSheet } from "@/components/agents/agent-detail-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantMode } from "@/components/providers/mode-provider";
import { useOrganization } from "@/components/providers/organization-provider";
import type { AgentAssignment } from "@/lib/org/matching";
import type { Agent } from "@/lib/data/types";
import { fadeUp, staggerContainer } from "@/lib/motion";

const EXECUTION_DURATION_MS = 2600;

const sourcesByMode = {
  empresa: ["Google Drive", "CRM (HubSpot/Pipedrive)", "Confluence / Notion", "Gmail / Outlook"],
  governo: ["SIPAC/SIG", "PNCP", "Compras.gov.br", "Diário Oficial da União"],
};

export default function ConhecimentoPage() {
  const { mode } = useTenantMode();
  const organization = useOrganization();
  const [selected, setSelected] = useState<AgentAssignment | null>(null);
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);

  const handleRun = useCallback(
    (assignment: AgentAssignment) => {
      const id = organization.runAgent(assignment);
      window.setTimeout(() => organization.completeExecution(id), EXECUTION_DURATION_MS);
    },
    [organization],
  );

  const sources = sourcesByMode[mode];
  const recent = organization.executions.slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Núcleo de Conhecimento"
        title="Grafo do sistema"
        description="O grafo é operacional: cada nó maior é um agente do seu organograma e cada ponto menor é uma skill dele. Clique em um agente para inspecioná-lo e executá-lo daqui — a execução fica registrada e aparece no Centro de Comando."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 overflow-hidden">
          <CardContent className="flex justify-center py-8">
            <SystemGraph
              assignments={organization.assignments}
              executions={organization.executions}
              selectedNodeId={selected?.nodeId ?? null}
              onSelect={setSelected}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <GraphAgentPanel
            assignment={selected}
            executions={organization.executions}
            onRun={handleRun}
            onOpenDetail={(a) => setDetailAgent(a.agent)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="size-4 text-[var(--brand-1)]" />
                Execuções recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma execução ainda — dispare a primeira pelo grafo ao lado.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 text-xs">
                      {e.status === "executando" ? (
                        <Loader2 className="mt-0.5 size-3 animate-spin text-[var(--brand-1)] shrink-0" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 size-3 text-success shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{e.agentNome}</span>
                        <span className="text-muted-foreground"> · {e.funcao}</span>
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(e.iniciadoEm).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSearch className="size-4 text-[var(--brand-1)]" />
              Fontes de conhecimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.ul
              variants={staggerContainer(0.06)}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
            >
              {sources.map((source) => (
                <motion.li
                  key={source}
                  variants={fadeUp}
                  className="flex items-center gap-2.5 rounded-lg border border-border/70 px-3 py-2 text-sm"
                >
                  <span className="size-1.5 rounded-full bg-success" />
                  {source}
                </motion.li>
              ))}
            </motion.ul>
          </CardContent>
        </Card>
      </div>

      <AgentDetailSheet agent={detailAgent} onOpenChange={(open) => !open && setDetailAgent(null)} />
    </div>
  );
}
