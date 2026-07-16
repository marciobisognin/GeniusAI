"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Landmark,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LogoMark } from "@/components/layout/logo-mark";
import { ModeSwitch } from "@/components/layout/mode-switch";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { KnowledgeGraph } from "@/components/landing/knowledge-graph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTenantMode } from "@/components/providers/mode-provider";
import { areasByMode, tenantLabel } from "@/lib/nav-config";
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
  const isGoverno = mode === "governo";

  return (
    <div className="relative flex min-h-screen flex-col noise-bg overflow-hidden">
      <header className="flex items-center gap-2.5 px-6 py-5 lg:px-10">
        <LogoMark />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">SO-IA</p>
          <p className="text-[11px] text-muted-foreground">Sistema Operacional de IA</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ModeSwitch />
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
              Um núcleo de conhecimento central com citações verificáveis,
              níveis de autonomia A0–A5 e trilha de auditoria append-only —
              servindo empresas privadas e órgãos públicos com o mesmo motor,
              em perfis distintos.
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
                <div className="flex items-center gap-2 text-sm font-medium">
                  {isGoverno ? (
                    <Landmark className="size-4 text-[var(--brand-1)]" />
                  ) : (
                    <Building2 className="size-4 text-[var(--brand-1)]" />
                  )}
                  Entrar · {tenantLabel[mode].name}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="org" className="text-xs text-muted-foreground">
                      Organização
                    </Label>
                    <Input id="org" readOnly value={tenantLabel[mode].org} className="bg-background/60" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs text-muted-foreground">
                      E-mail institucional
                    </Label>
                    <Input
                      id="email"
                      placeholder={isGoverno ? "servidor@iffar.edu.br" : "voce@empresa.com.br"}
                      className="bg-background/60"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => router.push("/app/dashboard")}
                  className="w-full bg-gradient-brand text-white hover:opacity-90 border-0"
                >
                  Entrar no Centro de Comando
                  <ArrowRight className="size-4" />
                </Button>

                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5" />
                  SSO gov.br disponível no Modo Governo · dados sensíveis com
                  residência on-premise.
                </p>
              </div>
            </motion.div>
          </motion.div>

          <div className="hidden lg:block">
            <KnowledgeGraph areas={areasByMode[mode]} key={mode} />
          </div>
        </div>
      </main>
    </div>
  );
}
