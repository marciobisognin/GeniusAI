"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTenantMode } from "@/components/providers/mode-provider";
import { useOrganization } from "@/components/providers/organization-provider";
import {
  workflowComplianceRefs,
  workflowComplianceRefsEmpresa,
  workflowLeadParaProposta,
  workflowPesquisaPrecos,
} from "@/lib/data/workflow";
import { organizationCovers } from "@/lib/org/relevance";
import { buildOrgWorkflow, pickWorkflowAssignment } from "@/lib/org/workflow-builder";
import { fadeUp } from "@/lib/motion";

export default function WorkflowsPage() {
  const { mode } = useTenantMode();
  const organization = useOrganization();
  const isGoverno = (organization.orgType ?? mode) === "governo";

  // O workflow de exemplo (pesquisa de preços / funil comercial) só aparece se
  // o organograma tiver aquela área. Caso contrário o workflow é gerado a
  // partir de uma função real do próprio organograma.
  const mockCovered = useMemo(
    () =>
      organizationCovers(
        isGoverno
          ? { area: "Licitações e Contratos", texto: "pesquisa de preços cotação fornecedores contratações" }
          : { area: "Vendas", texto: "leads propostas comerciais clientes funil crm" },
        organization.nodes,
      ),
    [isGoverno, organization.nodes],
  );

  const orgWorkflow = useMemo(() => {
    if (mockCovered) return null;
    const assignment = pickWorkflowAssignment(organization.assignments);
    return assignment ? buildOrgWorkflow(assignment) : null;
  }, [mockCovered, organization.assignments]);

  const steps = orgWorkflow
    ? orgWorkflow.steps
    : isGoverno
      ? workflowPesquisaPrecos
      : workflowLeadParaProposta;
  const title = orgWorkflow
    ? orgWorkflow.titulo
    : isGoverno
      ? "wf-pesquisa-precos"
      : "wf-lead-para-proposta";
  const description = orgWorkflow
    ? orgWorkflow.descricao
    : isGoverno
      ? "Workflow governado com segregação de funções obrigatória — o aprovador nunca pode ser o autor do ato."
      : "Workflow do funil comercial, do enriquecimento do lead até a aprovação da proposta.";
  const refs = orgWorkflow
    ? isGoverno
      ? ["Trilha de auditoria append-only", "Segregação de funções — Acórdão TCU nº 1668/2021"]
      : ["Trilha de auditoria append-only", "Alçada de aprovação vigente"]
    : isGoverno
      ? workflowComplianceRefs
      : workflowComplianceRefsEmpresa;

  return (
    <div>
      <PageHeader eyebrow="Construtor visual" title={title} description={description} />

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
                autor do ato.
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
