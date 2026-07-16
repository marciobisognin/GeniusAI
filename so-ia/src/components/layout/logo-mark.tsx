"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const NODE_POSITIONS = [0, 60, 120, 180, 240, 300].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return {
    deg,
    x: Number((20 + Math.cos(rad) * 14).toFixed(4)),
    y: Number((20 + Math.sin(rad) * 14).toFixed(4)),
  };
});

export function LogoMark({ className, spin = true }: { className?: string; spin?: boolean }) {
  return (
    <div className={cn("relative size-8 shrink-0", className)}>
      <svg viewBox="0 0 40 40" className="size-full">
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-1)" />
            <stop offset="100%" stopColor="var(--brand-2)" />
          </linearGradient>
        </defs>
        <motion.g
          animate={spin ? { rotate: 360 } : undefined}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          style={{ originX: "20px", originY: "20px" }}
        >
          {NODE_POSITIONS.map(({ deg, x, y }) => (
            <line
              key={deg}
              x1={20}
              y1={20}
              x2={x}
              y2={y}
              stroke="url(#logo-grad)"
              strokeWidth={1.4}
              strokeOpacity={0.55}
            />
          ))}
          {NODE_POSITIONS.map(({ deg, x, y }) => (
            <circle key={deg} cx={x} cy={y} r={2.1} fill="url(#logo-grad)" />
          ))}
        </motion.g>
        <circle cx={20} cy={20} r={6.5} fill="url(#logo-grad)" />
      </svg>
    </div>
  );
}
