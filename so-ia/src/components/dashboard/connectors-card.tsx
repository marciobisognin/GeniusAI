"use client";

import { motion } from "framer-motion";
import { Plug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fadeUp, staggerContainer } from "@/lib/motion";

const connectors = [
  "Google Drive",
  "HubSpot / Pipedrive",
  "Meta Ads",
  "Google Analytics 4",
  "Gmail / Outlook",
  "Slack / Teams / WhatsApp",
];

export function ConnectorsCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="size-4 text-[var(--brand-1)]" />
          Conectores MVP ativos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.ul variants={staggerContainer(0.06)} initial="hidden" animate="show" className="space-y-2">
          {connectors.map((c) => (
            <motion.li
              key={c}
              variants={fadeUp}
              className="flex items-center gap-2.5 rounded-lg border border-border/70 px-3 py-2 text-sm"
            >
              <span className="size-1.5 rounded-full bg-success" />
              {c}
            </motion.li>
          ))}
        </motion.ul>
      </CardContent>
    </Card>
  );
}
