"use client";

import { useMemo } from "react";
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
import { useOrganization } from "@/components/providers/organization-provider";
import {
  activityEmpresa,
  activityGoverno,
  executionsSeriesEmpresa,
  executionsSeriesGoverno,
  vigenciasGoverno,
} from "@/lib/data/dashboard";
import { getApprovalsForOrganization } from "@/lib/data/approvals";
import { organizationCovers } from "@/lib/org/relevance";
import type { KpiCard as KpiCardData } from "@/lib/data/types";
import { staggerContainer } from "@/lib/motion";
import { tenantLabel } from "@/lib/nav-config";

export default function DashboardPage() {
  const { mode } = useTenantMode();
  const organization = useOrganization();
  const isGoverno = (organization.orgType ?? mode) === "governo";
  const series = isGoverno ? executionsSeriesGoverno : executionsSeriesEmpresa;
  const agents = organization.assignments.map((a) => a.agent);
  const orgLabel = organization.orgName || tenantLabel[mode].org;

  const doCatalogo = organization.assignments.filter((a) => a.origem === "catalogo").length;
  const sobMedida = organization.assignments.length - doCatalogo;
  const squadsReuso = organization.squads.filter((s) => s.origem === "repositorio").length;
  const squadsCriados = organization.squads.length - squadsReuso;
  const areas = new Set(organization.nodes.map((n) => n.area.trim()).filter(Boolean)).size;
  const pendencias = useMemo(
    () => getApprovalsForOrganization(organization.orgType, organization.nodes).length,
    [organization.orgType, organization.nodes],
  );

  // KPIs derivados do estado real da organização — nada de métricas de
  // ferramentas que o organograma não tem.
  const kpis: KpiCardData[] = [
    {
      label: "Funções no organograma",
      value: String(organization.nodes.length),
      delta: `${areas} área(s)`,
      trend: "flat",
    },
    {
      label: "Agentes ativos",
      value: String(organization.assignments.length),
      delta: `${doCatalogo} do catálogo`,
      trend: "up",
      hint: `${sobMedida} sob medida`,
    },
    {
      label: "Squads ativos",
      value: String(organization.squads.length),
      delta: `${squadsReuso} do repositório`,
      trend: "up",
      hint: `${squadsCriados} criado(s)`,
    },
    {
      label: "Aprovações pendentes",
      value: String(pendencias),
      delta: "das áreas do organograma",
      trend: "flat",
    },
  ];

  // Widget de vigências só existe se o organograma tiver área de contratos.
  const cobreContratos = organizationCovers(
    { area: "Licitações e Contratos", texto: "contratos vigência aditivos prorrogação" },
    organization.nodes,
  );
  const showVigencias = isGoverno && cobreContratos;

  // Execuções reais (disparadas pelo grafo ou pela árvore do organograma)
  // entram no topo do feed; os itens ilustrativos só entram se a área deles
  // existir no organograma.
  const realActivity = organization.executions.slice(0, 4).map((e) => ({
    id: e.id,
    agente: e.agentNome,
    acao:
      e.status === "executando"
        ? `Executando skills da função ${e.funcao}`
        : `Concluiu execução para a função ${e.funcao}`,
    area: e.area,
    timestamp: new Date(e.iniciadoEm).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    status: e.status === "executando" ? ("aguardando" as const) : ("concluido" as const),
  }));
  const mockActivity = (isGoverno ? activityGoverno : activityEmpresa).filter((item) =>
    organizationCovers({ area: item.area, texto: `${item.agente} ${item.acao}` }, organization.nodes),
  );
  const activity = [...realActivity, ...mockActivity].slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Centro de Comando"
        title={orgLabel}
        description={
          isGoverno
            ? "Agentes de IA governados operando nas áreas do seu organograma, com trilha de auditoria append-only."
            : "Agentes de IA governados operando nas áreas do seu organograma."
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
        <div>{showVigencias ? <VigenciaWidget alertas={vigenciasGoverno} /> : <ActivityFeed items={activity} />}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {showVigencias ? <ActivityFeed items={activity} /> : <AgentMiniList agents={agents} />}
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

      {showVigencias && (
        <div className="mt-6">
          <AgentMiniList agents={agents} />
        </div>
      )}
    </div>
  );
}
