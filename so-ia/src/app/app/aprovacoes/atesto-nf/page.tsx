"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { NfSummaryCard } from "@/components/case/nf-summary-card";
import { ConferenciaTable } from "@/components/case/conferencia-table";
import { CitationsList } from "@/components/case/citations-list";
import { AuditTrail } from "@/components/case/audit-trail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  auditTrailAtesto,
  citationsAtesto,
  itensConferencia,
  notaFiscal,
} from "@/lib/data/case-atesto";

export default function AtestoNfCasePage() {
  const [decided, setDecided] = useState(false);

  return (
    <div>
      <Link
        href="/app/aprovacoes"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para Caixa de Aprovações
      </Link>

      <PageHeader
        eyebrow="Caso demonstrador · §9.1"
        title={`Atesto de Nota Fiscal — NF ${notaFiscal.numero}`}
        description="Agente prepara o atesto; o ato de atestar permanece de competência humana — nunca automático."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <NfSummaryCard nf={notaFiscal} />
          <ConferenciaTable itens={itensConferencia} />

          <Card>
            <CardContent className="pt-6">
              {decided ? (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-3 py-2.5 text-sm text-success">
                  <CheckCircle2 className="size-4" />
                  Atesto confirmado pelo fiscal — registrado na trilha de auditoria.
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    [HUMANO] Fiscal revisa a minuta preparada e{" "}
                    <span className="font-medium text-foreground">atesta</span> — ato
                    vinculado, nunca automático.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      onClick={() => setDecided(true)}
                      className="bg-gradient-brand text-white hover:opacity-90 border-0"
                    >
                      <CheckCircle2 className="size-4" />
                      Confirmar atesto
                    </Button>
                    <Button variant="outline">
                      <XCircle className="size-4" />
                      Devolver
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <CitationsList citations={citationsAtesto} />
          <AuditTrail events={auditTrailAtesto} />
        </div>
      </div>
    </div>
  );
}
