import { Quote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Citation } from "@/lib/data/types";

export function CitationsList({ citations }: { citations: Citation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Quote className="size-4 text-[var(--brand-1)]" />
          Citações verificáveis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {citations.map((c, i) => (
          <div key={i} className="rounded-lg border border-border/70 px-3 py-2 text-xs">
            <p className="font-medium">{c.fonte}</p>
            <p className="text-muted-foreground">{c.referencia}</p>
            <p className="text-muted-foreground/70 mt-0.5">acessado em {c.acessadoEm}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
