import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import type { notaFiscal as NotaFiscalType } from "@/lib/data/case-atesto";

export function NfSummaryCard({ nf }: { nf: typeof NotaFiscalType }) {
  const rows: [string, string][] = [
    ["Número", nf.numero],
    ["Fornecedor", nf.fornecedor],
    ["CNPJ", nf.cnpjFornecedor],
    ["Emissão", nf.emissao],
    ["Empenho", nf.empenho],
    ["Valor total", nf.valorTotal],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="size-4 text-[var(--brand-1)]" />
          Nota Fiscal extraída (IDP)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 pt-3 border-t border-border/70">
          <p className="text-xs text-muted-foreground">Chave de acesso</p>
          <p className="font-mono text-[11px] mt-0.5 break-all text-muted-foreground">{nf.chave}</p>
        </div>
      </CardContent>
    </Card>
  );
}
