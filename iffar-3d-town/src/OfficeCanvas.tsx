import { useEffect, useMemo, useRef, useState } from "react";
import avatarUrl1 from "./assets/office/avatar1.png";
import avatarUrl2 from "./assets/office/avatar2.png";
import avatarUrl3 from "./assets/office/avatar3.png";
import avatarUrl4 from "./assets/office/avatar4.png";
import avatarUrl5 from "./assets/office/avatar5.png";

// Avatares recortados diretamente dos organogramas de referência enviados
// pelo dono do repositório (busto, sem o piso ao redor) — em vez de
// desenhados via código, para a aparência bater com a referência de fato.
// Um número pequeno de pessoas distintas se repete pelo prédio (mesma
// limitação de qualquer spritesheet finito), escolhida por hash do id do
// agente para ser estável entre renders.
const AVATAR_SPRITES = [avatarUrl1, avatarUrl2, avatarUrl3, avatarUrl4, avatarUrl5].map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

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
  deskEdge: "#dcdcd4",
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

// Piso neutro para as salas de repartição — nos organogramas de
// referência, a cor de identidade de cada Pró-Reitoria/Diretoria mora na
// moldura do bloco numerado, não no piso; a sala em si fica num tom claro
// e discreto, quase igual de uma repartição para outra.
const POD_PALETTE: readonly [string, string][] = [
  ["#d9dde2", "#d1d5da"], // cinza-azulado neutro
];

function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// Escurece uma cor hex — usado para tirar o tom do banner de cada sala a
// partir da própria cor do carpete, como as faixas escuras com o nome da
// repartição nos organogramas de referência.
function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * (1 - amt);
  const g = ((n >> 8) & 255) * (1 - amt);
  const b = (n & 255) * (1 - amt);
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

// --------------------------- PLANTA -----------------------------------------

