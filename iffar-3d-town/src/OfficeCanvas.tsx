import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ESCRITÓRIO EM PIXEL ART (CANVAS) — MODELO GATHER 2.0, COM O ORGANOGRAMA
// COMPLETO DO PRÉDIO
//
// Um corredor central corre por cima de uma fileira de SALAS DE VERDADE —
// paredes nos 4 lados, com a porta voltada para o corredor — cada uma com
// sua própria cor de piso, como nas salas do Gather 2.0. Cada repartição
// direta da Reitoria/do campus (Pró-Reitoria, Diretoria, Comissão...) ganha
// sua sala; a chefia (Gabinete do(a) Reitor(a)/Diretor(a) Geral, com seus
// assessores diretos) fica na sala maior, à esquerda. Repartições de 1-2
// pessoas (comissões, colegiados) se juntam numa única sala compartilhada —
// do contrário a Reitoria teria uma dezena de salas de uma pessoa só.
// Intercaladas entre as salas de trabalho, espaços de convivência (Estar,
// Copa, Reunião, Zen) dão um ar mais humano e próximo do dia a dia real de uma
// instituição de ensino.
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
  courier: "#f59e0b",
} as const;

// Cores de tampo para personalizar as estações (como no vídeo, onde uma mesa
// é verde-menta, outra laranja) — escolhidas de forma estável pelo id.
const DESK_ACCENTS = ["#f4f3ef", "#cfe9df", "#f5dcc2", "#dfe3f5", "#f7e2e2", "#e2eecd"];
const SCREEN_COLORS = ["#4f7fd0", "#d06fa8", "#4fae8f", "#d9a24f", "#6f7fd0"];
const HAIRS = ["#3b2412", "#7a4a22", "#c98a3f", "#2b2b2b", "#5a3a5a", "#8a5a3a"];

