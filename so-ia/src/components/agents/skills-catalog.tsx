"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Search, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listSkills } from "@/lib/org/skills-registry";
import { staggerContainer, fadeUp } from "@/lib/motion";
import type { AgentAssignment } from "@/lib/org/matching";

export function SkillsCatalog({ assignments }: { assignments: AgentAssignment[] }) {
  const [query, setQuery] = useState("");

  const usedByAll = useMemo(() => {
    const usedIds = new Set(assignments.flatMap((a) => a.agent.skills));
    return listSkills().filter((s) => usedIds.has(s.id));
  }, [assignments]);

  const agentsBySkill = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignments) {
      for (const skill of a.agent.skills) {
        map.set(skill, [...(map.get(skill) ?? []), a.agent.nome]);
      }
    }
    return map;
  }, [assignments]);

  const filtered = usedByAll.filter(
    (s) =>
      query.trim().length === 0 ||
      s.id.includes(query.toLowerCase()) ||
      s.descricao.toLowerCase().includes(query.toLowerCase()),
  );

  const created = usedByAll.filter((s) => s.origem === "gerada").length;

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        {usedByAll.length} skill(s) em uso no seu organograma — {usedByAll.length - created} do
        catálogo institucional e {created} geradas sob medida junto com os agentes.
      </p>

      <div className="relative w-full sm:max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar skill…"
          className="pl-8"
        />
      </div>

      <motion.div
        variants={staggerContainer(0.04)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {filtered.map((skill) => (
          <motion.div key={skill.id} variants={fadeUp}>
            <Card className="p-4 gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-xs font-medium">{skill.id}</p>
                {skill.origem === "catalogo" ? (
                  <Badge variant="outline" className="text-[10px] border-success/30 text-success font-normal shrink-0">
                    <CheckCircle2 className="size-3" /> Catálogo
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-[var(--brand-1)]/30 text-[var(--brand-1)] font-normal shrink-0"
                  >
                    <Sparkles className="size-3" /> Gerada
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{skill.descricao}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {(agentsBySkill.get(skill.id) ?? []).map((nome) => (
                  <Badge key={nome} variant="secondary" className="text-[10px] font-normal">
                    {nome}
                  </Badge>
                ))}
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