interface Zone {
  kind: "office" | "pod" | "lounge" | "meeting" | "break" | "zen" | "entrance";
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

// Bloco numerado — o agrupamento visual de uma Pró-Reitoria/Diretoria real
// (uma ou mais salas lado a lado), com moldura colorida e número, como nos
// organogramas de referência. Só repartições de fato (não a chefia, nem os
// espaços de convivência, nem "Colegiados e Comissões") ganham número.
interface Block {
  index: number;
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Plan {
  zones: Zone[];
  seats: Seat[];
  blocks: Block[];
  totalW: number;
  totalH: number;
  corridorY: number;
}

// Paleta de molduras dos blocos numerados — uma cor institucional distinta
// por Pró-Reitoria/Diretoria, como nos organogramas de referência (cada
// bloco grande tem sua própria cor de contorno).
const BLOCK_COLORS = ["#2f6b3f", "#2f5a8f", "#8a6a1f", "#6a3f8a", "#8a4a2f", "#2f7a7a"];

// Faixa de jardim ao redor do prédio inteiro (não só na entrada) — grama e
// árvores emolduram o piso de tábua corrida, como nos organogramas de
// referência, em vez do prédio flutuar sozinho no canvas.
const GARDEN_MARGIN = 2.4;

const START_X = 2 + GARDEN_MARGIN;
const START_Y = 2 + GARDEN_MARGIN;
const CORRIDOR_H = 3;
const ZONE_TOP = START_Y + CORRIDOR_H;
const ZONE_GAP = 0.9;
const DESK_COL_W = 6.2;
const DESK_ROW_H = 6.4;
const ZONE_PAD_X = 2.2;
const ZONE_PAD_TOP = 3.4;
const ZONE_PAD_BOTTOM = 2.2;

// Nenhuma sala tem mais que isso de estações: é o que evita a "linha de
// produção" de uma grade densa de mesas — nas salas de referência do
// Gather 2.0, cada cômodo tem no máximo 3-4 pessoas, com chão vazio de
// sobra ao redor. Repartições maiores viram várias salas lado a lado, da
// mesma cor de carpete, em vez de uma sala só lotada.
const CELL_MAX = 4;

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function gridFor(n: number) {
  const cols = Math.max(1, Math.min(2, Math.ceil(Math.sqrt(Math.max(1, n)))));
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
const ENTRANCE_W = 16;

// Cria uma ou mais salas pequenas (no máximo CELL_MAX mesas cada) para um
// grupo de pessoas, todas com a mesma cor de carpete — para que, mesmo
// numa repartição de 12 pessoas, o andar mostre 3 salas de 4, cada uma
// com chão de sobra, em vez de uma sala só apinhada.
function pushCells(
  zones: Zone[],
  seats: Seat[],
  cursorX: { x: number },
  kind: Zone["kind"],
  label: string,
  memberIds: string[],
  agentsById: Map<string, Agent>,
  floor: readonly [string, string],
  rowH: number | null,
) {
  for (const cellIds of chunk(memberIds, CELL_MAX)) {
    const size = zoneSize(cellIds.length);
    const zoneIndex = zones.length;
    const w = size.w;
    const h = rowH ?? size.h;
    const z: Zone = {
      kind,
      x: cursorX.x,
      y: ZONE_TOP,
      w,
      h,
      label,
      agentIds: cellIds,
      doorX: cursorX.x + w / 2,
      floorA: floor[0],
      floorB: floor[1],
    };
    zones.push(z);
    const members = cellIds.map((id) => agentsById.get(id)).filter((a): a is Agent => Boolean(a));
    const topPad = ZONE_PAD_TOP + (h - size.h) / 2;
    placeSeats(members, z, size.cols, topPad, seats, zoneIndex);
    cursorX.x += w + ZONE_GAP;
  }
}

function buildPlan(agents: Agent[]): Plan {
  const { head, depts } = buildDepartments(agents);
  const agentsById = new Map(agents.map((a) => [a.id, a] as const));
  const zones: Zone[] = [];
  const seats: Seat[] = [];
  const cursor = { x: START_X };

  // altura de linha comum: o maior número de fiadas que qualquer sala vai
  // precisar, calculada a partir de células já limitadas a CELL_MAX
  const allSizes = [
    zoneSize(Math.min(head.length || 1, CELL_MAX)),
    ...depts.map((d) => zoneSize(Math.min(d.agentIds.length, CELL_MAX))),
  ];
  const rowH = Math.max(...allSizes.map((s) => s.h), 11);

  // 1) chefia (Gabinete + assessoria direta) — uma ou mais salas lilás
  pushCells(zones, seats, cursor, "office", "Gabinete", head.map((a) => a.id), agentsById, ["#8b90cf", "#9499d6"], rowH);

  // 2) Estar — logo ao lado da chefia, para intercalar sala de trabalho e
  // espaço de convivência, como nos escritórios de referência.
  const loungeX = cursor.x;
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
  cursor.x += SOCIAL_W + ZONE_GAP;

  // 3) uma ou mais salas por repartição, todas com a mesma cor de piso —
  // cada repartição de fato (não a "Colegiados e Comissões" compartilhada)
  // também vira um bloco numerado com moldura colorida, como nos
  // organogramas de referência.
  const blocks: Block[] = [];
  let paletteIndex = 0;
  let blockIndex = 0;
  for (const dept of depts) {
    const isShared = dept.groupId === "__shared__";
    const floor = isShared ? (["#a8aeb2", "#b2b8bc"] as const) : POD_PALETTE[paletteIndex % POD_PALETTE.length];
    if (!isShared) paletteIndex++;
    const blockStartX = cursor.x;
    pushCells(zones, seats, cursor, "pod", dept.groupLabel, dept.agentIds, agentsById, floor, rowH);
    if (!isShared) {
      blockIndex++;
      blocks.push({
        index: blockIndex,
        label: dept.groupLabel,
        color: BLOCK_COLORS[(blockIndex - 1) % BLOCK_COLORS.length],
        x: blockStartX,
        y: ZONE_TOP,
        w: cursor.x - ZONE_GAP - blockStartX,
        h: rowH,
      });
    }
  }

  // 4) Copa — espaço de convivência informal (café, mesas pequenas)
  const breakX = cursor.x;
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
  cursor.x += SOCIAL_W + ZONE_GAP;

  // 5) Reunião
  const meetingX = cursor.x;
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
  cursor.x += SOCIAL_W + ZONE_GAP;

  // 6) Zen — cantinho de descompressão, sempre ao final da fileira
  const zenX = cursor.x;
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
  cursor.x += SOCIAL_W + ZONE_GAP;

  // 7) Entrada — pátio de acesso ao prédio, sempre no fim do corredor:
  // banco, jardineiras e o letreiro de boas-vindas, como no portão de
  // entrada dos organogramas de referência (IFFar — Campus X).
  const entranceX = cursor.x;
  zones.push({
    kind: "entrance",
    x: entranceX,
    y: ZONE_TOP,
    w: ENTRANCE_W,
    h: rowH,
    label: "Entrada",
    agentIds: [],
    doorX: entranceX + ENTRANCE_W / 2,
    floorA: "#c7c2b3",
    floorB: "#bdb8a9",
  });
  cursor.x += ENTRANCE_W + ZONE_GAP;

  return {
    zones,
    seats,
    blocks,
    totalW: cursor.x + 1 + GARDEN_MARGIN,
    totalH: ZONE_TOP + rowH + 2 + GARDEN_MARGIN,
    corridorY: START_Y + CORRIDOR_H / 2,
  };
}

// --------------------------- DESENHO ----------------------------------------

// Gramado ao redor do prédio inteiro — a base sobre a qual o piso de tábua
// corrida "assenta", como o terreno em volta dos organogramas de
// referência. Cobre o canvas inteiro; o piso de madeira é desenhado por
// cima, só na área do prédio propriamente dito.
function grassGround(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#a7c583";
  ctx.fillRect(0, 0, w * TILE, h * TILE);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  const stripeW = 3 * TILE;
  for (let x = 0, i = 0; x < w * TILE; x += stripeW, i++) {
    if (i % 2 === 0) ctx.fillRect(x, 0, stripeW, h * TILE);
  }
}

// Árvore de jardim — a mesma copa em três lóbulos das plantas de vaso do
// escritório, só que direto no chão (com tronco), para o gramado externo.
function tree(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = "rgba(30,50,25,0.2)";
  ctx.beginPath();
  ctx.ellipse(x, y + 7, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(x - 2, y - 4, 4, 11);
  ctx.fillStyle = C.leafDark;
  ctx.beginPath();
  ctx.arc(x - 7, y - 11, 8, 0, Math.PI * 2);
  ctx.arc(x + 7, y - 11, 8, 0, Math.PI * 2);
  ctx.arc(x, y - 19, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.leaf;
  ctx.beginPath();
  ctx.arc(x - 6, y - 12, 6, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 12, 6, 0, Math.PI * 2);
  ctx.arc(x, y - 20, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.leafHi;
  ctx.beginPath();
  ctx.arc(x - 1.5, y - 21, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

// Piso de tábua corrida do prédio propriamente dito: creme quente com
// juntas em tijolo (fiadas deslocadas), exatamente como o chão de
// circulação do vídeo — desenhado só dentro do footprint do prédio
// (x0,y0,w,h), com o gramado por baixo/ao redor.
function woodFloor(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  const px = x0 * TILE;
  const py = y0 * TILE;
  ctx.fillStyle = C.floor;
  ctx.fillRect(px, py, w * TILE, h * TILE);

  const plankH = 1.15 * TILE;
  const plankW = 11 * TILE;
  const rows = Math.ceil((h * TILE) / plankH);
  for (let r = 0; r < rows; r++) {
    const y = py + r * plankH;
    // junta entre fiadas: fininha e de baixo contraste, só o suficiente
    // para o olho ler "tábua corrida" sem virar uma grade
    ctx.fillStyle = C.floorSeam2;
    ctx.fillRect(px, y, w * TILE, 1);
    // topos de tábua, deslocados a cada fiada
    const offset = ((r % 3) * plankW) / 3;
    ctx.fillStyle = C.floorSeam;
    for (let x = px + offset; x < px + w * TILE; x += plankW) {
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

// Banco de praça de madeira, para o pátio de entrada.
function bench(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = "rgba(60,52,40,0.16)";
  ctx.beginPath();
  ctx.ellipse(x, y + 7, 17, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(x - 12, y + 1, 3, 7);
  ctx.fillRect(x + 9, y + 1, 3, 7);
  roundRectPath(ctx, x - 16, y - 5, 32, 8, 2);
  ctx.fill();
  ctx.fillStyle = C.wood;
  roundRectPath(ctx, x - 16, y - 7, 32, 5, 2);
  ctx.fill();
}

// Letreiro de boas-vindas do pátio de entrada — a mesma assinatura visual
// dos organogramas de referência (faixa verde-institucional com
// "BEM-VINDO(A)!" e o nome do prédio), sempre no fim do corredor.
function welcomeSign(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, title: string) {
  const x = cx * TILE;
  const y = cy * TILE;
  const pw = w * TILE - 24;
  const ph = 2.9 * TILE;

  ctx.fillStyle = "rgba(60,52,40,0.18)";
  roundRectPath(ctx, x - pw / 2, y - ph / 2 + 4, pw, ph, 10);
  ctx.fill();

  // dois postes
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(x - pw / 2 + 6, y + ph / 2 - 6, 6, 16);
  ctx.fillRect(x + pw / 2 - 12, y + ph / 2 - 6, 6, 16);

  ctx.fillStyle = "#2f5233";
  roundRectPath(ctx, x - pw / 2, y - ph / 2, pw, ph, 10);
  ctx.fill();
  ctx.strokeStyle = "#e7dcc0";
  ctx.lineWidth = 3;
  roundRectPath(ctx, x - pw / 2 + 3, y - ph / 2 + 3, pw - 6, ph - 6, 8);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f2ead2";
  ctx.font = "bold 15px monospace";
  ctx.fillText("BEM-VINDO(A)!", x, y - ph / 2 + 18);
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = "#cfe4cb";
  ctx.fillText("IFFar", x, y);
  ctx.font = "10px monospace";
  ctx.fillStyle = "#e7dcc0";
  const maxChars = Math.floor(pw / 6.2);
  const shown = title.length > maxChars ? title.slice(0, maxChars - 1) + "…" : title;
  ctx.fillText(shown, x, y + ph / 2 - 16);
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

// Estação de trabalho: um tampo de madeira simples com um único monitor
// centralizado (a pessoa senta atrás, de frente, com o rosto acima da
// tela) — mais perto da mesa única dos organogramas de referência do que
// da baia dupla-monitor de antes.
function desk(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number, t: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  const w = 3.3 * TILE;
  const h = 1.35 * TILE;
  const left = x - w / 2;
  const top = y - h / 2;

  const accent = DESK_ACCENTS[Math.floor(seed * DESK_ACCENTS.length) % DESK_ACCENTS.length];
  const isWood = accent === C.deskWood;

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

  // monitor único, centralizado — o rosto da pessoa fica acima dele
  const s1 = SCREEN_COLORS[Math.floor(seed * 7) % SCREEN_COLORS.length];
  const monW = 30;
  const monH = 20;
  const monTop = top - monH + 6;
  ctx.fillStyle = C.screenFrame;
  roundRectPath(ctx, x - monW / 2, monTop, monW, monH, 2);
  ctx.fill();
  ctx.fillStyle = s1;
  ctx.fillRect(x - monW / 2 + 2, monTop + 2, monW - 4, monH - 6);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(x - monW / 2 + 4, monTop + 4, monW - 10, 2);
  ctx.fillRect(x - monW / 2 + 4, monTop + 8, monW - 6, 2);
  if (Math.floor(t * 1.6 + seed * 10) % 2 === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(x + monW / 2 - 6, monTop + monH - 6, 2, 2);
  }
  ctx.fillStyle = C.screenFrame;
  ctx.fillRect(x - 3, monTop + monH - 2, 6, 6);

  // teclado + mouse, centralizados na borda da frente do tampo
  ctx.fillStyle = "#ececea";
  roundRectPath(ctx, x - 16, top + h - 9, 26, 7, 2);
  ctx.fill();
  ctx.fillStyle = "#c8c8c4";
  ctx.fillRect(x - 14, top + h - 7, 22, 3);
  ctx.fillStyle = "#ececea";
  ctx.beginPath();
  ctx.ellipse(x + 15, top + h - 5, 3.2, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // objeto pessoal — cada mesa é um pouco diferente
  const k = Math.floor(seed * 4) % 4;
  const ox = left + w - 12;
  const oy = top + h - 10;
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

// Pessoa sentada vista DE FRENTE — cabeça, cabelo e rosto simples, tronco
// na cor do cargo com braços curtos, como os avatares chibi dos
// organogramas de referência. É desenhada ANTES da mesa (que fica na
// frente, escondendo a parte de baixo do tronco), para ler como alguém
// sentado atrás do próprio tampo, olhando para quem está vendo o prédio.
function seatedPerson(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  _shirt: string,
  seed: number,
  active: boolean,
  t: number,
) {
  const x = cx * TILE;
  // respiração de fundo para todos + um aceno de cabeça mais marcado para
  // quem está resolvendo a demanda agora
  const idle = Math.sin(t * 1.5 + seed * 6.28) * 0.5;
  const bob = active ? Math.sin(t * 5) * 1.4 : idle;
  const y = cy * TILE + bob;

  // sombra de contato
  ctx.fillStyle = "rgba(60,52,40,0.14)";
  ctx.beginPath();
  ctx.ellipse(x, y + 21, 14, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // busto recortado do organograma de referência — um pequeno elenco de
  // pessoas distintas se repete pelo prédio, escolhido pelo seed do agente
  const img = AVATAR_SPRITES[Math.floor(seed * AVATAR_SPRITES.length) % AVATAR_SPRITES.length];
  if (img.complete && img.naturalWidth > 0) {
    const scale = 1.85;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, x - w / 2, y - h + 8, w, h);
  }
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
  const [birdsEye, setBirdsEye] = useState(false);

  // Proximidade dinâmica: acenar mostra um emoji flutuando sobre a mesa e,
  // logo depois, um cartão "fulano acenou de volta" — como no vídeo, quando
  // dois avatares se aproximam.
  const [waveId, setWaveId] = useState<string | null>(null);
  const [waveAck, setWaveAck] = useState<{ id: string; name: string } | null>(null);
  const waveTimers = useRef<{ wave?: ReturnType<typeof setTimeout>; ack?: ReturnType<typeof setTimeout> }>({});

  const handleWave = (agent: Agent) => {
    clearTimeout(waveTimers.current.wave);
    clearTimeout(waveTimers.current.ack);
    setWaveAck(null);
    setWaveId(agent.id);
    waveTimers.current.wave = setTimeout(() => {
      setWaveId(null);
      setWaveAck({ id: agent.id, name: agent.name });
      waveTimers.current.ack = setTimeout(() => setWaveAck(null), 2200);
    }, 900);
  };

  useEffect(
    () => () => {
      clearTimeout(waveTimers.current.wave);
      clearTimeout(waveTimers.current.ack);
    },
    [],
  );

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
  const prevPlanRef = useRef(plan);

  useEffect(() => {
    const newSeat = activeAgentId ? (seatById.get(activeAgentId) ?? null) : null;
    // oldSeat.zoneIndex só é válido dentro do `plan` que o produziu — se o
    // prédio mudou entre um render e outro (agents/plan trocaram antes de
    // officeVisible cortar a cena), o índice antigo pode não existir mais
    // no plano novo. Nesse caso não há corredor comum para o mensageiro
    // andar: trata como um corte de cena, sem animação de trajeto.
    const samePlan = prevPlanRef.current === plan;
    const oldSeat = samePlan ? prevSeatRef.current : null;
    prevSeatRef.current = newSeat;
    prevPlanRef.current = plan;

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
      grassGround(ctx, plan.totalW, plan.totalH);
      woodFloor(ctx, GARDEN_MARGIN, GARDEN_MARGIN, plan.totalW - GARDEN_MARGIN * 2, plan.totalH - GARDEN_MARGIN * 2);

      // fileira de árvores emoldurando o prédio pelo alto e pelo pé, como
      // o gramado dos organogramas de referência
      for (let tx = GARDEN_MARGIN * 0.6; tx < plan.totalW - GARDEN_MARGIN * 0.4; tx += 5.5) {
        tree(ctx, tx, GARDEN_MARGIN * 0.5);
        tree(ctx, tx + 2.75, plan.totalH - GARDEN_MARGIN * 0.35);
      }

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

      // Entrada — pátio com bancos, jardineiras e o letreiro de
      // boas-vindas, sempre no fim do corredor (a mesma assinatura visual
      // dos organogramas de referência).
      for (const z of plan.zones) {
        if (z.kind !== "entrance") continue;
        const cx = z.x + z.w / 2;
        welcomeSign(ctx, cx, z.y + z.h - 8.4, z.w, buildingName);
        bench(ctx, z.x + 2.6, z.y + z.h - 2.4);
        bench(ctx, z.x + z.w - 2.6, z.y + z.h - 2.4);
        plant(ctx, z.x + 1.1, z.y + z.h - 5.6);
        plant(ctx, z.x + z.w - 1.1, z.y + z.h - 5.6);
        plant(ctx, z.x + 1.1, z.y + 2.4);
        plant(ctx, z.x + z.w - 1.1, z.y + 2.4);
      }

      // Pessoas sentadas + mesas — a pessoa é desenhada primeiro (atrás),
      // depois a mesa (na frente, escondendo a parte de baixo do tronco),
      // como alguém sentado de frente atrás do próprio tampo.
      for (const seat of plan.seats) {
        const agent = agents.find((a) => a.id === seat.agentId);
        if (!agent) continue;
        const seed = hash01(agent.id);
        seatedPerson(ctx, seat.deskX, seat.deskY - 0.85, agent.color, seed, agent.id === visualActiveId, t);
        desk(ctx, seat.deskX, seat.deskY, seed, t);
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
  }, [plan, agents, visualActiveId, activeZone, buildingName]);

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
      {/* HUD fixo sobre a viewport — não rola junto com o andar, para
          continuar clicável/visível não importa até onde o usuário tenha
          rolado a planta (que pode ser muito mais larga que a tela). */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={() => setBirdsEye((v) => !v)}
          className="bg-[#1f2430] text-emerald-300 font-mono text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/40 shadow-lg whitespace-nowrap hover:bg-[#262c3a] transition-colors"
        >
          {birdsEye ? "🎨 Pixel Art" : "🐦 Visão de Pássaro"}
        </button>
        <div className="bg-[#2f5233] text-[#f2ead2] text-xs font-extrabold uppercase tracking-wide px-4 py-1.5 rounded-full border-2 border-[#e7dcc0]/70 shadow-lg whitespace-nowrap">
          🏛️ Organograma — {buildingName}
        </div>
      </div>

      {waveAck && (
        <div className="absolute top-16 right-6 z-50">
          <div className="flex items-center gap-2 bg-[#12151c]/97 text-stone-100 text-[10px] px-3 py-2 rounded-lg shadow-xl border border-emerald-500/40 font-mono animate-fade-in">
            <span className="text-base">👋</span>
            <div>
              <div className="font-bold">{waveAck.name} acenou de volta</div>
              <div className="text-stone-400 text-[9px]">Agora</div>
            </div>
          </div>
        </div>
      )}

      <div
        className="relative max-w-full max-h-full overflow-auto rounded-2xl border-[6px] border-[#d9c8a8] shadow-2xl"
        style={{ lineHeight: 0 }}
      >
        <div
          className="relative"
          style={{ width: plan.totalW * TILE, height: plan.totalH * TILE }}
          onMouseLeave={() => setHoveredId(null)}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: plan.totalW * TILE,
              height: plan.totalH * TILE,
              imageRendering: "pixelated",
              visibility: birdsEye ? "hidden" : "visible",
            }}
            onMouseMove={(e) => (birdsEye ? undefined : handlePointer(e, false))}
            onClick={(e) => (birdsEye ? undefined : handlePointer(e, true))}
            className="cursor-pointer"
          />

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

          {/* Modo Visão de Pássaro: mapa vetorial simplificado — retângulos
              por área e um círculo colorido por pessoa, como na referência,
              para enxergar de relance onde cada equipe está. */}
          {birdsEye && (
            <div className="absolute inset-0 z-10 bg-[#eef0f2]">
              {plan.zones.map((z, i) => (
                <div
                  key={`be-zone-${i}`}
                  className="absolute rounded-2xl border-2 pointer-events-none transition-colors duration-300"
                  style={{
                    left: z.x * TILE,
                    top: z.y * TILE,
                    width: z.w * TILE,
                    height: z.h * TILE,
                    background: activeZone === z ? "#fef3c7" : "#f6f7f9",
                    borderColor: activeZone === z ? "#f59e0b" : "#dbdfe4",
                  }}
                >
                  {z.label && (
                    <span
                      className="absolute top-1.5 left-2.5 text-[10px] font-bold text-slate-500 truncate max-w-[90%]"
                      style={{ lineHeight: "normal" }}
                    >
                      {z.label}
                    </span>
                  )}
                </div>
              ))}
              {plan.seats.map((seat) => {
                const agent = agents.find((a) => a.id === seat.agentId);
                if (!agent) return null;
                const isActive = agent.id === visualActiveId;
                const size = isActive ? 30 : 20;
                return (
                  <button
                    key={`be-seat-${agent.id}`}
                    onClick={() => onSelectAgent(agent.id)}
                    title={`${agent.name}${agent.cargo ? ` · ${agent.cargo}` : ""}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md cursor-pointer"
                    style={{
                      left: seat.deskX * TILE,
                      top: seat.deskY * TILE,
                      width: size,
                      height: size,
                      background: agent.color,
                      border: isActive ? "3px solid #f59e0b" : "2px solid white",
                    }}
                  >
                    {isActive && (
                      <span className="absolute -inset-1.5 rounded-full border-2 border-amber-400/70 animate-ping" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!birdsEye && (
            <>
              {/* Bloco numerado com moldura colorida por Pró-Reitoria/
                  Diretoria real — a mesma leitura de "1, 2, 3..." dos
                  organogramas de referência, envolvendo uma ou mais salas
                  da mesma repartição. */}
              {plan.blocks.map((b, i) => {
                const dim = Boolean(activeZone && !(activeZone.x >= b.x && activeZone.x < b.x + b.w));
                return (
                  <div
                    key={`block-${i}`}
                    className={`absolute z-10 pointer-events-none rounded-2xl transition-opacity duration-300 ${
                      dim ? "opacity-30" : "opacity-100"
                    }`}
                    style={{
                      left: b.x * TILE - 8,
                      top: b.y * TILE - 28,
                      width: b.w * TILE + 16,
                      height: b.h * TILE + 36,
                      border: `3px solid ${b.color}`,
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
                    }}
                  >
                    <div className="absolute -top-[13px] left-3 flex items-center gap-1.5">
                      <span
                        className="flex items-center justify-center w-[22px] h-[22px] rounded-full text-[11px] font-extrabold text-white shadow"
                        style={{ background: b.color }}
                      >
                        {b.index}
                      </span>
                      <span
                        className="text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-[3px] rounded-full text-white shadow whitespace-nowrap"
                        style={{ background: b.color }}
                      >
                        {b.label}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Faixa com o nome real da repartição, no topo de cada sala —
                  a mesma assinatura visual dos organogramas de referência
                  (banner escuro com o nome do setor), na cor do próprio
                  carpete daquela sala, só que mais escura, para continuar
                  distinguindo uma repartição da outra à primeira vista.
                  Salas que já pertencem a um bloco numerado não repetem o
                  nome — o cabeçalho do bloco já diz qual é a repartição. */}
              {plan.zones.map((z, i) =>
                z.label &&
                z.kind !== "entrance" &&
                !plan.blocks.some((b) => z.x >= b.x && z.x < b.x + b.w) ? (
                  <div
                    key={`zone-${i}`}
                    className={`absolute z-20 pointer-events-none transition-opacity duration-300 ${
                      activeZone && activeZone !== z ? "opacity-25" : "opacity-100"
                    }`}
                    style={{ left: z.x * TILE, top: z.y * TILE, width: z.w * TILE }}
                  >
                    <div
                      className="text-stone-50 text-[10px] font-bold uppercase tracking-wide text-center px-2 py-[5px] rounded-b-lg shadow-md truncate"
                      style={{ background: darken(z.floorA, 0.62) }}
                    >
                      {z.label}
                    </div>
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
                      className={`flex flex-col items-start px-2 py-[3px] rounded-xl shadow-md ${
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
                      <span
                        className={`text-[8px] leading-tight pl-[13px] ${isActive ? "text-slate-800" : "text-stone-400"}`}
                      >
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

              {/* Proximidade dinâmica: emoji de aceno flutuando sobre a mesa
                  de quem recebeu o aceno */}
              {waveId &&
                (() => {
                  const seat = seatById.get(waveId);
                  if (!seat) return null;
                  return (
                    <div
                      className="absolute z-40 -translate-x-1/2 -translate-y-full pointer-events-none animate-bounce"
                      style={{ left: seat.deskX * TILE, top: (seat.deskY - 1.6) * TILE }}
                    >
                      <span className="text-2xl drop-shadow">👋</span>
                    </div>
                  );
                })()}

              {hovered && hoveredSeat && (
                <div
                  className="absolute z-40 -translate-x-1/2 -translate-y-full w-[220px] bg-[#12151c]/97 text-stone-200 text-[10px] px-2.5 py-2 rounded-lg shadow-xl border border-amber-500/40 font-mono"
                  style={{ left: hoveredSeat.deskX * TILE, top: (hoveredSeat.deskY - 1) * TILE }}
                >
                  <div className="font-bold text-amber-400 whitespace-normal">{hovered.name}</div>
                  {hovered.cargo && <div className="text-stone-400">{hovered.cargo}</div>}
                  {hovered.competencia && (
                    <div className="mt-1 text-stone-300 whitespace-normal leading-snug">
                      Art. {hovered.competencia.artigo}
                      {hovered.competencia.resumo ? ` — ${hovered.competencia.resumo.slice(0, 140)}` : ""}
                    </div>
                  )}
                  {/* Proximidade dinâmica: acenar ou ir até a mesa da pessoa,
                      como no vídeo (Wave / Walk Over) */}
                  {hovered.id !== visualActiveId && (
                    <div className="flex gap-1.5 mt-2 pt-2 border-t border-white/15">
                      <button
                        onClick={() => handleWave(hovered)}
                        className="flex-1 min-w-0 whitespace-nowrap bg-white/10 hover:bg-white/20 text-stone-100 text-[9px] font-bold py-1 rounded-md transition-colors"
                      >
                        👋 Acenar
                      </button>
                      <button
                        onClick={() => onSelectAgent(hovered.id)}
                        className="flex-1 min-w-0 whitespace-nowrap bg-amber-500/90 hover:bg-amber-400 text-slate-950 text-[9px] font-bold py-1 rounded-md transition-colors"
                      >
                        🏃 Ir até lá
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
