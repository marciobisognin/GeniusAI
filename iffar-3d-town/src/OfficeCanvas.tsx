import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ESCRITÓRIO EM PIXEL ART (CANVAS) — ESTILO GATHER TOWN
//
// Substitui a sala única feita com divs por um andar de verdade: um corredor
// central, uma sala com porta para cada agente (repartição) e uma sala de
// reunião/estar compartilhada no fim do corredor. Paredes têm uma face
// visível (não é só uma borda), avatares são sprites em pixel art (não um
// círculo com emoji), e tudo é desenhado em canvas com bordas duras — nada de
// `border-radius`/CSS blur.
// ---------------------------------------------------------------------------

interface OfficeAgent {
  id: string;
  name: string;
  title: string;
  color: string;
  cargo?: string;
  funcao?: string;
}

interface CompetenciaLike {
  artigo: number;
  resumo: string | null;
}

const TILE = 20; // px por tile, resolução interna do canvas (1:1, sem upscale)

// Paleta (pixel art, tons sólidos — nada de gradiente/blur)
const COLOR = {
  corridorFloorA: "#5b6b78",
  corridorFloorB: "#516070",
  roomFloorA: "#d9c69a",
  roomFloorB: "#cdb888",
  meetingFloorA: "#c9a876",
  meetingFloorB: "#bd9c68",
  wallBase: "#3a2b18",
  wallTop: "#5c4425",
  wallShadow: "#241a0f",
  doorMat: "#8a5a2f",
  deskTop: "#7a4e2b",
  deskEdge: "#4a2f1a",
  monitor: "#0284c7",
  monitorFrame: "#075985",
  chair: "#3a3630",
  sofa: "#1e3a5f",
  sofaEdge: "#0f2942",
  tableTop: "#8a552e",
  tableEdge: "#4a2f1a",
  rug: "#7a4a2e",
  shelf: "#5c4425",
  shelfEdge: "#3a2b16",
  plantPot: "#7c4a2d",
  plantLeaf: "#166534",
  frame: "#3f3121",
  frameArt: "#7dd3c0",
  skin: "#e8b98a",
  hair: "#2b1a0e",
  pants: "#26221d",
  shoes: "#161311",
} as const;

// Sprite de personagem: grade 8x12 "pixels" (h=cabelo, f=rosto, s=camisa,
// p=calça, o=sapato). A cor da camisa (`s`) vem do cargo do agente.
const SPRITE: string[] = [
  "..hhhh..",
  ".hffffh.",
  ".hffffh.",
  "..ffff..",
  ".ssssss.",
  "ssssssss",
  "ssssssss",
  ".ss..ss.",
  ".ss..ss.",
  ".pp..pp.",
  ".pp..pp.",
  ".oo..oo.",
];
const SPRITE_PX = 3; // canvas-px por "pixel" do sprite
const SPRITE_W = 8 * SPRITE_PX;
const SPRITE_H = SPRITE.length * SPRITE_PX;

interface RoomBox {
  x: number;
  y: number;
  w: number;
  h: number;
  doorX: number; // centro da porta, em tiles, na parede de cima
}

interface FloorPlan {
  corridor: { x: number; y: number; w: number; h: number };
  rooms: RoomBox[]; // um por agente, na mesma ordem de `agents`
  meeting: RoomBox;
  totalW: number;
  totalH: number;
}

const ROOM_W = 7;
const ROOM_H = 8;
const GAP = 1;
const CORRIDOR_H = 3;
const START_X = 2;
const START_Y = 2;

function buildFloorPlan(count: number): FloorPlan {
  const n = Math.max(1, count);
  const rooms: RoomBox[] = [];
  for (let i = 0; i < n; i++) {
    const x = START_X + i * (ROOM_W + GAP);
    rooms.push({ x, y: START_Y + CORRIDOR_H, w: ROOM_W, h: ROOM_H, doorX: x + ROOM_W / 2 });
  }
  const meetingW = ROOM_W + 3;
  const meetingX = START_X + n * (ROOM_W + GAP);
  const meeting: RoomBox = {
    x: meetingX,
    y: START_Y + CORRIDOR_H,
    w: meetingW,
    h: ROOM_H,
    doorX: meetingX + meetingW / 2,
  };
  const totalW = meetingX + meetingW + 2;
  const totalH = START_Y + CORRIDOR_H + ROOM_H + 2;
  return {
    corridor: { x: START_X - 1, y: START_Y, w: totalW - START_X, h: CORRIDOR_H },
    rooms,
    meeting,
    totalW,
    totalH,
  };
}

