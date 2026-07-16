"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/page-header";
import { ApprovalListItem } from "@/components/approvals/approval-list-item";
import { ApprovalDetailPanel } from "@/components/approvals/approval-detail-panel";
import { useTenantMode } from "@/components/providers/mode-provider";
import { getApprovals } from "@/lib/data/approvals";
import { staggerContainer } from "@/lib/motion";

export default function AprovacoesPage() {
  const { mode } = useTenantMode();
  const items = useMemo(() => getApprovals(mode), [mode]);
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const [decided, setDecided] = useState<Record<string, boolean>>({});

  // Reset selection/decisions when switching tenant mode (adjusted during
  // render, not in an effect — avoids a redundant extra commit).
  const [lastMode, setLastMode] = useState(mode);
  if (mode !== lastMode) {
    setLastMode(mode);
    setSelectedId(items[0]?.id);
    setDecided({});
  }

  const selected = items.find((i) => i.id === selectedId) ?? items[0];
  const pending = items.filter((i) => !decided[i.id]).length;

  return (
    <div>
      <PageHeader
        eyebrow="Human-in-the-loop"
        title="Caixa de Aprovações"
        description={`${pending} itens aguardando revisão humana antes de seguir. Toda decisão é registrada na trilha de auditoria append-only.`}
      />

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
    </div>
  );
}
