"use client";

import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ExecutionsChart } from "@/components/dashboard/executions-chart";
import { AgentMiniList } from "@/components/dashboard/agent-mini-list";
import { ComplianceRing } from "@/components/dashboard/compliance-ring";
import { VigenciaWidget } from "@/components/dashboard/vigencia-widget";
import { ConnectorsCard } from "@/components/dashboard/connectors-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTenantMode } from "@/components/providers/mode-provider";
import { getAgents } from "@/lib/data/agents";
import {
  activityEmpresa,
  activityGoverno,
  executionsSeriesEmpresa,
  executionsSeriesGoverno,
  kpisEmpresa,
  kpisGoverno,
  vigenciasGoverno,
} from "@/lib/data/dashboard";
import { staggerContainer } from "@/lib/motion";
import { tenantLabel } from "@/lib/nav-config";

export default function DashboardPage() {
  const { mode } = useTenantMode();
  const isGoverno = mode === "governo";
  const kpis = isGoverno ? kpisGoverno : kpisEmpresa;
  const activity = isGoverno ? activityGoverno : activityEmpresa;
  const series = isGoverno ? executionsSeriesGoverno : executionsSeriesEmpresa;
  const agents = getAgents(mode);

  return (
    <div>
      <PageHeader
        eyebrow="Centro de Comando"
        title={isGoverno ? "Licitações e Contratos" : "Visão geral"}
        description={
          isGoverno
            ? `${tenantLabel.governo.org} · agentes governados sob a Lei 14.133/2021, com trilha de auditoria append-only.`
            : `${tenantLabel.empresa.org} · agentes de IA governados operando nas 7 áreas de negócio.`
        }
        actions={
          <Button className="bg-gradient-brand text-white hover:opacity-90 border-0">
            Novo workflow
          </Button>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6"
      >
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-2">
          <ExecutionsChart
            data={series}
            title={isGoverno ? "Execuções instruídas x aprovadas" : "Execuções x aprovações humanas"}
          />
        </div>
        <div>{isGoverno ? <VigenciaWidget alertas={vigenciasGoverno} /> : <ActivityFeed items={activity} />}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isGoverno ? <ActivityFeed items={activity} /> : <AgentMiniList agents={agents} />}
        </div>
        <div className="flex flex-col gap-6">
          {isGoverno ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conformidade da trilha</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ComplianceRing percent={100} />
              </CardContent>
            </Card>
          ) : (
            <ConnectorsCard />
          )}
        </div>
      </div>

      {isGoverno && (
        <div className="mt-6">
          <AgentMiniList agents={agents} />
        </div>
      )}
    </div>
  );
}
