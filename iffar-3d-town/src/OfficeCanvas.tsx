import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ESCRITÓRIO EM PIXEL ART (CANVAS) — MODELO GATHER 2.0
//
// Planta aberta, como no Gather 2.0: um piso de circulação creme com "ilhas"
// de zonas delimitadas por COR DE PISO (não por paredes). As Pró-Reitorias /
// Diretorias sentam juntas numa ilha de mesas com divisórias baixas de baia;
// só a unidade-sede (Reitoria ou Gabinete do(a) Diretor(a) Geral) ganha uma
// sala fechada com paredes de verdade. Complementam a planta uma área de
// estar e uma sala de reunião.
//
// Quando uma tarefa está sendo resolvida, a câmera NÃO corta de cena: o andar
// inteiro continua visível, tudo escurece e a zona ativa é redesenhada em
// brilho total dentro de um cartão claro — o "holofote" do Gather 2.0.
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

type Agent = OfficeAgent & { competencia?: CompetenciaLike | null };

const TILE = 20;

// Paleta clara e quente do Gather 2.0 (nada de marrom/oliva escuro)
const C = {
  circA: "#efe3cf",
  circB: "#ebdec8",
  podA: "#bcc8d2",
  podB: "#b4c1cc",
  officeA: "#cdc7ea",
  officeB: "#c5bee6",
  loungeA: "#eef1f7",
  loungeB: "#e4e9f2",
  meetA: "#c9d2d8",
  meetB: "#c1cbd2",
  wallTop: "#efe6d3",
  wallFace: "#c3b393",
  wallShadow: "#95866a",
  deskTop: "#f4f3ef",
  deskEdge: "#cdcbc4",
  chair: "#4a5578",
  chairDark: "#39415e",
  wood: "#c89b6a",
  woodDark: "#a67c4e",
  sofa: "#e3b78e",
  sofaDark: "#c2946b",
  leaf: "#3f8f5a",
  leafHi: "#4fae6c",
  pot: "#c97a4e",
  screenFrame: "#2f3440",
  metal: "#9aa3ad",
  skin: "#e8b98a",
  divider: "#dfd8c6",
  dividerEdge: "#bdb49d",
} as const;

// Cores de tampo para personalizar as estações (como no vídeo, onde uma mesa
// é verde-menta, outra laranja) — escolhidas de forma estável pelo id.
const DESK_ACCENTS = ["#f4f3ef", "#cfe9df", "#f5dcc2", "#dfe3f5", "#f7e2e2", "#e2eecd"];
const SCREEN_COLORS = ["#4f7fd0", "#d06fa8", "#4fae8f", "#d9a24f", "#6f7fd0"];

function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// --------------------------- PLANTA -----------------------------------------

interface Zone {
  kind: "office" | "pod" | "lounge" | "meeting";
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  agentIds: string[];
}

interface Seat {
  agentId: string;
  deskX: number; // centro da mesa, em tiles
  deskY: number;
  zoneIndex: number;
}

interface Plan {
  zones: Zone[];
  seats: Seat[];
  totalW: number;
  totalH: number;
}

const OFFICE = { x: 2, y: 2, w: 11, h: 11 };
const POD_W = 15;
const POD_H = 11;
const POD_X0 = 15;
const POD_GAP = 1;
const SEATS_PER_POD = 6;
// espaçamento entre estações: precisa caber a plaquinha de nome sem colidir
// com a estação vizinha (nomes de unidade do IFFar são longos)
const COL_STEP = 4.9;
const ROW_STEP = 5.0;

