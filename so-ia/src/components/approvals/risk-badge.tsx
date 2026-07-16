import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles = {
  baixo: "bg-success/12 text-success border-success/25",
  medio: "bg-warning/15 text-warning border-warning/30",
  alto: "bg-destructive/15 text-destructive border-destructive/30",
};

const labels = { baixo: "Risco baixo", medio: "Risco médio", alto: "Risco alto" };

export function RiskBadge({ risco }: { risco: keyof typeof styles }) {
  return (
    <Badge variant="outline" className={cn("font-normal", styles[risco])}>
      {labels[risco]}
    </Badge>
  );
}
