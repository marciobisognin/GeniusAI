import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function AuditoriaPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Governança"
        title="Trilha de auditoria append-only"
        description="Todo registro de execução, aprovação e decisão de agente, imutável e rastreável."
      />
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Em construção — próxima etapa do roadmap de telas.
        </CardContent>
      </Card>
    </div>
  );
}
