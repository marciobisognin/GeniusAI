// Moldura pixel art de cada sala/bloco: as decorações desenhadas em canvas
// por tipo de zona (Gabinete, ilhas de mesa, Estar, Copa, Reunião, Zen) e
// os dois overlays DOM que dão o "cabeçalho de diretoria" — a moldura
// colorida numerada por Pró-Reitoria/Diretoria real (PixelRoomBlockFrame)
// e a faixa com o nome da sala (PixelRoomBanner).
import type { Block, Zone } from "../../types/organogram";
import {
  DESK_COL_W,
  DESK_ROW_H,
  ZONE_PAD_BOTTOM,
  ZONE_PAD_TOP,
  ZONE_PAD_X,
} from "./planBuilder";
import {
  cushion,
  darken,
  divider,
  emptyChair,
  frame,
  plant,
  pond,
  roundTable,
  shelf,
  sofa,
  TILE,
} from "./canvasPrimitives";

// Decoração da sala da chefia — sem paredes: o piso lilás e a mobília mais
// completa (quadros, sofá, estante) já bastam para dizer "essa sala é
// diferente", como nas salas de referência, que nunca fecham uma sala com
// paredes de verdade — só cor de piso e móveis marcam o limite, para o
// andar inteiro ler como um único prédio contínuo, não uma fileira de
// caixas separadas.
export function drawOfficeRoom(ctx: CanvasRenderingContext2D, z: Zone) {
  frame(ctx, z.x + 3.2, z.y + z.h - 5.6, "#9fd0c4");
  frame(ctx, z.x + z.w - 3.2, z.y + z.h - 5.6, "#e0c08a");
  sofa(ctx, z.x + z.w / 2, z.y + z.h - 3.4, true);
  shelf(ctx, z.x + 2.2, z.y + z.h - 2.2);
  plant(ctx, z.x + 1.3, z.y + 2.2);
  plant(ctx, z.x + z.w - 1.3, z.y + 2.2);
}

// Ilhas de mesas: divisórias baixas entre as estações
export function drawPodRoom(ctx: CanvasRenderingContext2D, z: Zone) {
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
export function drawLoungeRoom(ctx: CanvasRenderingContext2D, z: Zone) {
  sofa(ctx, z.x + z.w / 2, z.y + z.h - 3.4, true);
  sofa(ctx, z.x + 1.9, z.y + z.h - 7.2, false);
  roundTable(ctx, z.x + z.w / 2, z.y + z.h - 5.8, 22);
  shelf(ctx, z.x + z.w / 2, z.y + z.h - 1.2);
  plant(ctx, z.x + z.w - 1.4, z.y + z.h - 2.6);
  plant(ctx, z.x + z.w - 1.4, z.y + z.h - 7.6);
}

// Copa — café e mesinhas para uma pausa entre uma repartição e outra
export function drawBreakRoom(ctx: CanvasRenderingContext2D, z: Zone) {
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
export function drawMeetingRoom(ctx: CanvasRenderingContext2D, z: Zone) {
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

// Zen — cantinho de descompressão: almofadas em volta de uma fonte, com
// bem menos móveis que as outras salas de propósito
export function drawZenRoom(ctx: CanvasRenderingContext2D, z: Zone) {
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

// ------------------------ overlays DOM (React) ------------------------------

/** Moldura colorida + número + nome da Pró-Reitoria/Diretoria real — o
 * "cabeçalho de diretoria" pedido, envolvendo uma ou mais salas da mesma
 * repartição, como nos organogramas de referência. */
export function PixelRoomBlockFrame({ block, dimmed }: { block: Block; dimmed: boolean }) {
  return (
    <div
      className={`absolute z-10 pointer-events-none rounded-2xl transition-opacity duration-300 ${
        dimmed ? "opacity-30" : "opacity-100"
      }`}
      style={{
        left: block.x * TILE - 8,
        top: block.y * TILE - 28,
        width: block.w * TILE + 16,
        height: block.h * TILE + 36,
        border: `3px solid ${block.color}`,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
      }}
    >
      <div className="absolute -top-[13px] left-3 flex items-center gap-1.5">
        <span
          className="flex items-center justify-center w-[22px] h-[22px] rounded-full text-[11px] font-extrabold text-white shadow"
          style={{ background: block.color }}
        >
          {block.index}
        </span>
        <span
          className="text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-[3px] rounded-full text-white shadow whitespace-nowrap"
          style={{ background: block.color }}
        >
          {block.label}
        </span>
      </div>
    </div>
  );
}

/** Faixa com o nome real da repartição, no topo de cada sala — na cor do
 * próprio carpete, só que mais escura. Salas que já pertencem a um bloco
 * numerado não precisam dela (o cabeçalho do bloco já diz qual é a
 * repartição) — ver o filtro em OfficeCanvas.tsx. */
export function PixelRoomBanner({ zone, dimmed }: { zone: Zone; dimmed: boolean }) {
  if (!zone.label) return null;
  return (
    <div
      className={`absolute z-20 pointer-events-none transition-opacity duration-300 ${
        dimmed ? "opacity-25" : "opacity-100"
      }`}
      style={{ left: zone.x * TILE, top: zone.y * TILE, width: zone.w * TILE }}
    >
      <div
        className="text-stone-50 text-[10px] font-bold uppercase tracking-wide text-center px-2 py-[5px] rounded-b-lg shadow-md truncate"
        style={{ background: darken(zone.floorA, 0.62) }}
      >
        {zone.label}
      </div>
    </div>
  );
}
