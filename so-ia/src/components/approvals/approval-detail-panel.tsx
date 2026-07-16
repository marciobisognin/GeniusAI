"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Quote, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutonomyBadge } from "@/components/agents/autonomy-badge";
import { RiskBadge } from "@/components/approvals/risk-badge";
import { fadeIn } from "@/lib/motion";
import type { ApprovalItem } from "@/lib/data/types";

export function ApprovalDetailPanel({
  item,
  approved,
  onApprove,
  onReject,
}: {
  item: ApprovalItem;
  approved: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={item.id}
        variants={fadeIn}
        initial="hidden"
        animate="show"
        exit="hidden"
      >
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="secondary" className="font-normal">{item.tipo}</Badge>
                  <AutonomyBadge level={item.autonomia} showLabel />
                  <RiskBadge risco={item.risco} />
                </div>
                <CardTitle className="text-lg">{item.titulo}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.agente} · {item.area} · criado em {item.criadoEm}
                </p>
                {item.id === "apr-nf-4471" && (
                  <Link
                    href="/app/aprovacoes/atesto-nf"
                    className="inline-flex items-center gap-1 text-xs text-[var(--brand-1)] hover:underline mt-2"
                  >
                    Ver caso completo (extração, conferência, auditoria)
                    <ArrowUpRight className="size-3" />
                  </Link>
                )}
              </div>
              {item.valor && (
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-semibold">{item.valor}</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-relaxed">{item.resumo}</p>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Quote className="size-3.5" /> Citações verificáveis
              </p>
              <div className="space-y-2">
                {item.citations.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border/70 px-3 py-2 text-xs">
                    <p className="font-medium">{c.fonte}</p>
                    <p className="text-muted-foreground">{c.referencia}</p>
                    <p className="text-muted-foreground/70 mt-0.5">acessado em {c.acessadoEm}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              SLA: {item.sla} · toda decisão fica registrada na trilha de auditoria append-only.
            </p>

            {approved ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-3 py-2.5 text-sm text-success">
                <CheckCircle2 className="size-4" />
                Aprovado — registrado na trilha de auditoria.
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={onApprove}
                  className="bg-gradient-brand text-white hover:opacity-90 border-0 flex-1"
                >
                  <CheckCircle2 className="size-4" />
                  Aprovar
                </Button>
                <Button onClick={onReject} variant="outline" className="flex-1">
                  <XCircle className="size-4" />
                  Rejeitar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
