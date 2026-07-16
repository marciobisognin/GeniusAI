"use client";

import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/motion";
import type { AreaNavItem } from "@/lib/nav-config";

const SIZE = 460;
const CENTER = SIZE / 2;
const RADIUS = 175;

function computeNodes(areas: AreaNavItem[]) {
  const n = areas.length;
  return areas.map((area, i) => {
    const angleDeg = (360 / n) * i - 90;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      ...area,
      x: Number((CENTER + Math.cos(rad) * RADIUS).toFixed(3)),
      y: Number((CENTER + Math.sin(rad) * RADIUS).toFixed(3)),
    };
  });
}

export function KnowledgeGraph({ areas }: { areas: AreaNavItem[] }) {
  const nodes = computeNodes(areas);

  return (
    <div
      className="relative mx-auto"
      style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="graph-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-1)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--brand-2)" stopOpacity={0.15} />
          </linearGradient>
        </defs>
        {nodes.map((node, i) => (
          <motion.line
            key={node.label}
            x1={CENTER}
            y1={CENTER}
            x2={node.x}
            y2={node.y}
            stroke="url(#graph-line)"
            strokeWidth={1.2}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </svg>

      <motion.div
        variants={staggerContainer(0.07, 0.5)}
        initial="hidden"
        animate="show"
        className="contents"
      >
        {nodes.map((node) => (
          <motion.div
            key={node.label}
            variants={{
              hidden: { opacity: 0, scale: 0.6 },
              show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
            className="absolute flex w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center"
            style={{ left: node.x, top: node.y }}
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-border glass-panel glow-ring">
              <node.icon className="size-4 text-[var(--brand-1)]" />
            </span>
            <span className="text-[11px] font-medium leading-tight text-muted-foreground">
              {node.label}
            </span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-1/2 top-1/2 flex size-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full text-center glass-panel glow-ring"
      >
        <motion.span
          className="absolute inset-0 rounded-full bg-gradient-brand opacity-20 blur-xl"
          animate={{ opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="relative text-xs font-semibold leading-tight px-3">
          Núcleo de
          <br />
          Conhecimento
        </span>
        <span className="relative text-[10px] text-muted-foreground">RAG + citações</span>
      </motion.div>
    </div>
  );
}
