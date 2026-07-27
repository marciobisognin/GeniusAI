import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ESCRITÓRIO EM PIXEL ART (CANVAS) — MODELO GATHER 2.0, COM O ORGANOGRAMA
// COMPLETO DO PRÉDIO
//
// Um prédio único e contínuo — sem paredes cortando o andar em caixas
// separadas. Cada repartição direta da Reitoria/do campus (Pró-Reitoria,
// Diretoria, Comissão...) ganha sua própria área, lado a lado num só
// corredor; o limite entre uma e outra é só a cor do piso e a mobília, como
// nas salas de referência do Gather 2.0 — nunca uma parede de verdade. Isso
// é o que faz o andar inteiro ler como um único ambiente fluido, e não uma
// fileira de escritórios desconectados. A chefia (Gabinete do(a)
// Reitor(a)/Diretor(a) Geral, com seus assessores diretos) fica na maior
// área, à esquerda, com mobília mais completa (quadros, sofá, estante) —
// isso já basta para dizer "essa sala é diferente". Repartições de 1-2
// pessoas (comissões, colegiados) se juntam numa única área compartilhada —
// do contrário a Reitoria teria uma dezena de salas de uma pessoa só.
// Intercalados entre as áreas de trabalho, espaços de convivência (Estar,
// Copa, Reunião, Zen) dão um ar mais humano e próximo do dia a dia real de
// uma instituição de ensino.
//
// Quando a demanda passa de uma unidade para outra DENTRO do mesmo prédio,
// um mensageiro anda pelo corredor entre as duas repartições — como no
// vídeo do Gather — em vez de a cena simplesmente saltar. Só quando a
// demanda muda de PRÉDIO (Reitoria <-> campus) é que a cena corta (isso já
// acontece um nível acima, no mapa).
// ---------------------------------------------------------------------------

interface OfficeAgent {
  id: string;
  name: string;
  title: string;
  color: string;
  cargo?: string;
  funcao?: string;
  groupId: string;
  groupLabel: string;
  isHead: boolean;
}

interface CompetenciaLike {
  artigo: number;
  resumo: string | null;
}

type Agent = OfficeAgent & { competencia?: CompetenciaLike | null };

const TILE = 20;

// Paleta amostrada quadro a quadro do vídeo de referência do Gather 2.0:
// piso de tábua corrida quente, carpetes pastel, mesas claras, cadeiras
// azul-marinho e móveis em pêssego/madeira clara. Nada de cinza industrial.
const C = {
  // circulação: tábua corrida creme (o "chão do prédio")
  floor: "#ece4d6",
  floorSeam: "#e0d6c4",
  floorSeam2: "#e6dccb",
  // mesas
  deskTop: "#f8f8f5",
  deskEdge: "#dcdcd4",
  deskBack: "#c9cdd2",
  deskWood: "#e8c893",
  deskWoodEdge: "#c9a166",
  // cadeiras azul-marinho, como no vídeo
  chair: "#4a5070",
  chairDark: "#353a55",
  chairLight: "#5a6180",
  // madeira/móveis
  wood: "#e0b483",
  woodDark: "#bf8f5e",
  sofa: "#f0c4a2",
  sofaDark: "#d69f7c",
  // plantas
  leaf: "#4a9d75",
  leafHi: "#63b98a",
  leafDark: "#3a7d5c",
  pot: "#d8dde4",
  potDark: "#b9c1cb",
  // diversos
  screenFrame: "#3a4050",
  metal: "#a8b0ba",
  skin: "#f0c39a",
  divider: "#e4ded0",
  dividerEdge: "#cdc4b0",
  courier: "#f0a044",
} as const;

// Tampos: a maioria branca, algumas em madeira clara ou menta/rosa — como
// no vídeo, onde uma mesa é verde-água e outra tem tampo de madeira.
const DESK_ACCENTS = ["#f8f8f5", "#f8f8f5", "#e8c893", "#c9e8e0", "#f8f8f5", "#f2dce4"];
const SCREEN_COLORS = ["#5b8fd4", "#d47fb0", "#5bb99a", "#e0ae5e", "#7b8ad4", "#4fc0c0"];
const HAIRS = ["#3b2412", "#7a4a22", "#c98a3f", "#2b2b2b", "#5a3a5a", "#8a5a3a", "#e0c088"];

// Cada repartição ganha seu próprio carpete pastel (como as ilhas de mesa
// do vídeo — cinza-sálvia, lilás, azul, areia), sobre o mesmo piso de
// tábua corrida: é a cor do carpete, e não uma parede, que diz onde uma
// repartição termina e a próxima começa.
const POD_PALETTE: readonly [string, string][] = [
  ["#9aa8ad", "#a6b3b8"], // cinza-sálvia (o carpete das baias do vídeo)
  ["#9298d4", "#9ba1da"], // lilás/periwinkle
  ["#8fb0c4", "#9abaca"], // azul-cinza
  ["#c4b49a", "#cdbea6"], // areia
  ["#94b8a4", "#a0c2af"], // verde-água
  ["#b8a0b4", "#c2acbe"], // rosa-acinzentado
  ["#a0a8c8", "#acb3d0"], // azul-lavanda
  ["#b0b89a", "#bac2a6"], // oliva claro
];

function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// --------------------------- PLANTA -----------------------------------------

interface Zone {
  kind: "office" | "pod" | "lounge" | "meeting" | "break" | "zen";
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  agentIds: string[];
  doorX: number; // ponto de entrada/saída no corredor, em tiles
  floorA: string;
  floorB: string;
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
  corridorY: number;
}

