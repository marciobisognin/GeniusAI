import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AutonomyLevel } from "@/lib/data/types";

const styles: Record<AutonomyLevel, string> = {
  A0: "bg-muted text-muted-foreground border-transparent",
  A1: "bg-[var(--brand-2)]/12 text-[var(--brand-2)] border-[var(--brand-2)]/25",
  A2: "bg-[var(--brand-1)]/14 text-[var(--brand-1)] border-[var(--brand-1)]/28",
  A3: "bg-warning/15 text-warning border-warning/30",
  A4: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  A5: "bg-destructive/15 text-destructive border-destructive/30",
};

const labels: Record<AutonomyLevel, string> = {
  A0: "Observador",
  A1: "Recomendador",
  A2: "Preparador",
  A3: "Executor governado",
  A4: "Autônomo limitado",
  A5: "Autonomia ampliada",
};

export function AutonomyBadge({
  level,
  showLabel = false,
  className,
}: {
  level: AutonomyLevel;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium tabular-nums", styles[level], className)}
    >
      {level}
      {showLabel && <span className="ml-1 font-normal opacity-80">· {labels[level]}</span>}
    </Badge>
  );
}