// Hash estável por id (mesmo uso do App.tsx) — evita decoração idêntica em
// toda sala e mantém o layout estável entre re-renders.
function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

function fillTiles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colorA: string,
  colorB: string,
) {
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? colorA : colorB;
      ctx.fillRect((x + tx) * TILE, (y + ty) * TILE, TILE, TILE);
    }
  }
}

// Parede com face visível (não só uma borda): uma faixa mais clara em cima
// (topo da parede) e uma faixa escura embaixo (sombra/base) — dá a
// sensação de altura em vez de uma simples linha de contorno.
function drawWallSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  wTiles: number,
  vertical = false,
) {
  const thickness = 0.55 * TILE;
  if (!vertical) {
    ctx.fillStyle = COLOR.wallShadow;
    ctx.fillRect(x * TILE, y * TILE, wTiles * TILE, thickness);
    ctx.fillStyle = COLOR.wallTop;
    ctx.fillRect(x * TILE, y * TILE, wTiles * TILE, thickness * 0.55);
  } else {
    ctx.fillStyle = COLOR.wallBase;
    ctx.fillRect(x * TILE, y * TILE, thickness, wTiles * TILE);
    ctx.fillStyle = COLOR.wallTop;
    ctx.fillRect(x * TILE, y * TILE, thickness * 0.45, wTiles * TILE);
  }
}

function drawRoomShell(ctx: CanvasRenderingContext2D, room: RoomBox, floorA: string, floorB: string) {
  fillTiles(ctx, room.x, room.y, room.w, room.h, floorA, floorB);

  // paredes laterais e de baixo (perímetro externo do prédio)
  drawWallSegment(ctx, room.x, room.y, room.h, true);
  drawWallSegment(ctx, room.x + room.w - 0.28, room.y, room.h, true);
  ctx.fillStyle = COLOR.wallBase;
  ctx.fillRect(room.x * TILE, (room.y + room.h - 0.4) * TILE, room.w * TILE, 0.4 * TILE);

  // parede de cima, com vão da porta voltado para o corredor
  const doorHalf = 0.9;
  const segLeftW = room.doorX - doorHalf - room.x;
  const segRightX = room.doorX + doorHalf;
  const segRightW = room.x + room.w - segRightX;
  if (segLeftW > 0) drawWallSegment(ctx, room.x, room.y, segLeftW);
  if (segRightW > 0) drawWallSegment(ctx, segRightX, room.y, segRightW);

  // tapete da soleira, marcando a porta
  ctx.fillStyle = COLOR.doorMat;
  ctx.fillRect((room.doorX - doorHalf) * TILE, room.y * TILE - 2, doorHalf * 2 * TILE, TILE * 0.5 + 2);
}

function drawDesk(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const w = 2.1 * TILE;
  const h = 1.3 * TILE;
  const x = cx * TILE - w / 2;
  const y = cy * TILE - h / 2;
  ctx.fillStyle = COLOR.deskEdge;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = COLOR.deskTop;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLOR.monitorFrame;
  ctx.fillRect(x + w * 0.14, y + h * 0.12, w * 0.3, h * 0.55);
  ctx.fillStyle = COLOR.monitor;
  ctx.fillRect(x + w * 0.17, y + h * 0.18, w * 0.24, h * 0.4);

  // cadeira, logo abaixo da mesa
  ctx.fillStyle = COLOR.chair;
  ctx.fillRect(cx * TILE - 0.35 * TILE, cy * TILE + h * 0.7, 0.7 * TILE, 0.7 * TILE);
}