const START_X = 2;
const START_Y = 2;
const CORRIDOR_H = 3;
const ZONE_TOP = START_Y + CORRIDOR_H;
const ZONE_GAP = 0.7;
const DESK_COL_W = 4.9;
const DESK_ROW_H = 5.0;
const ZONE_PAD_X = 1.4;
const ZONE_PAD_TOP = 2.6;
const ZONE_PAD_BOTTOM = 1.2;

function gridFor(n: number) {
  const cols = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(Math.max(1, n)))));
  const rows = Math.max(1, Math.ceil(Math.max(1, n) / cols));
  return { cols, rows };
}

function zoneSize(n: number) {
  const { cols, rows } = gridFor(n);
  return {
    cols,
    rows,
    w: ZONE_PAD_X * 2 + cols * DESK_COL_W,
    h: ZONE_PAD_TOP + ZONE_PAD_BOTTOM + rows * DESK_ROW_H,
  };
}

interface DeptGroup {
  groupId: string;
  groupLabel: string;
  agentIds: string[];
}

// Agrupa as unidades não-chefia pela repartição a que pertencem (já
// calculada em App.tsx via departmentOf) e funde repartições de até 2
// pessoas numa única sala compartilhada de comissões/colegiados — do
// contrário a Reitoria teria uma dezena de salas de uma pessoa só.
function buildDepartments(agents: Agent[]): { head: Agent[]; depts: DeptGroup[] } {
  const head = agents.filter((a) => a.isHead);
  const byGroup = new Map<string, DeptGroup>();
  for (const a of agents) {
    if (a.isHead) continue;
    let g = byGroup.get(a.groupId);
    if (!g) {
      g = { groupId: a.groupId, groupLabel: a.groupLabel, agentIds: [] };
      byGroup.set(a.groupId, g);
    }
    g.agentIds.push(a.id);
  }

  const dedicated: DeptGroup[] = [];
  const sharedIds: string[] = [];
  for (const g of byGroup.values()) {
    if (g.agentIds.length <= 2) sharedIds.push(...g.agentIds);
    else dedicated.push(g);
  }
  dedicated.sort((a, b) => b.agentIds.length - a.agentIds.length || a.groupLabel.localeCompare(b.groupLabel));

  const depts = [...dedicated];
  if (sharedIds.length > 0) {
    depts.push({ groupId: "__shared__", groupLabel: "Colegiados e Comissões", agentIds: sharedIds });
  }
  return { head, depts };
}

function placeSeats(members: Agent[], zone: Zone, cols: number, topPad: number, seats: Seat[], zoneIndex: number) {
  members.forEach((a, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    seats.push({
      agentId: a.id,
      deskX: zone.x + ZONE_PAD_X + col * DESK_COL_W + DESK_COL_W / 2 - 0.3,
      deskY: zone.y + topPad + row * DESK_ROW_H,
      zoneIndex,
    });
  });
}

const SOCIAL_W = 13;

function buildPlan(agents: Agent[]): Plan {
  const { head, depts } = buildDepartments(agents);
  const zones: Zone[] = [];
  const seats: Seat[] = [];
  let cursorX = START_X;

  const headSize = zoneSize(head.length || 1);
  const headW = Math.max(headSize.w, 11);
  const headH = Math.max(headSize.h, 11);
  const deptSizes = depts.map((d) => zoneSize(d.agentIds.length));
  const rowH = Math.max(headH, ...deptSizes.map((s) => s.h), 11);

  // 1) sala fechada da chefia (Gabinete + assessoria direta)
  const headZone: Zone = {
    kind: "office",
    x: cursorX,
    y: ZONE_TOP,
    w: headW,
    h: headH,
    label: "Gabinete",
    agentIds: head.map((a) => a.id),
    doorX: cursorX + headW / 2,
    floorA: "#8b90cf",
    floorB: "#9499d6",
  };
  zones.push(headZone);
  placeSeats(head, headZone, headSize.cols, 3.6, seats, 0);
  cursorX += headW + ZONE_GAP;

  // 2) Estar — logo ao lado da chefia, para intercalar sala de trabalho e
  // espaço de convivência, como nos escritórios de referência.
  const loungeX = cursorX;
  zones.push({
    kind: "lounge",
    x: loungeX,
    y: ZONE_TOP,
    w: SOCIAL_W,
    h: rowH,
    label: "Estar",
    agentIds: [],
    doorX: loungeX + SOCIAL_W / 2,
    floorA: "#e7e9f4",
    floorB: "#dde0ee",
  });
  cursorX += SOCIAL_W + ZONE_GAP;

  // 3) uma sala própria por repartição, cada uma com sua cor de piso
  let paletteIndex = 0;
  depts.forEach((dept, i) => {
    const size = deptSizes[i];
    const zoneIndex = zones.length;
    const isShared = dept.groupId === "__shared__";
    const floor = isShared ? (["#a8aeb2", "#b2b8bc"] as const) : POD_PALETTE[paletteIndex % POD_PALETTE.length];
    if (!isShared) paletteIndex++;
    const z: Zone = {
      kind: "pod",
      x: cursorX,
      y: ZONE_TOP,
      w: size.w,
      h: size.h,
      label: dept.groupLabel,
      agentIds: dept.agentIds,
      doorX: cursorX + size.w / 2,
      floorA: floor[0],
      floorB: floor[1],
    };
    zones.push(z);
    const members = dept.agentIds
      .map((id) => agents.find((a) => a.id === id))
      .filter((a): a is Agent => Boolean(a));
    placeSeats(members, z, size.cols, ZONE_PAD_TOP, seats, zoneIndex);
    cursorX += size.w + ZONE_GAP;
  });

  // 4) Copa — espaço de convivência informal (café, mesas pequenas)
  const breakX = cursorX;
  zones.push({
    kind: "break",
    x: breakX,
    y: ZONE_TOP,
    w: SOCIAL_W,
    h: rowH,
    label: "Copa",
    agentIds: [],
    doorX: breakX + SOCIAL_W / 2,
    floorA: "#efd9b8",
    floorB: "#e7cfa9",
  });
  cursorX += SOCIAL_W + ZONE_GAP;

  // 5) Reunião
  const meetingX = cursorX;
  zones.push({
    kind: "meeting",
    x: meetingX,
    y: ZONE_TOP,
    w: SOCIAL_W,
    h: rowH,
    label: "Reunião",
    agentIds: [],
    doorX: meetingX + SOCIAL_W / 2,
    floorA: "#aab6c4", 
    floorB: "#b4bfcc",
  });
  cursorX += SOCIAL_W + ZONE_GAP;

  // 6) Zen — cantinho de descompressão, sempre ao final da fileira
  const zenX = cursorX;
  zones.push({
    kind: "zen",
    x: zenX,
    y: ZONE_TOP,
    w: SOCIAL_W,
    h: rowH,
    label: "Zen",
    agentIds: [],
    doorX: zenX + SOCIAL_W / 2,
    floorA: "#c3d6c4",
    floorB: "#cbddcc",
  });
  cursorX += SOCIAL_W + ZONE_GAP;

  return {
    zones,
    seats,
    totalW: cursorX + 1,
    totalH: ZONE_TOP + rowH + 2,
    corridorY: START_Y + CORRIDOR_H / 2,
  };
}