function buildPlan(agents: Agent[]): Plan {
  const zones: Zone[] = [];
  const seats: Seat[] = [];

  // 1) Sala fechada da unidade-sede (primeiro agente da lista)
  const head = agents[0];
  const officeZone: Zone = {
    kind: "office",
    ...OFFICE,
    label: head ? "Gabinete" : undefined,
    agentIds: head ? [head.id] : [],
  };
  zones.push(officeZone);
  if (head) {
    seats.push({
      agentId: head.id,
      deskX: OFFICE.x + OFFICE.w / 2,
      deskY: OFFICE.y + 3.4,
      zoneIndex: 0,
    });
  }

  // 2) Ilhas de mesas abertas para as demais unidades
  const rest = agents.slice(1);
  const nPods = Math.ceil(rest.length / SEATS_PER_POD);
  for (let p = 0; p < nPods; p++) {
    const px = POD_X0 + p * (POD_W + POD_GAP);
    const members = rest.slice(p * SEATS_PER_POD, (p + 1) * SEATS_PER_POD);
    const zoneIndex = zones.length;
    zones.push({
      kind: "pod",
      x: px,
      y: OFFICE.y,
      w: POD_W,
      h: POD_H,
      label: nPods > 1 ? `Equipe ${p + 1}` : "Pró-Reitorias e Diretorias",
      agentIds: members.map((a) => a.id),
    });
    members.forEach((a, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      seats.push({
        agentId: a.id,
        deskX: px + 2.6 + col * COL_STEP,
        deskY: OFFICE.y + 1.7 + row * ROW_STEP,
        zoneIndex,
      });
    });
  }

  const contentRight = nPods > 0 ? POD_X0 + nPods * (POD_W + POD_GAP) : POD_X0;
  const totalW = Math.max(contentRight, 32) + 2;

  // 3) Zonas de convívio, na faixa de baixo
  zones.push({ kind: "lounge", x: 2, y: 14, w: 13, h: 11, label: "Estar", agentIds: [] });
  zones.push({ kind: "meeting", x: 17, y: 14, w: 13, h: 11, label: "Reunião", agentIds: [] });

  return { zones, seats, totalW, totalH: 27 };
}

// --------------------------- DESENHO ----------------------------------------

function checker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  a: string,
  b: string,
) {
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? a : b;
      ctx.fillRect((x + tx) * TILE, (y + ty) * TILE, TILE, TILE);
    }
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Parede com face visível: topo claro + face + sombra na base.
function wallH(ctx: CanvasRenderingContext2D, x: number, y: number, wTiles: number) {
  const t = TILE * 0.5;
  ctx.fillStyle = C.wallShadow;
  ctx.fillRect(x * TILE, y * TILE, wTiles * TILE, t);
  ctx.fillStyle = C.wallFace;
  ctx.fillRect(x * TILE, y * TILE, wTiles * TILE, t * 0.7);
  ctx.fillStyle = C.wallTop;
  ctx.fillRect(x * TILE, y * TILE, wTiles * TILE, t * 0.35);
}

function wallV(ctx: CanvasRenderingContext2D, x: number, y: number, hTiles: number) {
  const t = TILE * 0.45;
  ctx.fillStyle = C.wallShadow;
  ctx.fillRect(x * TILE, y * TILE, t, hTiles * TILE);
  ctx.fillStyle = C.wallFace;
  ctx.fillRect(x * TILE, y * TILE, t * 0.65, hTiles * TILE);
}

// Divisória baixa de baia (separa estações dentro da ilha aberta)
function divider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  vertical: boolean,
) {
  const t = 5;
  ctx.fillStyle = C.dividerEdge;
  if (vertical) ctx.fillRect(x * TILE, y * TILE, t, len * TILE);
  else ctx.fillRect(x * TILE, y * TILE, len * TILE, t);
  ctx.fillStyle = C.divider;
  if (vertical) ctx.fillRect(x * TILE, y * TILE, t - 2, len * TILE);
  else ctx.fillRect(x * TILE, y * TILE, len * TILE, t - 2);
}

function plant(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = C.pot;
  ctx.fillRect(x - 7, y, 14, 9);
  ctx.fillStyle = C.leaf;
  ctx.fillRect(x - 10, y - 15, 20, 16);
  ctx.fillStyle = C.leafHi;
  ctx.fillRect(x - 6, y - 20, 12, 9);
}

function frame(ctx: CanvasRenderingContext2D, cx: number, cy: number, tint: string) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = "#8a7a5c";
  ctx.fillRect(x - 13, y - 9, 26, 18);
  ctx.fillStyle = tint;
  ctx.fillRect(x - 10, y - 6, 20, 12);
}

function shelf(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(x - 26, y - 10, 52, 20);
  ctx.fillStyle = C.wood;
  ctx.fillRect(x - 24, y - 8, 48, 16);
  const books = ["#b4553f", "#3f6bb4", "#3f9e6b", "#a4763f", "#7a4fb4"];
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = books[i % books.length];
    ctx.fillRect(x - 22 + i * 5, y - 6, 4, 12);
  }
}

