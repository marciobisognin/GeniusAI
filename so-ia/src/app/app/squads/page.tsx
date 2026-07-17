"use client";

import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/page-header";
import { SquadCard } from "@/components/squads/squad-card";
import { SquadRepositoryPanel } from "@/components/squads/squad-repository-panel";
import { useOrganization } from "@/components/providers/organization-provider";
import { staggerContainer, fadeUp } from "@/lib/motion";

export default function SquadsPage() {
  const organization = useOrganization();
  const reused = organization.squads.filter((s) => s.origem === "repositorio").length;
  const created = organization.squads.filter((s) => s.origem === "criado").length;

  return (
    <div>
      <PageHeader
        eyebrow="Organização"
        title="Squads"
        description={`Um squad por área do organograma. Na montagem, ${reused} foram reaproveitados do repositório institucional e ${created} criado(s) na hora pela Ferramenta de Criação de Squads.`}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          animate="show"
          className="xl:col-span-2 grid grid-cols-1 gap-4 lg:grid-cols-2 content-start"
        >
          {organization.squads.map((squad) => (
            <motion.div key={squad.id} variants={fadeUp}>
              <SquadCard squad={squad} />
            </motion.div>
          ))}
        </motion.div>

        <div>
          <SquadRepositoryPanel activeSquads={organization.squads} />
        </div>
      </div>
    </div>
  );
}
