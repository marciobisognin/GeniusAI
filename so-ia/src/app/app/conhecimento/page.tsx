import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function ConhecimentoPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Núcleo de Conhecimento"
        title="Conhecimento citável"
        description="RAG central com citações verificáveis e filtros por permissão em tempo de consulta."
      />
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Em construção — próxima etapa do roadmap de telas.
        </CardContent>
      </Card>
    </div>
  );
}