function sofa(ctx: CanvasRenderingContext2D, cx: number, cy: number, horizontal = true) {
  const x = cx * TILE;
  const y = cy * TILE;
  const w = horizontal ? 66 : 30;
  const h = horizontal ? 30 : 66;
  ctx.fillStyle = C.sofaDark;
  ctx.fillRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6);
  ctx.fillStyle = C.sofa;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = C.sofaDark;
  if (horizontal) {
    ctx.fillRect(x - w / 6, y - h / 2, 2, h);
    ctx.fillRect(x + w / 6, y - h / 2, 2, h);
  } else {
    ctx.fillRect(x - w / 2, y - h / 6, w, 2);
    ctx.fillRect(x - w / 2, y + h / 6, w, 2);
  }
}

function roundTable(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = C.woodDark;
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.wood;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Cadeira de escritório vista de cima (base + encosto), sem ninguém sentado.
function emptyChair(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = C.chairDark;
  ctx.fillRect(x - 11, y - 9, 22, 20);
  ctx.fillStyle = C.chair;
  ctx.fillRect(x - 9, y - 7, 18, 16);
  ctx.fillStyle = C.chairDark;
  ctx.fillRect(x - 12, y - 3, 3, 8);
  ctx.fillRect(x + 9, y - 3, 3, 8);
}

// Mesa densa e personalizada: 2 monitores com conteúdo, teclado, torre,
// caneca, planta e um objeto pessoal — como as estações do Gather 2.0.
function desk(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  const w = 3.6 * TILE;
  const h = 1.5 * TILE;
  const left = x - w / 2;
  const top = y - h / 2;

  const accent = DESK_ACCENTS[Math.floor(seed * DESK_ACCENTS.length) % DESK_ACCENTS.length];
  ctx.fillStyle = C.deskEdge;
  ctx.fillRect(left - 2, top - 2, w + 4, h + 4);
  ctx.fillStyle = accent;
  ctx.fillRect(left, top, w, h);

  // torre do computador
  ctx.fillStyle = C.screenFrame;
  ctx.fillRect(left + 3, top + 4, 9, 20);

  // monitor principal
  const s1 = SCREEN_COLORS[Math.floor(seed * 7) % SCREEN_COLORS.length];
  ctx.fillStyle = C.screenFrame;
  ctx.fillRect(left + 16, top + 2, 26, 17);
  ctx.fillStyle = s1;
  ctx.fillRect(left + 18, top + 4, 22, 13);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(left + 20, top + 6, 12, 2);
  ctx.fillRect(left + 20, top + 10, 16, 2);

  // segundo monitor
  const s2 = SCREEN_COLORS[Math.floor(seed * 13) % SCREEN_COLORS.length];
  ctx.fillStyle = C.screenFrame;
  ctx.fillRect(left + 45, top + 3, 19, 15);
  ctx.fillStyle = s2;
  ctx.fillRect(left + 47, top + 5, 15, 11);

  // teclado
  ctx.fillStyle = "#e6e6e2";
  ctx.fillRect(left + 20, top + 22, 26, 7);
  ctx.fillStyle = "#c2c2bd";
  ctx.fillRect(left + 22, top + 24, 22, 3);

  // objetos pessoais (caneca, planta ou brinquedo — variam pelo seed)
  if (seed > 0.66) {
    ctx.fillStyle = "#d9584f";
    ctx.fillRect(left + w - 16, top + 20, 9, 9);
  } else if (seed > 0.33) {
    ctx.fillStyle = C.leaf;
    ctx.fillRect(left + w - 17, top + 17, 12, 12);
    ctx.fillStyle = C.pot;
    ctx.fillRect(left + w - 15, top + 27, 8, 4);
  } else {
    ctx.fillStyle = "#f2c14e";
    ctx.fillRect(left + w - 15, top + 21, 8, 8);
  }
}

// Pessoa SENTADA vista por trás: vemos a nuca/cabelo, os ombros e o encosto
// da cadeira — é assim que aparecem as pessoas trabalhando no Gather 2.0.
const HAIRS = ["#3b2412", "#7a4a22", "#c98a3f", "#2b2b2b", "#5a3a5a", "#8a5a3a"];

function seatedPerson(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  shirt: string,
  seed: number,
  active: boolean,
  t: number,
) {
  const x = cx * TILE;
  const bob = active ? Math.sin(t * 5) * 1.5 : 0;
  const y = cy * TILE + bob;

  // encosto da cadeira, atrás da pessoa
  ctx.fillStyle = C.chairDark;
  ctx.fillRect(x - 12, y - 6, 24, 22);
  ctx.fillStyle = C.chair;
  ctx.fillRect(x - 10, y - 4, 20, 18);
  // apoios de braço
  ctx.fillStyle = C.chairDark;
  ctx.fillRect(x - 13, y + 1, 3, 9);
  ctx.fillRect(x + 10, y + 1, 3, 9);

  // ombros (camisa na cor do cargo)
  ctx.fillStyle = shirt;
  ctx.fillRect(x - 9, y - 8, 18, 8);

  // cabeça vista de cima/por trás (quase toda cabelo)
  const hair = HAIRS[Math.floor(seed * HAIRS.length) % HAIRS.length];
  ctx.fillStyle = C.skin;
  ctx.fillRect(x - 7, y - 17, 14, 11);
  ctx.fillStyle = hair;
  ctx.fillRect(x - 8, y - 19, 16, 9);
  ctx.fillRect(x - 8, y - 12, 3, 4);
  ctx.fillRect(x + 5, y - 12, 3, 4);

  if (active) {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 15, y - 21, 30, 38);
  }
}

