"use client";

import { motion } from "framer-motion";
import { Database, FileSearch, Quote, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { GalaxyGraph } from "@/components/landing/galaxy-graph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantMode } from "@/components/providers/mode-provider";
import { useOrganization } from "@/components/providers/organization-provider";
import { areasByMode, areasFromNodes } from "@/lib/nav-config";
import { fadeUp, staggerContainer } from "@/lib/motion";

const sourcesByMode = {
  empresa: ["Google Drive", "CRM (HubSpot/Pipedrive)", "Confluence / Notion", "Gmail / Outlook"],
  governo: ["SIPAC/SIG", "PNCP", "Compras.gov.br", "Diário Oficial da União"],
};

const stats = [
  { label: "Fontes conectadas", value: "4", icon: Database },
  { label: "Citações geradas este mês", value: "1.842", icon: Quote },
  { label: "Taxa de citações válidas", value: "97%", icon: ShieldCheck },
];

export default function ConhecimentoPage() {
  const { mode } = useTenantMode();
  const organization = useOrganization();
  const ready = organization.status === "ready";
  const areas = ready ? areasFromNodes(organization.nodes) : areasByMode[mode];
  const sources = sourcesByMode[mode];

  return (
    <div>
      <PageHeader
        eyebrow="Núcleo de Conhecimento"
        title="Conhecimento citável"
        description="Um RAG central compartilhado por todos os agentes do seu organograma, com citações verificáveis e filtros por permissão em tempo de consulta — nenhuma resposta sem fonte."
      />

      <Card className="mb-6 overflow-hidden">
        <CardContent className="flex justify-center py-10">
          <GalaxyGraph areas={areas} key={organization.orgName || mode} />
        </CardContent>
      </Card>

      <motion.div
        variants={staggerContainer(0.07)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={fadeUp}>
            <Card className="p-5 gap-2">
              <stat.icon className="size-4 text-[var(--brand-1)]" />
              <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

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
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
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
  );
}
