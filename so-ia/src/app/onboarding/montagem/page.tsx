"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Boxes, CheckCircle2, Sparkles, UsersRound, Warehouse, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssemblyRow } from "@/components/onboarding/assembly-row";
import { useOrganization } from "@/components/providers/organization-provider";
import { assembleOrganization } from "@/lib/org/matching";
import { buildSquads } from "@/lib/org/squads";
import { fadeUp } from "@/lib/motion";

export default function OnboardingMontagemPage() {
  const router = useRouter();
  const organization = useOrganization();

  const assignments = useMemo(
    () => assembleOrganization(organization.nodes),
    [organization.nodes],
  );

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"scanning" | "resolved">("scanning");

  useEffect(() => {
    if (organization.hydrated && (!organization.orgType || assignments.length === 0)) {
      router.replace("/onboarding/organograma");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization.hydrated, organization.orgType]);

  useEffect(() => {
    if (index >= assignments.length) return;
    // Drives the scanning -> resolved reveal animation on a timer, not in
    // response to a prop/state sync — the recommended alternative (deriving
    // during render) doesn't apply to timer-based sequencing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("scanning");
    const t1 = setTimeout(() => setPhase("resolved"), 600);
    const t2 = setTimeout(() => setIndex((i) => i + 1), 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [index, assignments.length]);

  const done = index >= assignments.length;
  const progress = assignments.length > 0 ? Math.min(index, assignments.length) / assignments.length : 0;
  const matched = assignments.slice(0, index).filter((a) => a.origem === "catalogo").length;
  const created = assignments.slice(0, index).filter((a) => a.origem === "gerado").length;

  // Dry-run preview of squad formation — nothing is persisted here; the real
  // registration in the repository happens inside assemble().
  const squadPreview = useMemo(
    () => (done && assignments.length > 0 ? buildSquads(assignments, { dryRun: true }) : []),
    [done, assignments],
  );

  function handleEnter() {
    organization.assemble();
    router.push("/app/organograma");
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gradient-brand mb-2">Passo 3 de 3</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {done ? "Sistema montado" : "Montando o sistema…"}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {done
          ? "Cada função do organograma recebeu um agente — do catálogo institucional ou criado sob medida agora."
          : "Analisando cada função do organograma e buscando um agente compatível no catálogo institucional."}
      </p>

      <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full bg-gradient-brand"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mt-6">
        <div className="lg:col-span-2 space-y-2.5">
          {assignments.slice(0, index + 1).map((assignment, i) => (
            <AssemblyRow
              key={assignment.nodeId}
              assignment={assignment}
              phase={i === index && !done ? phase : "resolved"}
            />
          ))}

          {done && squadPreview.length > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UsersRound className="size-4 text-[var(--brand-1)]" />
                    Formação de squads
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Para cada área, o sistema procura um squad no repositório
                    institucional — só cria um novo quando nenhum serve.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {squadPreview.map((squad) => (
                    <div
                      key={squad.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{squad.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {squad.area} · {squad.membros.length} agente(s)
                        </p>
                      </div>
                      {squad.origem === "repositorio" ? (
                        <span className="flex items-center gap-1.5 text-xs text-success shrink-0">
                          <Warehouse className="size-3.5" /> Reaproveitado do repositório
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-[var(--brand-1)] shrink-0 text-right">
                          <Wrench className="size-3.5" /> Criado agora
                          {squad.criadoPor ? ` — por ${squad.criadoPor}` : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Boxes className="size-3.5" /> Funções processadas
                </span>
                <span className="font-medium tabular-nums">
                  {Math.min(index, assignments.length)}/{assignments.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-success" /> Do catálogo
                </span>
                <span className="font-medium tabular-nums">{matched}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="size-3.5 text-[var(--brand-1)]" /> Criados agora
                </span>
                <span className="font-medium tabular-nums">{created}</span>
              </div>
            </CardContent>
          </Card>

          {done && (
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <Button
                onClick={handleEnter}
                className="w-full bg-gradient-brand text-white hover:opacity-90 border-0"
              >
                Ver meu organograma montado
                <ArrowRight className="size-4" />
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