// --------------------------- COMPONENTE -------------------------------------

export const OfficeCanvas = ({
  buildingName,
  agents,
  activeAgentId,
  statusMsg,
  onSelectAgent,
}: {
  buildingName: string;
  agents: Agent[];
  activeAgentId: string | null;
  statusMsg: string;
  onSelectAgent: (id: string) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const plan = useMemo(() => buildPlan(agents), [agents]);

  const seatById = useMemo(() => {
    const m = new Map<string, Seat>();
    for (const s of plan.seats) m.set(s.agentId, s);
    return m;
  }, [plan]);

  // Zona do agente ativo — é ela que recebe o holofote.
  const activeZone = useMemo(() => {
    if (!activeAgentId) return null;
    const seat = seatById.get(activeAgentId);
    if (!seat) return null;
    return plan.zones[seat.zoneIndex] ?? null;
  }, [activeAgentId, seatById, plan]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = plan.totalW * TILE;
    canvas.height = plan.totalH * TILE;
    ctx.imageSmoothingEnabled = false;

    const drawScene = (t: number) => {
      // piso de circulação (creme), cobrindo o andar inteiro
      checker(ctx, 0, 0, plan.totalW, plan.totalH, C.circA, C.circB);

      for (const z of plan.zones) {
        if (z.kind === "office") checker(ctx, z.x, z.y, z.w, z.h, C.officeA, C.officeB);
        if (z.kind === "pod") checker(ctx, z.x, z.y, z.w, z.h, C.podA, C.podB);
        if (z.kind === "lounge") checker(ctx, z.x, z.y, z.w, z.h, C.loungeA, C.loungeB);
        if (z.kind === "meeting") checker(ctx, z.x, z.y, z.w, z.h, C.meetA, C.meetB);
      }

      // Só a sala-sede tem paredes de verdade (com vão de porta embaixo)
      for (const z of plan.zones) {
        if (z.kind !== "office") continue;
        wallH(ctx, z.x, z.y, z.w);
        wallV(ctx, z.x, z.y, z.h);
        wallV(ctx, z.x + z.w - 0.45, z.y, z.h);
        const doorC = z.x + z.w / 2;
        wallH(ctx, z.x, z.y + z.h - 0.5, doorC - 1 - z.x);
        wallH(ctx, doorC + 1, z.y + z.h - 0.5, z.x + z.w - (doorC + 1));
        // sala de chefia mobiliada: quadros, sofá de apoio, estante e plantas
        frame(ctx, z.x + 3.2, z.y + 0.9, "#9fd0c4");
        frame(ctx, z.x + 7.8, z.y + 0.9, "#e0c08a");
        sofa(ctx, z.x + z.w / 2, z.y + 7.6, true);
        roundTable(ctx, z.x + z.w / 2, z.y + 9.1, 15);
        shelf(ctx, z.x + 2.6, z.y + 5.6);
        plant(ctx, z.x + 1.3, z.y + 2.2);
        plant(ctx, z.x + z.w - 1.3, z.y + 2.2);
        plant(ctx, z.x + z.w - 1.3, z.y + 6.4);
      }

      // Ilhas de mesas: divisórias baixas entre as estações
      for (const z of plan.zones) {
        if (z.kind !== "pod") continue;
        for (let c = 1; c < 3; c++) {
          divider(ctx, z.x + 0.25 + c * COL_STEP, z.y + 0.5, 3.8, true);
          divider(ctx, z.x + 0.25 + c * COL_STEP, z.y + 0.5 + ROW_STEP, 3.8, true);
        }
        divider(ctx, z.x + 0.4, z.y + ROW_STEP - 0.6, z.w - 0.8, false);
        plant(ctx, z.x + z.w - 0.9, z.y + z.h - 1);
        plant(ctx, z.x + 0.9, z.y + z.h - 1);
      }

      // Estar
      for (const z of plan.zones) {
        if (z.kind !== "lounge") continue;
        sofa(ctx, z.x + z.w / 2, z.y + 2, true);
        sofa(ctx, z.x + 1.9, z.y + 5.4, false);
        roundTable(ctx, z.x + z.w / 2, z.y + 5.2, 22);
        shelf(ctx, z.x + z.w / 2, z.y + z.h - 1.2);
        plant(ctx, z.x + z.w - 1.4, z.y + 1.6);
        plant(ctx, z.x + z.w - 1.4, z.y + 7.4);
      }

      // Reunião
      for (const z of plan.zones) {
        if (z.kind !== "meeting") continue;
        const cx = z.x + z.w / 2;
        const cy = z.y + z.h / 2 - 0.6;
        roundTable(ctx, cx, cy, 42);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          emptyChair(ctx, cx + Math.cos(a) * 3.1, cy + Math.sin(a) * 2.6);
        }
        frame(ctx, z.x + 2, z.y + 0.8, "#cfe0f5");
        plant(ctx, z.x + z.w - 1.3, z.y + z.h - 1.3);
      }

      // Mesas + pessoas sentadas
      for (const seat of plan.seats) {
        const agent = agents.find((a) => a.id === seat.agentId);
        if (!agent) continue;
        const seed = hash01(agent.id);
        desk(ctx, seat.deskX, seat.deskY, seed);
        // encostado na mesa (não flutuando abaixo dela)
        seatedPerson(
          ctx,
          seat.deskX,
          seat.deskY + 1.6,
          agent.color,
          seed,
          agent.id === activeAgentId,
          t,
        );
      }
    };

    let raf = 0;
    const render = (ms: number) => {
      const t = ms / 1000;
      drawScene(t);

      // HOLOFOTE: escurece o andar inteiro e reacende só a zona ativa,
      // dentro de um cartão claro de cantos arredondados.
      if (activeZone) {
        ctx.fillStyle = "rgba(28,24,18,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const pad = 0.35 * TILE;
        const rx = activeZone.x * TILE - pad;
        const ry = activeZone.y * TILE - pad;
        const rw = activeZone.w * TILE + pad * 2;
        const rh = activeZone.h * TILE + pad * 2;

        ctx.save();
        roundRectPath(ctx, rx, ry, rw, rh, 14);
        ctx.clip();
        drawScene(t);
        ctx.restore();

        ctx.strokeStyle = "#fdf6e6";
        ctx.lineWidth = 5;
        roundRectPath(ctx, rx, ry, rw, rh, 14);
        ctx.stroke();
      }

      if (activeAgentId) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [plan, agents, activeAgentId, activeZone]);

  const handlePointer = (e: React.MouseEvent<HTMLCanvasElement>, click: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) * canvas.width) / r.width;
    const y = ((e.clientY - r.top) * canvas.height) / r.height;
    const hit = plan.seats.find((s) => {
      const sx = s.deskX * TILE;
      const sy = s.deskY * TILE;
      return x >= sx - 40 && x <= sx + 40 && y >= sy - 22 && y <= sy + 60;
    });
    if (click) {
      if (hit) onSelectAgent(hit.agentId);
      return;
    }
    setHoveredId(hit?.agentId ?? null);
  };

  const hovered = hoveredId ? agents.find((a) => a.id === hoveredId) : null;
  const hoveredSeat = hoveredId ? seatById.get(hoveredId) : null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#171b17] p-4 animate-fade-in">
      <div
        className="relative max-w-full max-h-full overflow-auto rounded-2xl border-[6px] border-[#8a7a5c] shadow-2xl"
        style={{ lineHeight: 0 }}
      >
        <div
          className="relative"
          style={{ width: plan.totalW * TILE, height: plan.totalH * TILE }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: plan.totalW * TILE, height: plan.totalH * TILE, imageRendering: "pixelated" }}
            onMouseMove={(e) => handlePointer(e, false)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={(e) => handlePointer(e, true)}
            className="cursor-pointer"
          />

          <div className="absolute top-1.5 right-2 z-30 bg-[#1f2430] text-amber-300 font-mono text-xs font-bold px-3 py-1 rounded-full border border-amber-500/40 shadow-lg whitespace-nowrap">
            🏛️ {buildingName}
          </div>

          {/* Plaquinha de grupo por zona (como "Daud, Aaron, Philip") —
              flutua dentro da zona, para não colidir com o título do prédio */}
          {plan.zones.map((z, i) =>
            z.label ? (
              <div
                key={`zone-${i}`}
                className={`absolute z-20 pointer-events-none transition-opacity duration-300 ${
                  activeZone && activeZone !== z ? "opacity-25" : "opacity-100"
                }`}
                style={{ left: z.x * TILE + 5, top: z.y * TILE + 4 }}
              >
                <span className="bg-[#1f2430]/90 text-stone-100 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-white/15 shadow whitespace-nowrap">
                  {z.label}
                  {z.agentIds.length > 0 ? ` · ${z.agentIds.length}` : ""}
                </span>
              </div>
            ) : null,
          )}

          {/* Plaquinha por agente: nome + linha de status, como no Gather 2.0 */}
          {plan.seats.map((seat) => {
            const agent = agents.find((a) => a.id === seat.agentId);
            if (!agent) return null;
            const isActive = agent.id === activeAgentId;
            const dim = activeZone && plan.zones[seat.zoneIndex] !== activeZone;
            return (
              <div
                key={`lbl-${agent.id}`}
                className={`absolute z-20 -translate-x-1/2 pointer-events-none transition-opacity duration-300 ${
                  dim ? "opacity-25" : "opacity-100"
                }`}
                style={{ left: seat.deskX * TILE, top: (seat.deskY + 2.6) * TILE }}
              >
                <div
                  className={`flex flex-col items-start px-1.5 py-0.5 rounded-md shadow border font-mono ${
                    isActive
                      ? "bg-amber-400 text-slate-950 border-amber-600"
                      : "bg-[#1f2430]/95 text-stone-100 border-white/15"
                  }`}
                >
                  <span className="flex items-center gap-1 text-[9px] font-bold leading-tight max-w-[86px]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isActive ? "bg-red-600 animate-pulse" : "bg-emerald-400"
                      }`}
                    />
                    <span className="truncate">{agent.name}</span>
                  </span>
                  <span
                    className={`text-[8px] leading-tight pl-2.5 ${
                      isActive ? "text-slate-800" : "text-stone-400"
                    }`}
                  >
                    {isActive ? "Trabalhando agora" : "Disponível"}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Balão do que está sendo feito — flutua acima da estação ativa,
              fora da faixa das plaquinhas, para não colidir com as vizinhas */}
          {activeAgentId && statusMsg && seatById.get(activeAgentId) && (
            <div
              className="absolute z-40 -translate-x-1/2 -translate-y-full pointer-events-none"
              style={{
                left: seatById.get(activeAgentId)!.deskX * TILE,
                top: (seatById.get(activeAgentId)!.deskY - 1.1) * TILE,
              }}
            >
              <div className="bg-amber-400 text-slate-950 text-[9px] font-bold px-2 py-1 rounded-md shadow-xl border border-amber-600 max-w-[210px] truncate font-mono">
                💭 {statusMsg}
              </div>
            </div>
          )}

          {hovered && hoveredSeat && (
            <div
              className="absolute z-40 pointer-events-none -translate-x-1/2 -translate-y-full max-w-[230px] bg-[#12151c]/97 text-stone-200 text-[10px] px-2.5 py-2 rounded-lg shadow-xl border border-amber-500/40 font-mono"
              style={{ left: hoveredSeat.deskX * TILE, top: (hoveredSeat.deskY - 1) * TILE }}
            >
              <div className="font-bold text-amber-400 whitespace-normal">{hovered.name}</div>
              {hovered.cargo && (
                <div className="text-stone-400">
                  {hovered.cargo}
                  {hovered.funcao ? ` · ${hovered.funcao}` : ""}
                </div>
              )}
              {hovered.competencia && (
                <div className="mt-1 text-stone-300 whitespace-normal leading-snug">
                  Art. {hovered.competencia.artigo}
                  {hovered.competencia.resumo ? ` — ${hovered.competencia.resumo.slice(0, 140)}` : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
