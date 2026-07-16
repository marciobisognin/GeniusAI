"use client";

import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsibilityTags } from "@/components/onboarding/responsibility-tags";
import { fadeUp } from "@/lib/motion";
import type { OrgNode } from "@/lib/data/org-chart";

export function OrgNodeForm({
  node,
  index,
  candidates,
  onChange,
  onRemove,
}: {
  node: OrgNode;
  index: number;
  candidates: OrgNode[];
  onChange: (patch: Partial<OrgNode>) => void;
  onRemove: () => void;
}) {
  return (
    <motion.div variants={fadeUp} layout>
      <Card className="p-4 gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-muted-foreground shrink-0 mt-1">
            {index + 1}
          </span>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cargo / função</Label>
              <Input
                value={node.titulo}
                onChange={(e) => onChange({ titulo: e.target.value })}
                placeholder="Ex.: Fiscal de Contrato"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Área / departamento</Label>
              <Input
                value={node.area}
                onChange={(e) => onChange({ area: e.target.value })}
                placeholder="Ex.: Orçamento e Finanças"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Responsabilidades</Label>
              <ResponsibilityTags
                value={node.responsabilidades}
                onChange={(responsabilidades) => onChange({ responsabilidades })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reporta-se a</Label>
              <Select
                value={node.parentId ?? "none"}
                onValueChange={(v) => onChange({ parentId: v === "none" ? null : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Topo do organograma">
                    {(value: string) =>
                      value === "none" || !value
                        ? "Topo do organograma"
                        : candidates.find((c) => c.id === value)?.titulo || "Topo do organograma"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Topo do organograma</SelectItem>
                  {candidates
                    .filter((c) => c.id !== node.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.titulo || "(sem título)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remover cargo"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