// --------------------------- DESENHO ----------------------------------------

// Piso de tábua corrida do prédio inteiro: creme quente com juntas em
// tijolo (fiadas deslocadas), exatamente como o chão de circulação do
// vídeo. É o que dá o ar acolhedor em vez de xadrez industrial.
function woodFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = C.floor;
  ctx.fillRect(0, 0, w * TILE, h * TILE);

  const plankH = 1.15 * TILE;
  const plankW = 11 * TILE;
  const rows = Math.ceil((h * TILE) / plankH);
  for (let r = 0; r < rows; r++) {
    const y = r * plankH;
    // junta entre fiadas: fininha e de baixo contraste, só o suficiente
    // para o olho ler "tábua corrida" sem virar uma grade
    ctx.fillStyle = C.floorSeam2;
    ctx.fillRect(0, y, w * TILE, 1);
    // topos de tábua, deslocados a cada fiada
    const offset = ((r % 3) * plankW) / 3;
    ctx.fillStyle = C.floorSeam;
    for (let x = offset; x < w * TILE; x += plankW) {
      ctx.fillRect(x, y + 1, 1, plankH - 1);
    }
  }
}

// Carpete de uma repartição: retângulo de cor sólida com um xadrez de
// baixíssimo contraste por cima, como as ilhas de carpete do vídeo. Sem
// borda dura — é a diferença de cor que delimita, não uma parede.
function carpet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  a: string,
  b: string,
) {
  ctx.fillStyle = a;
  ctx.fillRect(x * TILE, y * TILE, w * TILE, h * TILE);
  ctx.fillStyle = b;
  const step = 2;
  for (let ty = 0; ty < h; ty += step) {
    for (let tx = 0; tx < w; tx += step) {
      if (((tx / step) + (ty / step)) % 2 !== 0) continue;
      const cw = Math.min(step, w - tx);
      const ch = Math.min(step, h - ty);
      ctx.fillRect((x + tx) * TILE, (y + ty) * TILE, cw * TILE, ch * TILE);
    }
  }
  // sombra de contato bem sutil na borda inferior, para o carpete
  // "assentar" no piso de madeira em vez de flutuar
  ctx.fillStyle = "rgba(90,78,60,0.10)";
  ctx.fillRect(x * TILE, (y + h) * TILE - 2, w * TILE, 3);
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

// Vaso claro com folhagem redonda, do jeito que as plantas aparecem
// espalhadas por todo o escritório do vídeo — elas é que dão o ar humano.
function plant(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = "rgba(90,78,60,0.16)";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // vaso claro
  ctx.fillStyle = C.potDark;
  roundRectPath(ctx, x - 8, y - 1, 16, 11, 3);
  ctx.fill();
  ctx.fillStyle = C.pot;
  roundRectPath(ctx, x - 7, y - 1, 14, 9, 3);
  ctx.fill();
  // folhagem em três lóbulos
  ctx.fillStyle = C.leafDark;
  ctx.beginPath();
  ctx.arc(x - 6, y - 8, 7, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 8, 7, 0, Math.PI * 2);
  ctx.arc(x, y - 15, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.leaf;
  ctx.beginPath();
  ctx.arc(x - 5, y - 9, 5.5, 0, Math.PI * 2);
  ctx.arc(x + 5, y - 9, 5.5, 0, Math.PI * 2);
  ctx.arc(x, y - 16, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.leafHi;
  ctx.beginPath();
  ctx.arc(x - 1, y - 17, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function frame(ctx: CanvasRenderingContext2D, cx: number, cy: number, tint: string) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = "#c9a97e";
  roundRectPath(ctx, x - 13, y - 9, 26, 18, 2);
  ctx.fill();
  ctx.fillStyle = "#fdfbf6";
  ctx.fillRect(x - 11, y - 7, 22, 14);
  ctx.fillStyle = tint;
  ctx.fillRect(x - 10, y - 6, 20, 12);
}

function shelf(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = "rgba(90,78,60,0.15)";
  ctx.fillRect(x - 26, y + 8, 52, 3);
  ctx.fillStyle = C.woodDark;
  roundRectPath(ctx, x - 26, y - 10, 52, 20, 3);
  ctx.fill();
  ctx.fillStyle = C.wood;
  ctx.fillRect(x - 24, y - 8, 48, 16);
  const books = ["#d4705c", "#5c86d4", "#5cb98a", "#e0a85e", "#9a76d4", "#d45c9a"];
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = books[i % books.length];
    const bh = 10 + ((i * 7) % 4);
    ctx.fillRect(x - 22 + i * 5, y - 4 - (bh - 10), 4, bh);
  }
}

function sofa(ctx: CanvasRenderingContext2D, cx: number, cy: number, horizontal = true) {
  const x = cx * TILE;
  const y = cy * TILE;
  const w = horizontal ? 66 : 30;
  const h = horizontal ? 30 : 66;
  ctx.fillStyle = "rgba(90,78,60,0.15)";
  roundRectPath(ctx, x - w / 2 - 2, y - h / 2 + 3, w + 4, h + 4, 7);
  ctx.fill();
  // encosto
  ctx.fillStyle = C.sofaDark;
  roundRectPath(ctx, x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6, 8);
  ctx.fill();
  // assento
  ctx.fillStyle = C.sofa;
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 6);
  ctx.fill();
  // divisão das almofadas
  ctx.fillStyle = C.sofaDark;
  if (horizontal) {
    ctx.fillRect(x - w / 6, y - h / 2 + 3, 2, h - 6);
    ctx.fillRect(x + w / 6, y - h / 2 + 3, 2, h - 6);
  } else {
    ctx.fillRect(x - w / 2 + 3, y - h / 6, w - 6, 2);
    ctx.fillRect(x - w / 2 + 3, y + h / 6, w - 6, 2);
  }
}

function roundTable(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = "rgba(90,78,60,0.16)";
  ctx.beginPath();
  ctx.ellipse(x, y + 5, r + 2, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.woodDark;
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.wood;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

// Almofada de chão, para a sala zen — sem encosto, mais baixa que uma
// cadeira, para reforçar o clima informal do cantinho de descompressão.
function cushion(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 9, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  roundRectPath(ctx, x - 12, y - 9, 24, 20, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x - 8, y - 4, 16, 3);
}

// Pequena fonte/lago de pedras, o centro do cantinho zen.
function pond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = "#9aa89a";
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#bcd8d2";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 2, r * 0.5, 0.3, 2.6);
  ctx.stroke();
}

// Cadeira de escritório vista de cima: encosto arredondado azul-marinho
// com apoios de braço, exatamente como as cadeiras do vídeo.
function officeChair(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(60,52,40,0.16)";
  ctx.beginPath();
  ctx.ellipse(x, y + 11, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // apoios de braço
  ctx.fillStyle = C.chairDark;
  roundRectPath(ctx, x - 14, y - 2, 4, 12, 2);
  ctx.fill();
  roundRectPath(ctx, x + 10, y - 2, 4, 12, 2);
  ctx.fill();
  // encosto
  ctx.fillStyle = C.chairDark;
  roundRectPath(ctx, x - 12, y - 8, 24, 22, 7);
  ctx.fill();
  ctx.fillStyle = C.chair;
  roundRectPath(ctx, x - 10, y - 6, 20, 18, 6);
  ctx.fill();
  // brilho no estofado
  ctx.fillStyle = C.chairLight;
  roundRectPath(ctx, x - 7, y - 3, 14, 7, 3);
  ctx.fill();
}

function emptyChair(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  officeChair(ctx, cx * TILE, cy * TILE);
}

// Estação de trabalho no formato do vídeo: um tampo claro e arredondado
// encostado num painel de fundo, com monitores, teclado e objetos pessoais
// EM CIMA dele; a cadeira e a pessoa ficam logo abaixo, de costas.
function desk(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number, t: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  const w = 3.9 * TILE;
  const h = 1.45 * TILE;
  const left = x - w / 2;
  const top = y - h / 2;

  const accent = DESK_ACCENTS[Math.floor(seed * DESK_ACCENTS.length) % DESK_ACCENTS.length];
  const isWood = accent === C.deskWood;

  // painel/divisória baixa atrás do tampo (o "fundo" cinza das baias)
  ctx.fillStyle = C.deskBack;
  roundRectPath(ctx, left - 3, top - 5, w + 6, 7, 2);
  ctx.fill();

  // sombra de contato + tampo
  ctx.fillStyle = "rgba(70,60,45,0.14)";
  roundRectPath(ctx, left - 1, top + 4, w + 2, h, 4);
  ctx.fill();
  ctx.fillStyle = isWood ? C.deskWoodEdge : C.deskEdge;
  roundRectPath(ctx, left - 2, top - 2, w + 4, h + 4, 4);
  ctx.fill();
  ctx.fillStyle = accent;
  roundRectPath(ctx, left, top, w, h, 3);
  ctx.fill();

  // torre do computador, encostada na divisória
  ctx.fillStyle = C.screenFrame;
  roundRectPath(ctx, left + 4, top + 3, 9, 21, 2);
  ctx.fill();
  ctx.fillStyle = "#5b8fd4";
  ctx.fillRect(left + 6, top + 6, 5, 2);

  // monitor principal, com "conteúdo" na tela e um leve piscar de cursor
  const s1 = SCREEN_COLORS[Math.floor(seed * 7) % SCREEN_COLORS.length];
  ctx.fillStyle = C.screenFrame;
  roundRectPath(ctx, left + 17, top + 1, 28, 19, 2);
  ctx.fill();
  ctx.fillStyle = s1;
  ctx.fillRect(left + 19, top + 3, 24, 15);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(left + 21, top + 5, 13, 2);
  ctx.fillRect(left + 21, top + 9, 18, 2);
  ctx.fillRect(left + 21, top + 13, 10, 2);
  if (Math.floor(t * 1.6 + seed * 10) % 2 === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(left + 32, top + 13, 2, 2);
  }

  // segundo monitor
  const s2 = SCREEN_COLORS[Math.floor(seed * 13) % SCREEN_COLORS.length];
  ctx.fillStyle = C.screenFrame;
  roundRectPath(ctx, left + 48, top + 2, 20, 16, 2);
  ctx.fill();
  ctx.fillStyle = s2;
  ctx.fillRect(left + 50, top + 4, 16, 12);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillRect(left + 52, top + 6, 9, 2);

  // teclado + mouse
  ctx.fillStyle = "#ececea";
  roundRectPath(ctx, left + 21, top + 23, 27, 7, 2);
  ctx.fill();
  ctx.fillStyle = "#c8c8c4";
  ctx.fillRect(left + 23, top + 25, 23, 3);
  ctx.fillStyle = "#ececea";
  ctx.beginPath();
  ctx.ellipse(left + 53, top + 26, 3.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // objeto pessoal — cada mesa é um pouco diferente, como no vídeo
  const k = Math.floor(seed * 4) % 4;
  const ox = left + w - 15;
  const oy = top + 20;
  if (k === 0) {
    // caneca
    ctx.fillStyle = "#d9584f";
    roundRectPath(ctx, ox - 4, oy, 9, 9, 2);
    ctx.fill();
    ctx.strokeStyle = "#d9584f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox + 6.5, oy + 4.5, 3, -1.2, 1.2);
    ctx.stroke();
  } else if (k === 1) {
    // plantinha de mesa
    ctx.fillStyle = C.leaf;
    ctx.beginPath();
    ctx.arc(ox - 1, oy + 2, 5, 0, Math.PI * 2);
    ctx.arc(ox + 4, oy + 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.pot;
    roundRectPath(ctx, ox - 4, oy + 6, 10, 6, 2);
    ctx.fill();
  } else if (k === 2) {
    // pilha de papéis
    ctx.fillStyle = "#fdfbf4";
    roundRectPath(ctx, ox - 4, oy + 2, 12, 9, 1);
    ctx.fill();
    ctx.fillStyle = "#d8d4c8";
    ctx.fillRect(ox - 2, oy + 5, 8, 1);
    ctx.fillRect(ox - 2, oy + 8, 6, 1);
  } else {
    // patinho/brinquedo amarelo
    ctx.fillStyle = "#f2c14e";
    ctx.beginPath();
    ctx.arc(ox, oy + 6, 4.5, 0, Math.PI * 2);
    ctx.arc(ox + 4, oy + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e08a3a";
    ctx.fillRect(ox + 6, oy + 2, 3, 2);
  }
}

// Pessoa SENTADA vista por trás: cabeça redonda com cabelo, ombros na cor
// do cargo e a cadeira azul-marinho envolvendo — do jeito que as pessoas
// trabalhando aparecem no vídeo. Todo mundo respira de leve (bob sutil,
// defasado pelo seed), então o andar inteiro parece vivo, não congelado.
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
  // respiração de fundo para todos + digitação mais marcada para quem
  // está resolvendo a demanda
  const idle = Math.sin(t * 1.5 + seed * 6.28) * 0.55;
  const bob = active ? Math.sin(t * 5) * 1.6 : idle;
  const y = cy * TILE + bob;

  officeChair(ctx, x, y);

  // ombros na cor do cargo: uma faixa estreita, quase toda escondida atrás
  // da cabeça — como no vídeo, onde o que se vê da pessoa é sobretudo o
  // alto da cabeça, e a cadeira emoldura por baixo
  ctx.fillStyle = shirt;
  roundRectPath(ctx, x - 8.5, y - 7, 17, 9, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  roundRectPath(ctx, x - 8.5, y - 1, 17, 3, 2);
  ctx.fill();

  // cabeça vista por trás — nuca de cabelo, com uma nesga de pele no
  // pescoço para não virar uma bola chapada
  const hair = HAIRS[Math.floor(seed * HAIRS.length) % HAIRS.length];
  ctx.fillStyle = C.skin;
  roundRectPath(ctx, x - 3.5, y - 11, 7, 6, 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(x, y - 13, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.arc(x - 2.4, y - 15.2, 2.8, 0, Math.PI * 2);
  ctx.fill();
}

// Mensageiro: a mesma linguagem visual dos avatares sentados, só que de pé
// e de costas, com as pernas alternando e um envelope na mão. É ele quem
// leva a demanda de uma repartição para outra pelo corredor.
function drawWalker(ctx: CanvasRenderingContext2D, x: number, y: number, shirt: string, t: number) {
  const legPhase = Math.floor(t * 7) % 2;
  const bob = legPhase === 0 ? 0 : -1;

  ctx.fillStyle = "rgba(60,52,40,0.24)";
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // pernas
  ctx.fillStyle = "#3d4159";
  if (legPhase === 0) {
    roundRectPath(ctx, x - 6, y - 11, 4.5, 10, 2);
    ctx.fill();
    roundRectPath(ctx, x + 1.5, y - 9, 4.5, 8, 2);
    ctx.fill();
  } else {
    roundRectPath(ctx, x - 6, y - 9, 4.5, 8, 2);
    ctx.fill();
    roundRectPath(ctx, x + 1.5, y - 11, 4.5, 10, 2);
    ctx.fill();
  }

  // tronco
  ctx.fillStyle = shirt;
  roundRectPath(ctx, x - 8, y - 22 + bob, 16, 13, 5);
  ctx.fill();

  // cabeça
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(x, y - 26 + bob, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b1a0e";
  ctx.beginPath();
  ctx.arc(x, y - 27.5 + bob, 7, 0, Math.PI * 2);
  ctx.fill();

  // envelope com a demanda, na mão
  ctx.fillStyle = C.courier;
  roundRectPath(ctx, x + 6, y - 19 + bob, 9, 7, 1);
  ctx.fill();
  ctx.strokeStyle = "#c9762a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 6, y - 19 + bob);
  ctx.lineTo(x + 10.5, y - 15.5 + bob);
  ctx.lineTo(x + 15, y - 19 + bob);
  ctx.stroke();
}

// --------------------------- MOVIMENTO --------------------------------------

interface Point {
  x: number;
  y: number;
}

interface WalkState {
  path: Point[];
  segLens: number[];
  totalLen: number;
  startTs: number;
  duration: number;
  color: string;
}

function buildWalk(from: Seat, to: Seat, zones: Zone[], corridorY: number, color: string): WalkState {
  const fromZone = zones[from.zoneIndex];
  const toZone = zones[to.zoneIndex];
  const path: Point[] = [
    { x: from.deskX, y: from.deskY + 0.6 },
    { x: fromZone.doorX, y: corridorY },
    { x: toZone.doorX, y: corridorY },
    { x: to.deskX, y: to.deskY + 0.6 },
  ];
  const segLens: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    segLens.push(len);
    totalLen += len;
  }
  const SPEED = 9; // tiles por segundo
  return { path, segLens, totalLen, startTs: 0, duration: Math.max(500, (totalLen / SPEED) * 1000), color };
}

function walkPosition(walk: WalkState, elapsedMs: number): Point & { done: boolean } {
  const frac = Math.min(1, elapsedMs / walk.duration);
  const dist = frac * walk.totalLen;
  let acc = 0;
  for (let i = 0; i < walk.segLens.length; i++) {
    const segLen = walk.segLens[i];
    if (dist <= acc + segLen || i === walk.segLens.length - 1) {
      const segFrac = segLen > 0 ? (dist - acc) / segLen : 1;
      const a = walk.path[i];
      const b = walk.path[i + 1];
      return { x: a.x + (b.x - a.x) * segFrac, y: a.y + (b.y - a.y) * segFrac, done: frac >= 1 };
    }
    acc += segLen;
  }
  const last = walk.path[walk.path.length - 1];
  return { x: last.x, y: last.y, done: true };
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
  const zoneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const plan = useMemo(() => buildPlan(agents), [agents]);

  const seatById = useMemo(() => {
    const m = new Map<string, Seat>();
    for (const s of plan.seats) m.set(s.agentId, s);
    return m;
  }, [plan]);

  // Id "visualmente" ativo: acompanha activeAgentId, mas com atraso — só
  // troca quando o mensageiro TERMINA de andar até a nova sala. Enquanto o
  // trajeto acontece, a sala de origem continua com o holofote (é para lá
  // que o visual ainda "pertence"), e quem se move pelo corredor é só o
  // mensageiro.
  const [visualActiveId, setVisualActiveId] = useState<string | null>(activeAgentId);
  const walkRef = useRef<WalkState | null>(null);
  const prevSeatRef = useRef<Seat | null>(null);

  useEffect(() => {
    const newSeat = activeAgentId ? (seatById.get(activeAgentId) ?? null) : null;
    const oldSeat = prevSeatRef.current;
    prevSeatRef.current = newSeat;

    if (newSeat && oldSeat && oldSeat.agentId !== newSeat.agentId) {
      const color = agents.find((a) => a.id === newSeat.agentId)?.color ?? "#f59e0b";
      const walk = buildWalk(oldSeat, newSeat, plan.zones, plan.corridorY, color);
      walk.startTs = performance.now();
      walkRef.current = walk;
      const timer = setTimeout(() => setVisualActiveId(activeAgentId), walk.duration);
      // acompanha a sala de destino assim que o trajeto começa — a câmera
      // (o scroll) e o mensageiro se movem juntos, como uma câmera de jogo.
      zoneRefs.current[newSeat.zoneIndex]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
      return () => clearTimeout(timer);
    }

    walkRef.current = null;
    setVisualActiveId(activeAgentId);
    if (newSeat) {
      zoneRefs.current[newSeat.zoneIndex]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [activeAgentId, seatById, plan, agents]);

  // Zona "visualmente" ativa — é ela que recebe o holofote quando não há
  // mensageiro em trânsito.
  const activeZone = useMemo(() => {
    if (!visualActiveId) return null;
    const seat = seatById.get(visualActiveId);
    if (!seat) return null;
    return plan.zones[seat.zoneIndex] ?? null;
  }, [visualActiveId, seatById, plan]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = plan.totalW * TILE;
    canvas.height = plan.totalH * TILE;
    ctx.imageSmoothingEnabled = false;

    const drawScene = (t: number, walkerPos: Point | null, walkerColor: string) => {
      woodFloor(ctx, plan.totalW, plan.totalH);

      for (const z of plan.zones) {
        carpet(ctx, z.x, z.y, z.w, z.h, z.floorA, z.floorB);
      }

      // Decoração da sala da chefia — sem paredes: o piso lilás e a
      // mobília mais completa (quadros, sofá, estante) já bastam para
      // dizer "essa sala é diferente", como nas salas de referência, que
      // nunca fecham uma sala com paredes de verdade — só cor de piso e
      // móveis marcam o limite, para o andar inteiro ler como um único
      // prédio contínuo, não uma fileira de caixas separadas.
      for (const z of plan.zones) {
        if (z.kind !== "office") continue;
        frame(ctx, z.x + 3.2, z.y + z.h - 5.6, "#9fd0c4");
        frame(ctx, z.x + z.w - 3.2, z.y + z.h - 5.6, "#e0c08a");
        sofa(ctx, z.x + z.w / 2, z.y + z.h - 3.4, true);
        shelf(ctx, z.x + 2.2, z.y + z.h - 2.2);
        plant(ctx, z.x + 1.3, z.y + 2.2);
        plant(ctx, z.x + z.w - 1.3, z.y + 2.2);
      }

      // Ilhas de mesas: divisórias baixas entre as estações
      for (const z of plan.zones) {
        if (z.kind !== "pod") continue;
        const cols = Math.max(1, Math.round((z.w - ZONE_PAD_X * 2) / DESK_COL_W));
        const rows = Math.max(1, Math.round((z.h - ZONE_PAD_TOP - ZONE_PAD_BOTTOM) / DESK_ROW_H));
        for (let c = 1; c < cols; c++) {
          divider(ctx, z.x + ZONE_PAD_X - 0.15 + c * DESK_COL_W, z.y + ZONE_PAD_TOP - 1.9, z.h - ZONE_PAD_TOP - 0.3, true);
        }
        for (let r = 1; r < rows; r++) {
          divider(ctx, z.x + ZONE_PAD_X - 0.3, z.y + ZONE_PAD_TOP - 1.9 + r * DESK_ROW_H, z.w - ZONE_PAD_X * 2 + 0.3, false);
        }
        plant(ctx, z.x + z.w - 0.9, z.y + z.h - 1);
        plant(ctx, z.x + 0.9, z.y + z.h - 1);
      }

      // Estar — sofás, mesa de centro e estante, contra a parede de fundo
      for (const z of plan.zones) {
        if (z.kind !== "lounge") continue;
        sofa(ctx, z.x + z.w / 2, z.y + z.h - 3.4, true);
        sofa(ctx, z.x + 1.9, z.y + z.h - 7.2, false);
        roundTable(ctx, z.x + z.w / 2, z.y + z.h - 5.8, 22);
        shelf(ctx, z.x + z.w / 2, z.y + z.h - 1.2);
        plant(ctx, z.x + z.w - 1.4, z.y + z.h - 2.6);
        plant(ctx, z.x + z.w - 1.4, z.y + z.h - 7.6);
      }

      // Copa — café e mesinhas para uma pausa entre uma repartição e outra
      for (const z of plan.zones) {
        if (z.kind !== "break") continue;
        shelf(ctx, z.x + z.w / 2, z.y + z.h - 1.4);
        roundTable(ctx, z.x + 3.4, z.y + z.h - 4.6, 20);
        emptyChair(ctx, z.x + 3.4 - 1.7, z.y + z.h - 4.6);
        emptyChair(ctx, z.x + 3.4 + 1.7, z.y + z.h - 4.6);
        roundTable(ctx, z.x + z.w - 3.4, z.y + z.h - 4.6, 20);
        emptyChair(ctx, z.x + z.w - 3.4 - 1.7, z.y + z.h - 4.6);
        emptyChair(ctx, z.x + z.w - 3.4 + 1.7, z.y + z.h - 4.6);
        plant(ctx, z.x + 1.2, z.y + z.h - 8.4);
        plant(ctx, z.x + z.w - 1.2, z.y + z.h - 8.4);
      }

      // Reunião
      for (const z of plan.zones) {
        if (z.kind !== "meeting") continue;
        const cx = z.x + z.w / 2;
        const cy = z.y + z.h - 5.4;
        roundTable(ctx, cx, cy, 42);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          emptyChair(ctx, cx + Math.cos(a) * 3.1, cy + Math.sin(a) * 2.6);
        }
        frame(ctx, z.x + 1.6, z.y + z.h - 1.3, "#cfe0f5");
        plant(ctx, z.x + z.w - 1.3, z.y + z.h - 1.3);
      }

      // Zen — cantinho de descompressão: almofadas em volta de uma
      // fonte, com bem menos móveis que as outras salas de propósito
      for (const z of plan.zones) {
        if (z.kind !== "zen") continue;
        const cx = z.x + z.w / 2;
        const cy = z.y + z.h - 5.6;
        pond(ctx, cx, cy, 30);
        const cushionColors = ["#e08a5b", "#6fae7f", "#d0a24f", "#7f95c9"];
        cushionColors.forEach((color, i) => {
          const a = (i / cushionColors.length) * Math.PI * 2 + Math.PI / 4;
          cushion(ctx, cx + Math.cos(a) * 3.3, cy + Math.sin(a) * 2.9, color);
        });
        plant(ctx, z.x + 1.3, z.y + z.h - 1.3);
        plant(ctx, z.x + z.w - 1.3, z.y + z.h - 1.3);
        plant(ctx, z.x + 1.3, z.y + z.h - 9.6);
        plant(ctx, z.x + z.w - 1.3, z.y + z.h - 9.6);
      }

      // Mesas + pessoas sentadas
      for (const seat of plan.seats) {
        const agent = agents.find((a) => a.id === seat.agentId);
        if (!agent) continue;
        const seed = hash01(agent.id);
        desk(ctx, seat.deskX, seat.deskY, seed, t);
        seatedPerson(ctx, seat.deskX, seat.deskY + 1.6, agent.color, seed, agent.id === visualActiveId, t);
      }

      if (walkerPos) drawWalker(ctx, walkerPos.x * TILE, walkerPos.y * TILE, walkerColor, t);
    };

    let raf = 0;
    let lastDraw = -1;
    const render = (ms: number) => {
      raf = requestAnimationFrame(render);

      const walk = walkRef.current;
      // 60fps enquanto alguém anda ou trabalha; ~15fps no repouso, só para
      // manter a respiração dos avatares viva sem custar CPU à toa.
      const interval = walk || visualActiveId ? 0 : 66;
      if (lastDraw >= 0 && ms - lastDraw < interval) return;
      lastDraw = ms;

      const t = ms / 1000;
      let walkerPos: Point | null = null;
      if (walk) {
        const p = walkPosition(walk, ms - walk.startTs);
        walkerPos = { x: p.x, y: p.y };
        if (p.done) walkRef.current = null;
      }

      drawScene(t, walkerPos, walk?.color ?? C.courier);

      // FOCO: como no vídeo, o andar NÃO apaga — ele só recua um pouco, e a
      // área que está resolvendo a demanda ganha um cartão claro por cima.
      // A leitura é suave, não um holofote de palco.
      const dim = "rgba(74,64,48,0.30)";
      if (walkerPos) {
        ctx.fillStyle = dim;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const gx = walkerPos.x * TILE;
        const gy = walkerPos.y * TILE;
        const r = 3.6 * TILE;
        ctx.save();
        ctx.beginPath();
        ctx.arc(gx, gy, r, 0, Math.PI * 2);
        ctx.clip();
        drawScene(t, walkerPos, walk?.color ?? C.courier);
        ctx.restore();
        // halo quente ao redor de quem está levando a demanda
        const g = ctx.createRadialGradient(gx, gy, r * 0.72, gx, gy, r);
        g.addColorStop(0, "rgba(255,246,228,0)");
        g.addColorStop(1, "rgba(255,246,228,0.5)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(gx, gy, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (activeZone) {
        ctx.fillStyle = dim;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const pad = 0.4 * TILE;
        const rx = activeZone.x * TILE - pad;
        const ry = activeZone.y * TILE - pad;
        const rw = activeZone.w * TILE + pad * 2;
        const rh = activeZone.h * TILE + pad * 2;

        ctx.save();
        roundRectPath(ctx, rx, ry, rw, rh, 16);
        ctx.clip();
        drawScene(t, null, C.courier);
        ctx.restore();

        // moldura creme suave, como o cartão de destaque do vídeo
        ctx.strokeStyle = "rgba(255,250,238,0.92)";
        ctx.lineWidth = 6;
        roundRectPath(ctx, rx, ry, rw, rh, 16);
        ctx.stroke();
        ctx.strokeStyle = "rgba(190,172,138,0.5)";
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, rx - 3, ry - 3, rw + 6, rh + 6, 18);
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [plan, agents, visualActiveId, activeZone]);

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
  const visualActiveSeat = visualActiveId ? seatById.get(visualActiveId) : null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#2a2620] p-4 animate-fade-in">
      <div
        className="relative max-w-full max-h-full overflow-auto rounded-2xl border-[6px] border-[#d9c8a8] shadow-2xl"
        style={{ lineHeight: 0 }}
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

          <div className="absolute top-1.5 right-2 z-30 bg-[#1f2430] text-amber-300 font-mono text-xs font-bold px-3 py-1 rounded-full border border-amber-500/40 shadow-lg whitespace-nowrap">
            🏛️ {buildingName}
          </div>

          {/* âncoras invisíveis por zona — usadas só para o scrollIntoView */}
          {plan.zones.map((z, i) => (
            <div
              key={`anchor-${i}`}
              ref={(el) => {
                zoneRefs.current[i] = el;
              }}
              className="absolute pointer-events-none"
              style={{ left: z.x * TILE, top: z.y * TILE, width: z.w * TILE, height: z.h * TILE }}
            />
          ))}

          {/* Plaquinha de grupo por zona (como "Daud, Aaron, Philip") */}
          {plan.zones.map((z, i) =>
            z.label ? (
              <div
                key={`zone-${i}`}
                className={`absolute z-20 pointer-events-none transition-opacity duration-300 ${
                  activeZone && activeZone !== z ? "opacity-25" : "opacity-100"
                }`}
                style={{ left: z.x * TILE + 5, top: z.y * TILE + 4, maxWidth: z.w * TILE - 10 }}
              >
                <span className="bg-[#15171c]/90 text-stone-50 text-[9px] font-mono font-bold px-2.5 py-[3px] rounded-full shadow-md whitespace-nowrap block truncate">
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
            const isActive = agent.id === visualActiveId;
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
                  className={`flex flex-col items-start px-2 py-[3px] rounded-xl shadow-md font-mono ${
                    isActive ? "bg-amber-400 text-slate-950" : "bg-[#15171c]/92 text-stone-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[9px] font-bold leading-tight max-w-[88px]">
                    <span
                      className={`w-[6px] h-[6px] rounded-full shrink-0 ${
                        isActive ? "bg-red-600 animate-pulse" : "bg-emerald-400"
                      }`}
                    />
                    <span className="truncate">{agent.name}</span>
                  </span>
                  <span className={`text-[8px] leading-tight pl-[13px] ${isActive ? "text-slate-800" : "text-stone-400"}`}>
                    {isActive ? "Trabalhando agora" : "Disponível"}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Balão do que está sendo feito — flutua acima da estação ativa,
              fora da faixa das plaquinhas, para não colidir com as vizinhas */}
          {visualActiveId && statusMsg && visualActiveSeat && (
            <div
              className="absolute z-40 -translate-x-1/2 -translate-y-full pointer-events-none"
              style={{ left: visualActiveSeat.deskX * TILE, top: (visualActiveSeat.deskY - 1.1) * TILE }}
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
