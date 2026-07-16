"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { KpiCard as KpiCardData } from "@/lib/data/types";

const trendConfig = {
  up: { icon: ArrowUp, className: "text-success" },
  down: { icon: ArrowDown, className: "text-success" },
  flat: { icon: ArrowRight, className: "text-muted-foreground" },
};

export function KpiCard({ kpi }: { kpi: KpiCardData }) {
  const trend = trendConfig[kpi.trend];
  const TrendIcon = trend.icon;

  return (
    <motion.div variants={fadeUp}>
      <Card className="relative overflow-hidden p-5 gap-2 hover:glow-ring transition-shadow duration-300">
        <div className="absolute -right-6 -top-10 size-32 rounded-full bg-gradient-brand opacity-[0.08] blur-2xl" />
        <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
        <div className="flex items-baseline gap-2">
          <AnimatedNumber value={kpi.value} className="text-3xl font-semibold tracking-tight" />
        </div>
        <div className="flex items-center gap-1 text-xs">
          <TrendIcon className={cn("size-3", trend.className)} />
          <span className={cn("font-medium", trend.className)}>{kpi.delta}</span>
          {kpi.hint && <span className="text-muted-foreground">· {kpi.hint}</span>}
        </div>
      </Card>
    </motion.div>
  );
}
