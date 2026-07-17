"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ApprovalListItem } from "@/components/approvals/approval-list-item";
import { ApprovalDetailPanel } from "@/components/approvals/approval-detail-panel";
import { Card, CardContent } from "@/components/ui/card";
import { useOrganization } from "@/components/providers/organization-provider";
import { getApprovalsForOrganization } from "@/lib/data/approvals";
import { staggerContainer } from "@/lib/motion";

export default function AprovacoesPage() {
  const organization = useOrganization();
  const items = useMemo(
    () => getApprovalsForOrganization(organization.orgType, organization.nodes),
    [organization.orgType, organization.nodes],
  );
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const [decided, setDecided] = useState<Record<string, boolean>>({});

  const selected = items.find((i) => i.id === selectedId) ?? items[0];
  const pending = items.filter((i) => !decided[i.id]).length;

  return (
    <div>
      <PageHeader
        eyebrow="Human-in-the-loop"
        title="Caixa de Aprovações"
        description={
          items.length > 0
            ? `${pending} itens aguardando revisão humana antes de seguir. Só chegam aqui pendências das áreas do seu organograma — toda decisão é registrada na trilha de auditoria append-only.`
            : "Só chegam aqui pendências das áreas do seu organograma."
        }
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Inbox className="size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">Nenhuma pendência para as áreas do seu organograma</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Itens aparecem aqui quando um agente de uma área cadastrada no
              organograma conclui um trabalho que exige revisão humana. Áreas que
              não existem no organograma não geram pendências — nem ferramentas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <motion.div
            variants={staggerContainer(0.06)}
            initial="hidden"
            animate="show"
            className="lg:col-span-2 space-y-2.5"
          >
            {items.map((item) => (
              <ApprovalListItem
                key={item.id}
                item={item}
                active={item.id === selected?.id}
                approved={!!decided[item.id]}
                onClick={() => setSelectedId(item.id)}
              />
            ))}
          </motion.div>

          <div className="lg:col-span-3">
            {selected && (
              <ApprovalDetailPanel
                item={selected}
                approved={!!decided[selected.id]}
                onApprove={() => setDecided((d) => ({ ...d, [selected.id]: true }))}
                onReject={() => setDecided((d) => ({ ...d, [selected.id]: true }))}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
