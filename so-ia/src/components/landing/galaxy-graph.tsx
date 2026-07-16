"use client";

import { motion } from "framer-motion";
import type { AreaNavItem } from "@/lib/nav-config";

const SIZE = 640;
const CENTER = SIZE / 2;
const HUB_RADIUS = 225;
const CLUSTER_RADIUS = 62;

function hashSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash || 1;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number, d = 3) => Number(n.toFixed(d));

interface Satellite {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

interface Hub {
  label: string;
  icon: AreaNavItem["icon"];
  x: number;
  y: number;
  satellites: Satellite[];
  duration: number;
  clockwise: boolean;
  colorIndex: number;
}

function buildHubs(areas: AreaNavItem[]): Hub[] {
  const n = areas.length || 1;
  return areas.map((area, i) => {
    const angleDeg = (360 / n) * i - 90;
    const rad = (angleDeg * Math.PI) / 180;
    const x = round(CENTER + Math.cos(rad) * HUB_RADIUS);
    const y = round(CENTER + Math.sin(rad) * HUB_RADIUS);

    const rng = mulberry32(hashSeed(area.label));
    const satelliteCount = 14 + Math.floor(rng() * 13);
    const satellites: Satellite[] = Array.from({ length: satelliteCount }, () => {
      const sAngle = rng() * Math.PI * 2;
      const sDist = round(20 + rng() * CLUSTER_RADIUS);
      return {
        x: round(Math.cos(sAngle) * sDist),
        y: round(Math.sin(sAngle) * sDist),
        size: round(1 + rng() * 2, 2),
        opacity: round(0.35 + rng() * 0.55, 2),
      };
    });

    return {
      label: area.label,
      icon: area.icon,
      x,
      y,
      satellites,
      duration: round(70 + rng() * 90, 1),
      clockwise: rng() > 0.5,
      colorIndex: i % 3,
    };
  });
}

const colorVars = ["var(--brand-1)", "var(--brand-2)", "var(--brand-3)"];

export function GalaxyGraph({ areas }: { areas: AreaNavItem[] }) {
  const hubs = buildHubs(areas);

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id="galaxy-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--brand-1)" stopOpacity={0} />
          </radialGradient>
          {hubs.map((hub, i) => (
            <linearGradient key={hub.label} id={`spoke-${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colorVars[hub.colorIndex]} stopOpacity={0.5} />
              <stop offset="100%" stopColor={colorVars[hub.colorIndex]} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>

        <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS + CLUSTER_RADIUS + 30} fill="url(#galaxy-glow)" />

        {hubs.map((hub, i) => (
          <motion.line
            key={hub.label}
            x1={CENTER}
            y1={CENTER}
            x2={hub.x}
            y2={hub.y}
            stroke={`url(#spoke-${i})`}
            strokeWidth={1.4}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}

        {hubs.map((hub) => (
          <g key={hub.label} transform={`translate(${hub.x},${hub.y})`}>
            <motion.g
              initial={{ rotate: 0, opacity: 0 }}
              animate={{ rotate: hub.clockwise ? 360 : -360, opacity: 1 }}
              transition={{
                rotate: { duration: hub.duration, repeat: Infinity, ease: "linear" },
                opacity: { duration: 0.8, delay: 0.4 },
              }}
              style={{ originX: 0, originY: 0 }}
            >
              {hub.satellites.map((s, si) => (
                <line
                  key={si}
                  x1={0}
                  y1={0}
                  x2={s.x}
                  y2={s.y}
                  stroke={colorVars[hub.colorIndex]}
                  strokeOpacity={s.opacity * 0.4}
                  strokeWidth={0.6}
                />
              ))}
              {hub.satellites.map((s, si) => (
                <circle
                  key={si}
                  cx={s.x}
                  cy={s.y}
                  r={s.size}
                  fill={colorVars[hub.colorIndex]}
                  fillOpacity={s.opacity}
                />
              ))}
            </motion.g>
            <circle r={3.2} fill={colorVars[hub.colorIndex]} />
          </g>
        ))}
      </svg>

      {hubs.map((hub, i) => (
        <motion.div
          key={hub.label}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="absolute flex w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center"
          style={{ left: hub.x, top: hub.y }}
        >
          <span className="flex size-11 items-center justify-center rounded-xl border border-border glass-panel glow-ring">
            <hub.icon className="size-4.5 text-[var(--brand-1)]" />
          </span>
          <span className="text-[11px] font-medium leading-tight text-muted-foreground">{hub.label}</span>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-1/2 top-1/2 flex size-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full text-center glass-panel glow-ring"
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
