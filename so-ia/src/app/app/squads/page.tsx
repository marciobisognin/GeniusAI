"use client";

import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/page-header";
import { SquadCard } from "@/components/squads/squad-card";
import { useOrganization } from "@/components/providers/organization-provider";
import { staggerContainer, fadeUp } from "@/lib/motion";

export default function SquadsPage() {
  const organization = useOrganization();

  return (
    <div>
      <PageHeader
        eyebrow="Organização"
        title="Squads"
        description="Um squad por área do organograma — os agentes daquela área, um líder (a função mais próxima do topo) e o conjunto de skills que o squad cobre. Dá para executar o squad inteiro de uma vez."
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        {organization.squads.map((squad) => (
          <motion.div key={squad.id} variants={fadeUp}>
            <SquadCard squad={squad} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
