// Motor de layout da planta do prédio (Reitoria/campus): a partir da lista
// de agentes reais (vinda de GET /api/org-chart via App.tsx), calcula onde
// cada sala, mesa e bloco numerado fica. Puramente geométrico — nenhuma
// chamada de canvas aqui, ver DeskNode/PixelRoomContainer/CourtyardDecoration
// para o desenho.

import type { Agent, Block, DeptGroup, Plan, Seat, WalkState, Zone } from "../../types/organogram";
import { BLOCK_COLORS, GARDEN_MARGIN, POD_PALETTE } from "./canvasPrimitives";

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

export { ZONE_TOP, ZONE_GAP, DESK_COL_W, DESK_ROW_H, ZONE_PAD_X, ZONE_PAD_TOP, ZONE_PAD_BOTTOM };

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

export const SOCIAL_W = 13;
export const ENTRANCE_W = 16;

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

export function buildPlan(agents: Agent[]): Plan {
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

// --------------------------- MOVIMENTO --------------------------------------

export function buildWalk(from: Seat, to: Seat, zones: Zone[], corridorY: number, color: string): WalkState {
  const fromZone = zones[from.zoneIndex];
  const toZone = zones[to.zoneIndex];
  const path = [
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

export function walkPosition(walk: WalkState, elapsedMs: number) {
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
