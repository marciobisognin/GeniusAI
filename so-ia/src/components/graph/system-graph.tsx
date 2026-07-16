"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { AgentAssignment } from "@/lib/org/matching";
import type { ExecutionRecord } from "@/components/providers/organization-provider";
import { cn } from "@/lib/utils";

const SIZE = 680;
const CENTER = SIZE / 2;
const HUB_RADIUS = 212;
const AGENT_RADIUS = 48;
const SKILL_RADIUS = 78;

const colorVars = ["var(--brand-1)", "var(--brand-2)", "var(--brand-3)"];

const round = (n: number, d = 3) => Number(n.toFixed(d));

function hashSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash || 1;
}

interface SkillDot {
  key: string;
  x: number;
  y: number;
}

interface AgentNode {
  assignment: AgentAssignment;
  x: number;
  y: number;
  hubX: number;
  hubY: number;
  colorIndex: number;
  skills: SkillDot[];
}

interface Hub {
  area: string;
  x: number;
  y: number;
  colorIndex: number;
  agents: AgentNode[];
}

function buildHubs(assignments: AgentAssignment[]): Hub[] {
  const byArea = new Map<string, AgentAssignment[]>();
  for (const a of assignments) {
    const area = a.node.area || "Geral";
    byArea.set(area, [...(byArea.get(area) ?? []), a]);
  }

  const areas = Array.from(byArea.keys());
  const n = areas.length || 1;

  return areas.map((area, i) => {
    const angle = ((360 / n) * i - 90) * (Math.PI / 180);
    const hubX = round(CENTER + Math.cos(angle) * HUB_RADIUS);
    const hubY = round(CENTER + Math.sin(angle) * HUB_RADIUS);
    const colorIndex = i % 3;
    const items = byArea.get(area) ?? [];

    const agents: AgentNode[] = items.map((assignment, j) => {
      const spread = items.length === 1 ? 0 : (360 / items.length) * j;
      const offset = (hashSeed(area) % 360) + spread;
      const aRad = (offset * Math.PI) / 180;
      const x = round(hubX + Math.cos(aRad) * AGENT_RADIUS);
      const y = round(hubY + Math.sin(aRad) * AGENT_RADIUS);

      const skills: SkillDot[] = assignment.agent.skills.map((skill, k) => {
        const sDeg = (hashSeed(skill) % 360) + k * 17;
        const sRad = (sDeg * Math.PI) / 180;
        const sDist = SKILL_RADIUS + (hashSeed(skill) % 18);
        return {
          key: `${assignment.nodeId}-${skill}`,
          x: round(hubX + Math.cos(sRad) * sDist),
          y: round(hubY + Math.sin(sRad) * sDist),
        };
      });

      return { assignment, x, y, hubX, hubY, colorIndex, skills };
    });

    return { area, x: hubX, y: hubY, colorIndex, agents };
  });
}

export function SystemGraph({
  assignments,
  executions,
  selectedNodeId,
  onSelect,
}: {
  assignments: AgentAssignment[];
  executions: ExecutionRecord[];
  selectedNodeId: string | null;
  onSelect: (assignment: AgentAssignment) => void;
}) {
  const hubs = useMemo(() => buildHubs(assignments), [assignments]);
  const running = useMemo(
    () => new Set(executions.filter((e) => e.status === "executando").map((e) => e.nodeId)),
    [executions],
  );

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id="sys-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand-1)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--brand-1)" stopOpacity={0} />
          </radialGradient>
        </defs>

        <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS + SKILL_RADIUS + 20} fill="url(#sys-glow)" />

        {hubs.map((hub, i) => (
          <motion.line
            key={hub.area}
            x1={CENTER}
            y1={CENTER}
            x2={hub.x}
            y2={hub.y}
            stroke={colorVars[hub.colorIndex]}
            strokeOpacity={0.28}
            strokeWidth={1.3}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.1 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}

        {hubs.flatMap((hub) =>
          hub.agents.map((agent) => (
            <g key={agent.assignment.nodeId}>
              <line
                x1={hub.x}
                y1={hub.y}
                x2={agent.x}
                y2={agent.y}
                stroke={colorVars[hub.colorIndex]}
                strokeOpacity={running.has(agent.assignment.nodeId) ? 0.9 : 0.45}
                strokeWidth={running.has(agent.assignment.nodeId) ? 1.6 : 1}
              />
              {agent.skills.map((s) => (
                <g key={s.key}>
                  <line
                    x1={agent.x}
                    y1={agent.y}
                    x2={s.x}
                    y2={s.y}
                    stroke={colorVars[hub.colorIndex]}
                    strokeOpacity={0.16}
                    strokeWidth={0.6}
                  />
                  <circle cx={s.x} cy={s.y} r={1.8} fill={colorVars[hub.colorIndex]} fillOpacity={0.55} />
                </g>
              ))}
            </g>
          )),
        )}

        {hubs.map((hub) => (
          <circle key={hub.area} cx={hub.x} cy={hub.y} r={3} fill={colorVars[hub.colorIndex]} />
        ))}
      </svg>

      {/* Área labels */}
      {hubs.map((hub, i) => {
        const dx = hub.x - CENTER;
        const dy = hub.y - CENTER;
        const norm = Math.hypot(dx, dy) || 1;
        const lx = hub.x + (dx / norm) * (SKILL_RADIUS + 26);
        const ly = hub.y + (dy / norm) * (SKILL_RADIUS + 26);
        return (
          <motion.span
            key={hub.area}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.06 }}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
            style={{ left: lx, top: ly }}
          >
            {hub.area}
          </motion.span>
        );
      })}

      {/* Agent nodes (interactive) */}
      {hubs.flatMap((hub) =>
        hub.agents.map((agent, j) => {
          const nodeId = agent.assignment.nodeId;
          const isRunning = running.has(nodeId);
          const isSelected = selectedNodeId === nodeId;
          return (
            <motion.button
              key={nodeId}
              type="button"
              onClick={() => onSelect(agent.assignment)}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.35 + j * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer outline-none"
              style={{ left: agent.x, top: agent.y }}
              aria-label={`${agent.assignment.agent.nome} — ${agent.assignment.node.titulo}`}
            >
              {isRunning && (
                <motion.span
                  className="absolute inset-0 -m-2 rounded-full"
                  style={{ border: `1.5px solid ${colorVars[agent.colorIndex]}` }}
                  animate={{ scale: [1, 1.9], opacity: [0.8, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <span
                className={cn(
                  "block size-3.5 rounded-full transition-all duration-200 group-hover:scale-125",
                  isSelected && "scale-125 ring-2 ring-offset-2 ring-offset-background",
                )}
                style={{
                  background: colorVars[agent.colorIndex],
                  boxShadow: `0 0 12px ${colorVars[agent.colorIndex]}`,
                  ...(isSelected ? ({ ["--tw-ring-color" as string]: colorVars[agent.colorIndex] } as object) : {}),
                }}
              />
              <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-0.5 text-[10px] font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 z-10">
                {agent.assignment.node.titulo}
              </span>
            </motion.button>
          );
        }),
      )}

      {/* Core */}
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