function drawMeetingTable(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const r = 1.5 * TILE;
  ctx.fillStyle = COLOR.rug;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(cx * TILE - r * 1.5, cy * TILE - r * 1.5, r * 3, r * 3);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLOR.tableEdge;
  ctx.fillRect(cx * TILE - r - 2, cy * TILE - r - 2, r * 2 + 4, r * 2 + 4);
  ctx.fillStyle = COLOR.tableTop;
  ctx.fillRect(cx * TILE - r, cy * TILE - r, r * 2, r * 2);
  const seats = [
    [0, -1.5],
    [0, 1.5],
    [-1.4, -0.9],
    [1.4, -0.9],
    [-1.4, 0.9],
    [1.4, 0.9],
  ];
  ctx.fillStyle = COLOR.chair;
  for (const [dx, dy] of seats) {
    ctx.fillRect(cx * TILE + dx * TILE - 6, cy * TILE + dy * TILE - 6, 12, 12);
  }
}

function drawSofa(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const cushionW = 0.85 * TILE;
  const h = 1.5 * TILE;
  ctx.fillStyle = COLOR.sofaEdge;
  ctx.fillRect(x * TILE - 3, y * TILE - 3, cushionW * 3 + 6, h + 6);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = COLOR.sofa;
    ctx.fillRect(x * TILE + i * cushionW, y * TILE, cushionW - 2, h);
  }
}

function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const w = 3 * TILE;
  const h = 1 * TILE;
  ctx.fillStyle = COLOR.shelfEdge;
  ctx.fillRect(x * TILE - 2, y * TILE - 2, w + 4, h + 4);
  ctx.fillStyle = COLOR.shelf;
  ctx.fillRect(x * TILE, y * TILE, w, h);
  const bookColors = ["#7f1d1d", "#1e3a8a", "#166534", "#7c2d12", "#4c1d95"];
  const bookW = w / 8;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = bookColors[i % bookColors.length];
    ctx.fillRect(x * TILE + i * bookW + 2, y * TILE + 2, bookW - 4, h - 4);
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = COLOR.plantPot;
  ctx.fillRect(cx * TILE - 8, cy * TILE, 16, 10);
  ctx.fillStyle = COLOR.plantLeaf;
  ctx.fillRect(cx * TILE - 11, cy * TILE - 16, 22, 18);
  ctx.fillStyle = "#15803d";
  ctx.fillRect(cx * TILE - 6, cy * TILE - 20, 12, 8);
}

function drawWallFrame(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = COLOR.frame;
  ctx.fillRect(x * TILE, y * TILE, 1.4 * TILE, 0.9 * TILE);
  ctx.fillStyle = COLOR.frameArt;
  ctx.fillRect(x * TILE + 3, y * TILE + 3, 1.4 * TILE - 6, 0.9 * TILE - 6);
}

function drawPerson(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  shirtColor: string,
  opts: { active: boolean; t: number },
) {
  const bounce = opts.active ? Math.sin(opts.t * 6) * 2 : 0;
  const baseX = px - SPRITE_W / 2;
  const baseY = py - SPRITE_H - 4 + bounce;

  // sombra no chão
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(px - SPRITE_W / 2.4, py - 4, SPRITE_W / 1.2, 5);

  if (opts.active) {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.strokeRect(baseX - 3, baseY - 3, SPRITE_W + 6, SPRITE_H + 6);
  }

  for (let row = 0; row < SPRITE.length; row++) {
    const line = SPRITE[row];
    for (let col = 0; col < line.length; col++) {
      const c = line[col];
      if (c === ".") continue;
      ctx.fillStyle =
        c === "h" ? COLOR.hair : c === "f" ? COLOR.skin : c === "s" ? shirtColor : c === "p" ? COLOR.pants : COLOR.shoes;
      ctx.fillRect(baseX + col * SPRITE_PX, baseY + row * SPRITE_PX, SPRITE_PX, SPRITE_PX);
    }
  }
}

