"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Landmark, Network, ShieldCheck, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/layout/logo-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { KnowledgeGraph } from "@/components/landing/knowledge-graph";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenantMode } from "@/components/providers/mode-provider";
import { useOrganization } from "@/components/providers/organization-provider";
import { areasByMode, areasFromNodes } from "@/lib/nav-config";
import { fadeUp, staggerContainer } from "@/lib/motion";

const featurePills = [
  "Multi-tenant",
  "RAG com citações",
  "Autonomia A0–A5",
  "Auditoria append-only",
  "LGPD · Lei 14.133/2021",
];

export default function LandingPage() {
  const router = useRouter();
  const { mode } = useTenantMode();
  const organization = useOrganization();
  const ready = organization.hydrated && organization.status === "ready";
  const graphAreas = ready ? areasFromNodes(organization.nodes) : areasByMode[mode];

  return (
    <div className="relative flex min-h-screen flex-col noise-bg overflow-hidden">
      <header className="flex items-center gap-2.5 px-6 py-5 lg:px-10">
        <LogoMark />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">SO-IA</p>
          <p className="text-[11px] text-muted-foreground">Sistema Operacional de IA</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 pb-16 pt-6 lg:px-10">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <motion.div
            variants={staggerContainer(0.08)}
            initial="hidden"
            animate="show"
          >
            <motion.p
              variants={fadeUp}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-5"
            >
              <Sparkles className="size-3.5 text-[var(--brand-1)]" />
              Agentes governados · conhecimento citável · autonomia auditável
            </motion.p>

            <motion.h1
              variants={fadeUp}
              className="text-4xl font-semibold tracking-tight leading-[1.1] sm:text-5xl"
            >
              O sistema operacional de{" "}
              <span className="text-gradient-brand">agentes de IA</span> para
              empresas e o setor público brasileiro.
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-5 max-w-xl text-muted-foreground">
              Nada vem pré-montado. Você descreve o organograma da sua
              organização — cargos, áreas e responsabilidades — e o SO-IA monta
              o sistema: busca um agente para cada função no catálogo
              institucional ou cria um novo sob medida.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-6 flex flex-wrap gap-2">
              {featurePills.map((pill) => (
                <Badge key={pill} variant="secondary" className="font-normal">
                  {pill}
                </Badge>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} className="mt-10 max-w-sm">
              <div className="glass-panel rounded-2xl p-6 space-y-5">
                {ready ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {mode === "governo" ? (
                        <Landmark className="size-4 text-[var(--brand-1)]" />
                      ) : (
                        <Building2 className="size-4 text-[var(--brand-1)]" />
                      )}
                      Bem-vindo(a) de volta
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      Sistema já montado para{" "}
                      <span className="text-foreground font-medium">{organization.orgName}</span>
                      {" "}— {organization.assignments.length} função(ões) com agente atribuído.
                    </p>
                    <Button
                      onClick={() => router.push("/app/dashboard")}
                      className="w-full bg-gradient-brand text-white hover:opacity-90 border-0"
                    >
                      Entrar no Centro de Comando
                      <ArrowRight className="size-4" />
                    </Button>
                    <button
                      onClick={() => router.push("/onboarding/tipo")}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      Configurar uma nova organização
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Network className="size-4 text-[var(--brand-1)]" />
                      Nenhum sistema pré-carregado
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Antes de tudo, conte o organograma da sua empresa ou órgão
                      público e o que cada função faz — é a partir disso que o
                      sistema é montado.
                    </p>
                    <Button
                      onClick={() => router.push("/onboarding/tipo")}
                      className="w-full bg-gradient-brand text-white hover:opacity-90 border-0"
                    >
                      Começar configuração
                      <ArrowRight className="size-4" />
                    </Button>
                  </>
                )}

                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5" />
                  SSO gov.br disponível para órgãos públicos · dados sensíveis
                  com residência on-premise.
                </p>
              </div>
            </motion.div>
          </motion.div>

          <div className="hidden lg:block">
            <KnowledgeGraph areas={graphAreas} key={ready ? organization.orgName : mode} />
          </div>
        </div>
      </main>
    </div>
  );
}