// Cada repartição ganha sua própria cor de piso (como nas salas do Gather
// 2.0 — cinza, verde, lilás, azul...), para que o andar leia como um
// conjunto de escritórios distintos, não uma única planta contínua.
const POD_PALETTE: readonly [string, string][] = [
  ["#cfe4da", "#c4d9cd"],
  ["#e6d3e6", "#dbc6db"],
  ["#cfe0ee", "#c3d5e4"],
  ["#f0ddc8", "#e6d0b6"],
  ["#e2ddc9", "#d7d1b6"],
  ["#d9e0c9", "#cdd5b8"],
  ["#f0d8de", "#e6cbd2"],
  ["#d3d9ec", "#c8cfe1"],
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
const ZONE_GAP = 1.6;
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
    floorA: C.officeA,
    floorB: C.officeB,
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
    floorA: C.loungeA,
    floorB: C.loungeB,
  });
  cursorX += SOCIAL_W + ZONE_GAP;

  // 3) uma sala própria por repartição, cada uma com sua cor de piso
  let paletteIndex = 0;
  depts.forEach((dept, i) => {
    const size = deptSizes[i];
    const zoneIndex = zones.length;
    const isShared = dept.groupId === "__shared__";
    const floor = isShared ? ([C.podA, C.podB] as const) : POD_PALETTE[paletteIndex % POD_PALETTE.length];
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
    floorA: "#f2e4c9",
    floorB: "#e8d7b3",
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
    floorA: C.meetA,
    floorB: C.meetB,
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
    floorA: "#dee6d6",
    floorB: "#d2dbc8",
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

// Mensageiro: figura de pé, vista de trás, com as pernas alternando — quem
// carrega a demanda de uma repartição para outra pelo corredor. A cor da
// camisa é a do cargo de destino, então já anuncia quem vai recebê-la.
function drawWalker(ctx: CanvasRenderingContext2D, x: number, y: number, shirt: string, t: number) {
  const legPhase = Math.floor(t * 6) % 2;

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#26221d";
  if (legPhase === 0) {
    ctx.fillRect(x - 6, y - 11, 4, 10);
    ctx.fillRect(x + 2, y - 9, 4, 8);
  } else {
    ctx.fillRect(x - 6, y - 9, 4, 8);
    ctx.fillRect(x + 2, y - 11, 4, 10);
  }

  ctx.fillStyle = shirt;
  ctx.fillRect(x - 8, y - 23, 16, 13);

  ctx.fillStyle = "#2b1a0e";
  ctx.fillRect(x - 6, y - 31, 12, 9);

  // pastinha/envelope com a demanda, na mão
  ctx.fillStyle = C.courier;
  ctx.fillRect(x + 6, y - 20, 8, 10);
  ctx.fillStyle = "#b45309";
  ctx.fillRect(x + 6, y - 20, 8, 2);
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
      checker(ctx, 0, 0, plan.totalW, plan.totalH, C.circA, C.circB);

      for (const z of plan.zones) {
        checker(ctx, z.x, z.y, z.w, z.h, z.floorA, z.floorB);
      }

      // Toda sala é uma sala de verdade: paredes nos 4 lados, com a porta
      // no topo (voltada para o corredor) e a parede de fundo sólida —
      // é isso que faz o andar ler como um conjunto de escritórios, não
      // uma única planta contínua.
      for (const z of plan.zones) {
        wallV(ctx, z.x, z.y, z.h);
        wallV(ctx, z.x + z.w - 0.45, z.y, z.h);
        wallH(ctx, z.x, z.y + z.h - 0.5, z.w);
        const doorHalf = 1;
        wallH(ctx, z.x, z.y, z.doorX - doorHalf - z.x);
        wallH(ctx, z.doorX + doorHalf, z.y, z.x + z.w - (z.doorX + doorHalf));
      }

      // Decoração da sala da chefia, contra a parede de fundo
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
        desk(ctx, seat.deskX, seat.deskY, seed);
        seatedPerson(ctx, seat.deskX, seat.deskY + 1.6, agent.color, seed, agent.id === visualActiveId, t);
      }

      if (walkerPos) drawWalker(ctx, walkerPos.x * TILE, walkerPos.y * TILE, walkerColor, t);
    };

    let raf = 0;
    const render = (ms: number) => {
      const t = ms / 1000;
      const walk = walkRef.current;
      let walkerPos: Point | null = null;
      if (walk) {
        const p = walkPosition(walk, ms - walk.startTs);
        walkerPos = { x: p.x, y: p.y };
        if (p.done) walkRef.current = null;
      }

      drawScene(t, walkerPos, walk?.color ?? "#f59e0b");

      // HOLOFOTE: escurece o andar inteiro e reacende só a área ativa —
      // um círculo seguindo o mensageiro em trânsito, ou o retângulo da
      // zona quando ninguém está andando.
      if (walkerPos) {
        ctx.fillStyle = "rgba(28,24,18,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.beginPath();
        ctx.arc(walkerPos.x * TILE, walkerPos.y * TILE, 3.4 * TILE, 0, Math.PI * 2);
        ctx.clip();
        drawScene(t, walkerPos, walk?.color ?? "#f59e0b");
        ctx.restore();
      } else if (activeZone) {
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
        drawScene(t, null, "#f59e0b");
        ctx.restore();

        ctx.strokeStyle = "#fdf6e6";
        ctx.lineWidth = 5;
        roundRectPath(ctx, rx, ry, rw, rh, 14);
        ctx.stroke();
      }

      if (visualActiveId || walkerPos) raf = requestAnimationFrame(render);
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
    <div className="absolute inset-0 flex items-center justify-center bg-[#171b17] p-4 animate-fade-in">
      <div
        className="relative max-w-full max-h-full overflow-auto rounded-2xl border-[6px] border-[#8a7a5c] shadow-2xl"
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
                <span className="bg-[#1f2430]/90 text-stone-100 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-white/15 shadow whitespace-nowrap block truncate">
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
                  <span className={`text-[8px] leading-tight pl-2.5 ${isActive ? "text-slate-800" : "text-stone-400"}`}>
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
