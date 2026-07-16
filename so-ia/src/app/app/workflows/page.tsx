"use client";

import { motion } from "framer-motion";
import { FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTenantMode } from "@/components/providers/mode-provider";
import {
  workflowComplianceRefs,
  workflowComplianceRefsEmpresa,
  workflowLeadParaProposta,
  workflowPesquisaPrecos,
} from "@/lib/data/workflow";
import { fadeUp } from "@/lib/motion";

export default function WorkflowsPage() {
  const { mode } = useTenantMode();
  const isGoverno = mode === "governo";
  const steps = isGoverno ? workflowPesquisaPrecos : workflowLeadParaProposta;
  const refs = isGoverno ? workflowComplianceRefs : workflowComplianceRefsEmpresa;

  return (
    <div>
      <PageHeader
        eyebrow="Construtor visual"
        title={isGoverno ? "wf-pesquisa-precos" : "wf-lead-para-proposta"}
        description={
          isGoverno
            ? "Workflow governado com segregação de funções obrigatória — o aprovador nunca pode ser o autor do ato."
            : "Workflow do funil comercial, do enriquecimento do lead até a aprovação da proposta."
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Etapas do workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowCanvas steps={steps} />
            </CardContent>
          </Card>
        </div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck2 className="size-4 text-[var(--brand-1)]" />
                Referências de conformidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {refs.map((ref) => (
                  <Badge key={ref} variant="outline" className="font-normal">
                    {ref}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {isGoverno && (
            <Card className="border-warning/30 bg-warning/[0.03]">
              <CardHeader>
                <CardTitle className="text-base text-warning">Segregação de funções</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                O Acórdão TCU nº 1668/2021 veda que o mesmo agente elabore e aprove o
                mesmo ato. O SO-IA codifica essa regra diretamente no workflow — a
                etapa de aprovação humana é bloqueada se o aprovador coincidir com o
                autor do ETP/TR.
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
