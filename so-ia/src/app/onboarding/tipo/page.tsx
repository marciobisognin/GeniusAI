"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/components/providers/organization-provider";
import { useTenantMode, type TenantMode } from "@/components/providers/mode-provider";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

const options: {
  type: TenantMode;
  title: string;
  description: string;
  icon: typeof Building2;
}[] = [
  {
    type: "empresa",
    title: "Empresa privada",
    description: "De 20 a 500 colaboradores — vendas, marketing, operações, back office…",
    icon: Building2,
  },
  {
    type: "governo",
    title: "Órgão público",
    description: "Institutos federais, autarquias, prefeituras — licitações, orçamento, gestão de pessoas…",
    icon: Landmark,
  },
];

export default function OnboardingTipoPage() {
  const router = useRouter();
  const organization = useOrganization();
  const { setMode } = useTenantMode();
  const [selected, setSelected] = useState<TenantMode | null>(organization.orgType);
  const [name, setName] = useState(organization.orgName);

  const canContinue = selected !== null && name.trim().length > 1;

  function handleContinue() {
    if (!selected) return;
    organization.setOrgType(selected);
    organization.setOrgName(name.trim());
    setMode(selected);
    router.push("/onboarding/organograma");
  }

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show">
      <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-wider text-gradient-brand mb-2">
        Passo 1 de 3
      </motion.p>
      <motion.h1 variants={fadeUp} className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Antes de tudo, conte sobre a sua organização
      </motion.h1>
      <motion.p variants={fadeUp} className="mt-2 max-w-xl text-sm text-muted-foreground">
        Nada vem pré-montado. O SO-IA primeiro entende quem você é e como sua
        organização funciona — só depois monta o sistema de agentes.
      </motion.p>

      <motion.div variants={fadeUp} className="grid gap-4 mt-8 sm:grid-cols-2">
        {options.map((opt) => {
          const active = selected === opt.type;
          return (
            <Card
              key={opt.type}
              onClick={() => setSelected(opt.type)}
              className={cn(
                "cursor-pointer p-5 gap-3 transition-all duration-200 hover:-translate-y-0.5",
                active && "border-[var(--brand-1)]/60 glow-ring",
              )}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl border",
                  active ? "border-transparent bg-gradient-brand text-white" : "border-border text-muted-foreground",
                )}
              >
                <opt.icon className="size-4.5" />
              </span>
              <h3 className="font-medium">{opt.title}</h3>
              <p className="text-sm text-muted-foreground">{opt.description}</p>
            </Card>
          );
        })}
      </motion.div>

      <motion.div variants={fadeUp} className="mt-6 max-w-sm space-y-1.5">
        <Label htmlFor="org-name" className="text-xs text-muted-foreground">
          Nome da organização
        </Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={selected === "governo" ? "Instituto Federal Farroupilha — Campus FW" : "Acme Soluções Ltda."}
        />
      </motion.div>

      <motion.div variants={fadeUp} className="mt-8">
        <Button
          disabled={!canContinue}
          onClick={handleContinue}
          className="bg-gradient-brand text-white hover:opacity-90 border-0 disabled:opacity-40"
        >
          Continuar para o organograma
          <ArrowRight className="size-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