interface HitBox {
  agentId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const OfficeCanvas = ({
  buildingName,
  agents,
  activeAgentId,
  statusMsg,
  onSelectAgent,
}: {
  buildingName: string;
  agents: (OfficeAgent & { competencia?: CompetenciaLike | null })[];
  activeAgentId: string | null;
  statusMsg: string;
  onSelectAgent: (id: string) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRoomRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const plan = useMemo(() => buildFloorPlan(agents.length), [agents.length]);

  // Posição (em tiles) de cada avatar — no centro da respectiva sala, um
  // pouco acima da mesa — usada tanto para desenhar quanto para hit-test.
  const hitBoxes: HitBox[] = useMemo(
    () =>
      agents.map((agent, i) => {
        const room = plan.rooms[i];
        const cx = room.x + room.w / 2;
        const cy = room.y + room.h * 0.42;
        return {
          agentId: agent.id,
          x: cx * TILE - SPRITE_W / 2 - 4,
          y: cy * TILE - SPRITE_H - 10,
          w: SPRITE_W + 8,
          h: SPRITE_H + 16,
        };
      }),
    [agents, plan],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = plan.totalW * TILE;
    canvas.height = plan.totalH * TILE;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    const draw = (t: number) => {
      ctx.fillStyle = "#0e1a12";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // corredor
      fillTiles(ctx, plan.corridor.x, plan.corridor.y, plan.corridor.w, plan.corridor.h, COLOR.corridorFloorA, COLOR.corridorFloorB);
      drawWallSegment(ctx, plan.corridor.x, plan.corridor.y, plan.corridor.w);
      drawWallSegment(ctx, plan.corridor.x, plan.corridor.y, plan.corridor.h, true);
      drawWallSegment(ctx, plan.corridor.x + plan.corridor.w - 0.28, plan.corridor.y, plan.corridor.h, true);

      // salas de cada agente/repartição
      plan.rooms.forEach((room, i) => {
        drawRoomShell(ctx, room, COLOR.roomFloorA, COLOR.roomFloorB);
        const seed = hash01(agents[i]?.id ?? String(i));
        drawWallFrame(ctx, room.x + room.w * 0.62, room.y + 0.15);
        if (seed > 0.5) drawPlant(ctx, room.x + room.w - 0.9, room.y + room.h - 1.3);
        drawDesk(ctx, room.x + room.w / 2, room.y + room.h * 0.62);
      });

      // sala de reunião / estar compartilhada
      drawRoomShell(ctx, plan.meeting, COLOR.meetingFloorA, COLOR.meetingFloorB);
      drawWallFrame(ctx, plan.meeting.x + 1, plan.meeting.y + 0.15);
      drawWallFrame(ctx, plan.meeting.x + plan.meeting.w - 2.4, plan.meeting.y + 0.15);
      drawBookshelf(ctx, plan.meeting.x + 0.6, plan.meeting.y + plan.meeting.h - 1.6);
      drawSofa(ctx, plan.meeting.x + plan.meeting.w - 3.2, plan.meeting.y + 1);
      drawPlant(ctx, plan.meeting.x + plan.meeting.w - 1, plan.meeting.y + plan.meeting.h - 1.3);
      drawMeetingTable(ctx, plan.meeting.x + plan.meeting.w / 2, plan.meeting.y + plan.meeting.h * 0.55);

      // avatares
      agents.forEach((agent, i) => {
        const room = plan.rooms[i];
        const cx = room.x + room.w / 2;
        const cy = room.y + room.h * 0.62 - 1.1;
        drawPerson(ctx, cx * TILE, cy * TILE, agent.color, {
          active: agent.id === activeAgentId,
          t: t / 1000,
        });
      });

      // Só continua animando enquanto houver um avatar ativo para "pular"
      // nesta sala — evita repintar o canvas a 60fps sem necessidade (custo
      // de CPU e possíveis artefatos de composição com o mapa por baixo).
      if (agents.some((a) => a.id === activeAgentId)) {
        raf = requestAnimationFrame(draw);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [plan, agents, activeAgentId]);

  // "Anda até a sala": quando o agente ativo troca de sala dentro do mesmo
  // prédio, rola o corredor até a porta certa ficar visível.
  useEffect(() => {
    if (!activeAgentId) return;
    if (!agents.some((a) => a.id === activeAgentId)) return;
    activeRoomRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeAgentId, agents]);

  const handlePointer = (e: React.MouseEvent<HTMLCanvasElement>, isClick: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const hit = hitBoxes.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
    if (isClick) {
      if (hit) onSelectAgent(hit.agentId);
      return;
    }
    setHoveredId(hit?.agentId ?? null);
    setTooltipPos(hit ? { x: hit.x + hit.w / 2, y: hit.y } : null);
  };

  const hoveredAgent = hoveredId ? agents.find((a) => a.id === hoveredId) : null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0e1a12] p-4 animate-fade-in">
      <div
        ref={scrollRef}
        className="relative max-w-full max-h-full overflow-x-auto overflow-y-hidden rounded-2xl border-[6px] border-[#5c4425] shadow-2xl"
      >
        <div className="relative" style={{ width: plan.totalW * TILE, height: plan.totalH * TILE }}>
          <canvas
            ref={canvasRef}
            style={{ width: plan.totalW * TILE, height: plan.totalH * TILE, imageRendering: "pixelated" }}
            onMouseMove={(e) => handlePointer(e, false)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={(e) => handlePointer(e, true)}
            className="cursor-pointer"
          />

          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 bg-[#181517] text-amber-400 font-mono text-xs font-bold px-3 py-1 rounded-full border border-amber-500/50 shadow-lg whitespace-nowrap">
            🏛️ {buildingName}
          </div>

          {/* âncoras invisíveis para o auto-scroll até a sala do agente ativo */}
          {plan.rooms.map((room, i) => (
            <div
              key={agents[i]?.id ?? i}
              ref={agents[i]?.id === activeAgentId ? activeRoomRef : undefined}
              className="absolute pointer-events-none"
              style={{ left: room.x * TILE, top: room.y * TILE, width: room.w * TILE, height: room.h * TILE }}
            />
          ))}

          {/* etiqueta com o nome/função de cada agente, sob o sprite */}
          {agents.map((agent, i) => {
            const room = plan.rooms[i];
            const cx = (room.x + room.w / 2) * TILE;
            const cy = (room.y + room.h * 0.62 + 0.55) * TILE;
            const isActive = agent.id === activeAgentId;
            return (
              <div
                key={`label-${agent.id}`}
                className="absolute -translate-x-1/2 pointer-events-none z-10"
                style={{ left: cx, top: cy }}
              >
                {isActive && statusMsg && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-9 bg-amber-400 text-slate-950 text-[10px] font-bold px-2 py-1 rounded-lg shadow-xl border border-slate-900 whitespace-nowrap max-w-[180px] truncate font-mono">
                    💭 {statusMsg}
                  </div>
                )}
                <div
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap max-w-[130px] truncate shadow ${
                    isActive ? "bg-amber-500 text-stone-950" : "bg-[#181517]/95 text-stone-200 border border-stone-700/70"
                  }`}
                >
                  {agent.name}
                </div>
              </div>
            );
          })}

          {hoveredAgent && tooltipPos && (
            <div
              className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full max-w-[220px] bg-[#120f11]/95 text-stone-200 text-[10px] px-2.5 py-2 rounded-lg shadow-xl border border-amber-500/40 font-mono"
              style={{ left: tooltipPos.x, top: tooltipPos.y - 8 }}
            >
              <div className="font-bold text-amber-400 whitespace-normal">{hoveredAgent.name}</div>
              {hoveredAgent.cargo && (
                <div className="text-stone-400">
                  {hoveredAgent.cargo}
                  {hoveredAgent.funcao ? ` · ${hoveredAgent.funcao}` : ""}
                </div>
              )}
              {hoveredAgent.competencia && (
                <div className="mt-1 text-stone-300 whitespace-normal leading-snug">
                  Art. {hoveredAgent.competencia.artigo}
                  {hoveredAgent.competencia.resumo ? ` — ${hoveredAgent.competencia.resumo.slice(0, 140)}` : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
