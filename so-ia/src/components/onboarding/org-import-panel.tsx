"use client";

import { useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileUp,
  Loader2,
  Type as TypeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { parseOrgFile, parseOrgPasted, parseOrgText, type ImportResult } from "@/lib/org/import";
import { fadeUp } from "@/lib/motion";
import type { OrgNode } from "@/lib/data/org-chart";

const ACCEPTED = ".json,.csv,.txt,.md,.pdf";

export function OrgImportPanel({
  hasExistingNodes,
  onApply,
}: {
  hasExistingNodes: boolean;
  onApply: (nodes: OrgNode[], mode: "substituir" | "adicionar") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setResult(null);
    setError(null);
  }

  async function handleFile(file: File) {
    reset();
    setBusy(true);
    setSourceLabel(file.name);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") {
        const { extractPdfText } = await import("@/lib/org/pdf-extract");
        const text = await extractPdfText(file);
        if (!text.trim()) {
          setError(
            "Não consegui extrair texto deste PDF — se o organograma estiver em formato de caixas/gráfico, cole o texto (ou digite os cargos) na opção abaixo.",
          );
          return;
        }
        setResult(parseOrgText(text));
      } else {
        const text = await file.text();
        setResult(parseOrgFile(file.name, text));
      }
    } catch {
      setError("Não foi possível ler este arquivo. Verifique o formato ou cole o texto diretamente.");
    } finally {
      setBusy(false);
    }
  }

  function handlePasteAnalyze() {
    reset();
    setSourceLabel("texto colado");
    setResult(parseOrgPasted(pasted));
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function apply(mode: "substituir" | "adicionar") {
    if (!result || result.nodes.length === 0) return;
    onApply(result.nodes, mode);
    setResult(null);
    setSourceLabel(null);
    setPasted("");
    setShowPaste(false);
  }

  return (
    <Card className="border-dashed">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white">
            <FileUp className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-medium">Carregar organograma (opcional)</p>
            <p className="text-xs text-muted-foreground">
              Envie um arquivo com os cargos, áreas e responsabilidades — o
              SO-IA pré-preenche o organograma abaixo para você revisar,
              ajustar e completar manualmente o que faltar.
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border/70 px-4 py-6 text-center transition-colors hover:border-[var(--brand-1)]/50 hover:bg-[var(--brand-1)]/[0.03]"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin text-[var(--brand-1)]" />
          ) : (
            <FileUp className="size-5 text-muted-foreground" />
          )}
          <p className="text-sm">
            Arraste um arquivo aqui ou{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-[var(--brand-1)] underline underline-offset-2"
            >
              selecione no computador
            </button>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Formatos aceitos: .json, .csv, .txt, .md, .pdf (texto) —{" "}
            <a href="/templates/organograma-exemplo.json" download className="underline underline-offset-2 hover:text-foreground">
              modelo .json
            </a>
            {" · "}
            <a href="/templates/organograma-exemplo.csv" download className="underline underline-offset-2 hover:text-foreground">
              modelo .csv
            </a>
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowPaste((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <TypeIcon className="size-3.5" />
          ou cole/digite o texto do organograma
          <ChevronDown className={`size-3.5 transition-transform ${showPaste ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence initial={false}>
          {showPaste && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-1">
                <Textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder={
                    "Ex.:\nMinistro de Estado (Gabinete): definir a politica externa\n  Secretário-Geral (Secretaria-Geral): coordenar a execucao da politica externa\n    Fiscal de Contrato (Orçamento e Finanças): conferir nota fiscal contra empenho"
                  }
                  className="min-h-32 font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePasteAnalyze}
                  disabled={pasted.trim().length === 0}
                >
                  Analisar texto
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-2.5">
            {result.nodes.length > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-xs text-success">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {result.nodes.length} cargo(s) detectado(s) em {sourceLabel}. Revise
                  abaixo antes de montar o sistema.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Nenhum cargo foi reconhecido — preencha manualmente abaixo.
              </div>
            )}

            {result.warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-2.5 text-xs text-muted-foreground"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                {w}
              </div>
            ))}

            {result.nodes.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {hasExistingNodes ? (
                  <>
                    <Button size="sm" onClick={() => apply("adicionar")} className="bg-gradient-brand text-white hover:opacity-90 border-0">
                      Adicionar aos cargos existentes
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => apply("substituir")}>
                      Substituir organograma atual
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => apply("substituir")} className="bg-gradient-brand text-white hover:opacity-90 border-0">
                    Aplicar ao organograma
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
