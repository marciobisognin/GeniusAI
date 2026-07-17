"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Gauge, Loader2, Plus, Sparkles, Warehouse, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  bestBuilderSquad,
  createSquadTemplate,
  loadRepository,
  type SquadTemplate,
} from "@/lib/org/squad-registry";
import type { Squad } from "@/lib/org/squads";

type CreationPhase = "idle" | "ativando" | "criado";

export function SquadRepositoryPanel({ activeSquads }: { activeSquads: Squad[] }) {
  const [repo, setRepo] = useState<SquadTemplate[]>(() => loadRepository());
  const [open, setOpen] = useState(false);
  const [areaDraft, setAreaDraft] = useState("");
  const [phase, setPhase] = useState<CreationPhase>("idle");

  const activeTemplateIds = new Set(activeSquads.map((s) => s.templateId));
  const builder = bestBuilderSquad(repo);

  function handleCreate() {
    const area = areaDraft.trim();
    if (!area) return;
    setPhase("ativando");
    window.setTimeout(() => {
      createSquadTemplate(area, []);
      setRepo(loadRepository());
      setPhase("criado");
      window.setTimeout(() => {
        setPhase("idle");
        setAreaDraft("");
        setOpen(false);
      }, 1400);
    }, 1600);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Warehouse className="size-4 text-[var(--brand-1)]" />
            Repositório de squads
          </CardTitle>
          <Dialog open={open} onOpenChange={(o) => phase === "idle" && setOpen(o)}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <Plus className="size-3.5" />
                  Criar squad
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wrench className="size-4 text-[var(--brand-1)]" />
                  Ferramenta de Criação de Squads
                </DialogTitle>
                <DialogDescription>
                  Um novo squad será desenhado pelo melhor squad do repositório —{" "}
                  <span className="font-medium text-foreground">{builder.nome}</span> (
                  {Math.round(builder.desempenho * 100)}% de desempenho) — e ficará
                  disponível para as próximas montagens de organograma.
                </DialogDescription>
              </DialogHeader>

              <AnimatePresence mode="wait">
                {phase === "idle" && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="squad-area" className="text-xs text-muted-foreground">
                        Área que o squad vai cobrir
                      </Label>
                      <Input
                        id="squad-area"
                        value={areaDraft}
                        onChange={(e) => setAreaDraft(e.target.value)}
                        placeholder="Ex.: Infraestrutura e Obras"
                      />
                    </div>
                    <Button
                      onClick={handleCreate}
                      disabled={areaDraft.trim().length < 2}
                      className="w-full bg-gradient-brand text-white hover:opacity-90 border-0 disabled:opacity-40"
                    >
                      <Sparkles className="size-4" />
                      Acionar {builder.nome}
                    </Button>
                  </motion.div>
                )}

                {phase === "ativando" && (
                  <motion.div
                    key="ativando"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5 rounded-lg border border-[var(--brand-1)]/30 bg-[var(--brand-1)]/[0.06] px-3 py-3 text-sm"
                  >
                    <Loader2 className="size-4 animate-spin text-[var(--brand-1)]" />
                    {builder.nome} ativado — desenhando o novo squad…
                  </motion.div>
                )}

                {phase === "criado" && (
                  <motion.div
                    key="criado"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 px-3 py-3 text-sm text-success"
                  >
                    <CheckCircle2 className="size-4" />
                    Squad criado e registrado no repositório.
                  </motion.div>
                )}
              </AnimatePresence>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-xs text-muted-foreground">
          {repo.length} squad(s) disponíveis. Na montagem do organograma, cada área
          reaproveita um squad daqui — só quando nenhum serve a ferramenta cria um novo.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {repo.map((tpl) => {
          const active = activeTemplateIds.has(tpl.id);
          const isBuilder = tpl.id === builder.id;
          return (
            <div
              key={tpl.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  {tpl.nome}
                  {isBuilder && (
                    <Badge className="bg-gradient-brand text-white border-0 text-[9px] px-1.5">
                      construtor
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">{tpl.descricao}</p>
                {tpl.criadoPor && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    criado por {tpl.criadoPor}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant="outline" className="text-[10px] font-normal">
                  <Gauge className="size-3" /> {Math.round(tpl.desempenho * 100)}%
                </Badge>
                {active && (
                  <Badge variant="outline" className="text-[10px] border-success/30 text-success font-normal">
                    ativo nesta organização
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
