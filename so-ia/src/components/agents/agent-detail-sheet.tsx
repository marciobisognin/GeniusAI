"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AutonomyBadge } from "@/components/agents/autonomy-badge";
import { skillDescriptions } from "@/lib/data/skills";
import type { Agent } from "@/lib/data/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plug, ShieldCheck, Sparkles } from "lucide-react";

export function AgentDetailSheet({
  agent,
  onOpenChange,
}: {
  agent: Agent | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!agent} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full">
        {agent && (
          <ScrollArea className="h-full">
            <SheetHeader>
              <p className="text-xs text-muted-foreground">{agent.area}</p>
              <SheetTitle className="text-lg">{agent.nome}</SheetTitle>
              <SheetDescription>{agent.descricao}</SheetDescription>
              <div className="flex items-center gap-2 pt-2">
                <AutonomyBadge level={agent.autonomia} showLabel />
              </div>
            </SheetHeader>

            <div className="px-4 pb-6 space-y-5">
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> Skills (SKILL.md)
                </p>
                <div className="space-y-2">
                  {agent.skills.map((skill) => (
                    <div key={skill} className="rounded-lg border border-border/70 px-3 py-2">
                      <p className="font-mono text-xs font-medium">{skill}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {skillDescriptions[skill] ?? "Skill reutilizável do catálogo institucional."}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Plug className="size-3.5" /> Conectores (MCP servers)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.connectors.map((c) => (
                    <Badge key={c} variant="outline" className="font-mono text-[11px]">
                      {c}
                    </Badge>
                  ))}
                </div>
              </section>

              <Separator />

              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" /> Governança
                </p>
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modelo padrão</span>
                    <span className="font-mono text-xs">{agent.modelPolicy.default}</span>
                  </div>
                  {agent.modelPolicy.sensitive && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dados sensíveis</span>
                      <span className="font-mono text-xs">{agent.modelPolicy.sensitive}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auditoria</span>
                    <span className="text-xs">append-only</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Execuções/mês</span>
                    <span className="text-xs">{agent.execucoesMes.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de aprovação humana</span>
                    <span className="text-xs">{Math.round(agent.taxaAprovacao * 100)}%</span>
                  </div>
                </div>
              </section>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
