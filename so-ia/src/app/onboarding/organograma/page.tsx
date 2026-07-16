"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrgNodeForm } from "@/components/onboarding/org-node-form";
import { OrgTreePreview } from "@/components/onboarding/org-tree-preview";
import { useOrganization } from "@/components/providers/organization-provider";
import { templateEmpresa, templateGoverno } from "@/lib/org/templates";
import { fadeUp, staggerContainer } from "@/lib/motion";

export default function OnboardingOrganogramaPage() {
  const router = useRouter();
  const organization = useOrganization();

  useEffect(() => {
    if (organization.hydrated && !organization.orgType) {
      router.replace("/onboarding/tipo");
    }
  }, [organization.hydrated, organization.orgType, router]);

  const validNodes = organization.nodes.filter((n) => n.titulo.trim().length > 0);
  const canAssemble = validNodes.length > 0;

  function loadTemplate() {
    const template = organization.orgType === "governo" ? templateGoverno : templateEmpresa;
    organization.setNodes(structuredClone(template));
  }

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show">
      <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-wider text-gradient-brand mb-2">
        Passo 2 de 3
      </motion.p>
      <motion.h1 variants={fadeUp} className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Monte o organograma de {organization.orgName || "sua organização"}
      </motion.h1>
      <motion.p variants={fadeUp} className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Cadastre os cargos/funções, a área de cada um, suas responsabilidades e a
        quem cada um se reporta. É a partir disso que o SO-IA vai montar o
        sistema de agentes — nada é pré-carregado.
      </motion.p>

      <div className="grid gap-6 lg:grid-cols-3 mt-8">
        <div className="lg:col-span-2 space-y-3">
          <AnimatePresence initial={false}>
            {organization.nodes.map((node, i) => (
              <OrgNodeForm
                key={node.id}
                node={node}
                index={i}
                candidates={organization.nodes}
                onChange={(patch) => organization.updateNode(node.id, patch)}
                onRemove={() => organization.removeNode(node.id)}
              />
            ))}
          </AnimatePresence>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => organization.addNode()}>
              <Plus className="size-4" />
              Adicionar cargo
            </Button>
            {organization.nodes.length === 0 && (
              <Button variant="ghost" onClick={loadTemplate} className="text-muted-foreground">
                <Sparkles className="size-4" />
                Carregar organograma de exemplo (editável)
              </Button>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-6 h-fit space-y-4">
          <Card>
            <CardContent className="pt-6">
              <OrgTreePreview nodes={organization.nodes} />
            </CardContent>
          </Card>
          <Button
            disabled={!canAssemble}
            onClick={() => router.push("/onboarding/montagem")}
            className="w-full bg-gradient-brand text-white hover:opacity-90 border-0 disabled:opacity-40"
          >
            Montar o sistema
            <ArrowRight className="size-4" />
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            {validNodes.length} função(ões) cadastrada(s)
          </p>
        </div>
      </div>
    </motion.div>
  );
}
