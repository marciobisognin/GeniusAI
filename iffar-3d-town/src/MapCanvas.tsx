import { useEffect, useMemo, useRef } from "react";
import { RS_OUTLINE, cityKeyFromName } from "./geo";

// ---------------------------------------------------------------------------
// MAPA DO RS — "VALE CORDIAL" (DIORAMA COZY EM PIXEL ART)
//
// O estado é pintado tile a tile a partir do contorno real do IBGE
// (point-in-polygon pré-calculado), no estilo de diorama acolhedor de jogo
// indie (Stardew Valley/Eastward): o terreno é um prado verde com borda
// creme arredondada e sombra suave, como se estivesse sobre uma mesa —
// nada de oceano; a Lagoa dos Patos vira só um rio-fita azul-claro na
// reentrância litorânea real do contorno. Bosques (tufos de círculos) e
// morros (realce radial) decoram o interior. Estradinhas de terra
// pontilhadas ligam a Reitoria a cada campus. A Reitoria e os 13 campi são
// casinhas fofas (parede clara, telhado terracota, porta verde) na
// coordenada geográfica real. Quando uma demanda está num campus, uma
// trilha em destaque (mais grossa, cor de acento) marca o trajeto
// Reitoria -> campus por cima das estradinhas fixas.
//
// O terreno é rasterizado UMA vez num canvas offscreen; o loop de animação
// (limitado a ~10fps) só recompõe terreno + rota + casinhas.
// ---------------------------------------------------------------------------

interface MapLocation {
  id: string;
  nome: string;
  pos: [number, number];
  primaryAgentId: string;
}

const PX = 8; // pixels de canvas por unidade de mapa
const PAD = 5; // folga (em unidades) em volta do estado
const STEP = 0.5; // resolução do terreno (meia unidade -> costa menos serrilhada)

const B = (() => {
  const xs = RS_OUTLINE.map((p) => p[0]);
  const zs = RS_OUTLINE.map((p) => p[1]);
  const minX = Math.floor(Math.min(...xs)) - PAD;
  const maxX = Math.ceil(Math.max(...xs)) + PAD;
  const minZ = Math.floor(Math.min(...zs)) - PAD;
  const maxZ = Math.ceil(Math.max(...zs)) + PAD;
  return { minX, minZ, w: maxX - minX, h: maxZ - minZ };
})();

// 93x88 unidades a 8px -> 744x704; com o zoom de scale(4) a camada composta
// fica em ~2976px, abaixo do limite de 4096px de textura de GPU (lição do
// artefato visual corrigido no redesenho anterior).
const CANVAS_W = B.w * PX;
const CANVAS_H = B.h * PX;

function toPx([x, z]: [number, number]): [number, number] {
  return [(x - B.minX) * PX, (z - B.minZ) * PX];
}

function pointInRS(x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = RS_OUTLINE.length - 1; i < RS_OUTLINE.length; j = i++) {
    const [xi, zi] = RS_OUTLINE[i];
    const [xj, zj] = RS_OUTLINE[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// ------------------------- RÓTULOS SEM SOBREPOSIÇÃO -------------------------
//
// Perto de Santa Maria, várias unidades caem a poucos pixels umas das
// outras — uma simples alternância "acima/abaixo" não é suficiente (foi
// exatamente essa aglomeração que motivou o redesenho do mapa). Em vez
// disso, cada rótulo tenta uma lista de posições candidatas ao redor do
// próprio marcador, em raios crescentes, e fica na primeira que não
// colide com nenhum rótulo já posicionado nem com a casinha de ninguém.
type Box = [number, number, number, number];

function boxAt(cx: number, cy: number, w: number, h: number): Box {
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
}

function boxesOverlap(a: Box, b: Box, pad = 4): boolean {
  return !(a[2] + pad < b[0] || b[2] + pad < a[0] || a[3] + pad < b[1] || b[3] + pad < a[1]);
}

const LABEL_H = 19;
const LABEL_CANDIDATES: [number, number][] = [
  [0, -34],
  [0, 36],
  [0, -52],
  [0, 56],
  [42, -26],
  [-42, -26],
  [42, 30],
  [-42, 30],
  [58, -42],
  [-58, -42],
  [58, 44],
  [-58, 44],
  [0, -74],
  [0, 78],
  [74, 4],
  [-74, 4],
  [86, -58],
  [-86, -58],
  [86, 60],
  [-86, 60],
];

function labelWidth(name: string): number {
  return Math.max(52, name.length * 5.7 + 16);
}

interface LabelLayout {
  left: number;
  top: number;
}

function placeLabels(
  locations: MapLocation[],
  toPxFn: (p: [number, number]) => [number, number],
): Map<string, LabelLayout> {
  const markerBoxes: Box[] = locations.map((l) => {
    const [mx, my] = toPxFn(l.pos);
    return boxAt(mx, my - 24, 46, 54);
  });

  const order = [...locations].sort((a, b) => {
    if (a.id === "1.1") return -1;
    if (b.id === "1.1") return 1;
    const da = Math.min(
      ...locations.filter((o) => o.id !== a.id).map((o) => Math.hypot(o.pos[0] - a.pos[0], o.pos[1] - a.pos[1])),
    );
    const db = Math.min(
      ...locations.filter((o) => o.id !== b.id).map((o) => Math.hypot(o.pos[0] - b.pos[0], o.pos[1] - b.pos[1])),
    );
    return da - db;
  });

  const placed: Box[] = [...markerBoxes];
  const result = new Map<string, LabelLayout>();

  for (const loc of order) {
    const [mx, my] = toPxFn(loc.pos);
    const w = labelWidth(cityKeyFromName(loc.nome));
    let chosen: Box | null = null;
    for (const [dx, dy] of LABEL_CANDIDATES) {
      const cx = mx + dx;
      const cy = my + dy;
      if (cx - w / 2 < 4 || cx + w / 2 > CANVAS_W - 4 || cy - LABEL_H / 2 < 4 || cy + LABEL_H / 2 > CANVAS_H - 4) {
        continue;
      }
      const b = boxAt(cx, cy, w, LABEL_H);
      if (placed.some((ob) => boxesOverlap(b, ob))) continue;
      chosen = b;
      break;
    }
    if (!chosen) {
      const [dx, dy] = LABEL_CANDIDATES[0];
      chosen = boxAt(mx + dx, my + dy, w, LABEL_H);
    }
    placed.push(chosen);
    result.set(loc.id, { left: (chosen[0] + chosen[2]) / 2, top: (chosen[1] + chosen[3]) / 2 });
  }

  return result;
}

// Paleta "Vale Cordial" — diorama cozy, quente e acolhedor.
const M = {
  table: "#fdf1de", // "mesa"/céu por trás do diorama, onde antes havia oceano
  tableShadow: "rgba(122,90,58,0.28)", // sombra de contato do relevo na mesa
  landA: "#9cc47a",
  landB: "#93bd72",
  border: "#f7ecd1", // borda creme arredondada do diorama
  borderLine: "#6f9a52",
  hillHi: "#c3e2a0",
  hillLo: "#8fbc6a",
  forestA: "#5c9a52",
  forestB: "#6fae60",
  trunk: "#8a6a45",
  river: "#8fc7d9",
  riverEdge: "#f7ecd1",
  road: "#d9b98a",
  wall: "#f2ded0",
  wallEdge: "#5b4a3a",
  roof: "#d97b5a",
  door: "#3f8f5a",
  flag: "#e8c05a",
  routeAccent: "#c1553a",
  ringAccent: "#c1553a",
} as const;

interface Terrain {
  cols: number;
  rows: number;
  land: Uint8Array;
}

function buildTerrain(): Terrain {
  const cols = Math.round(B.w / STEP);
  const rows = Math.round(B.h / STEP);
  const land = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = B.minX + (c + 0.5) * STEP;
      const z = B.minZ + (r + 0.5) * STEP;
      land[r * cols + c] = pointInRS(x, z) ? 1 : 0;
    }
  }
  return { cols, rows, land };
}

// Caminho do contorno real do RS em pixels de canvas — usado tanto para a
// borda arredondada do diorama quanto para recortar (clip) o preenchimento
// do prado, o que dá um litoral preciso sem depender da grade de tiles.
function rsOutlinePath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  RS_OUTLINE.forEach(([x, z], i) => {
    const [px, py] = toPx([x, z]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function drawHouse(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  opts: { big: boolean; active: boolean; t: number },
) {
  const s = opts.big ? 1.35 : 1;
  const w = 30 * s;
  const wh = 16 * s; // altura da parede
  const rh = 14 * s; // altura do telhado
  const left = bx - w / 2;
  const base = by;

  if (opts.active) {
    const pulse = 22 * s + Math.sin(opts.t * 4) * 3;
    ctx.strokeStyle = "rgba(193,85,58,0.75)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, base - 4, pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  // sombra de contato, ovalada — chão de diorama
  ctx.fillStyle = "rgba(90,66,40,0.24)";
  ctx.beginPath();
  ctx.ellipse(bx, base + 3, w * 0.42, w * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  // parede clara com contorno
  ctx.fillStyle = M.wallEdge;
  ctx.fillRect(left - 2, base - wh - 2, w + 4, wh + 2);
  ctx.fillStyle = M.wall;
  ctx.fillRect(left, base - wh, w, wh);

  // porta verde
  ctx.fillStyle = M.door;
  ctx.fillRect(bx - 4 * s, base - 9 * s, 8 * s, 9 * s);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(bx - 4 * s, base - 9 * s, 8 * s, 2);

  // telhado terracota, com beiral
  ctx.fillStyle = "#b8593d";
  ctx.beginPath();
  ctx.moveTo(left - 5, base - wh + 2);
  ctx.lineTo(bx, base - wh - rh);
  ctx.lineTo(left + w + 5, base - wh + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = M.roof;
  ctx.beginPath();
  ctx.moveTo(left - 5, base - wh);
  ctx.lineTo(bx, base - wh - rh - 2);
  ctx.lineTo(left + w + 5, base - wh);
  ctx.closePath();
  ctx.fill();

  // bandeirinha: fixa na Reitoria, animada no prédio ativo
  if (opts.big || opts.active) {
    const px0 = bx + (opts.big ? 3 : 2);
    const py0 = base - wh - rh - 2;
    ctx.fillStyle = M.wallEdge;
    ctx.fillRect(px0, py0 - 11, 2, 11);
    const wave = opts.active ? Math.sin(opts.t * 6) * 2 : 0;
    ctx.fillStyle = M.flag;
    ctx.beginPath();
    ctx.moveTo(px0 + 2, py0 - 11);
    ctx.lineTo(px0 + 11, py0 - 9 + wave);
    ctx.lineTo(px0 + 2, py0 - 6);
    ctx.closePath();
    ctx.fill();
  }
}

export const MapCanvas = ({
  locations,
  activeLocationId,
  route,
  onSelect,
}: {
  locations: MapLocation[];
  activeLocationId: string | null;
  route: { from: [number, number]; to: [number, number] } | null;
  onSelect: (loc: MapLocation) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrain = useMemo(buildTerrain, []);

  // Decoração (bosques e morros) — determinística por tile e longe dos
  // prédios, para não brotar árvore em cima de campus.
  const decor = useMemo(() => {
    const forest: [number, number][] = [];
    const hills: [number, number][] = [];
    const { cols, rows, land } = terrain;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!land[r * cols + c]) continue;
        const x = B.minX + (c + 0.5) * STEP;
        const z = B.minZ + (r + 0.5) * STEP;
        const nearBuilding = locations.some(
          (l) => Math.abs(l.pos[0] - x) < 4.5 && Math.abs(l.pos[1] - z) < 4.5,
        );
        if (nearBuilding) continue;
        const h = hash01(`d${c},${r}`);
        const [pxx, pxy] = toPx([x, z]);
        if (h > 0.986) forest.push([pxx, pxy]);
        else if (h > 0.965) hills.push([pxx, pxy]);
      }
    }
    return { forest, hills };
  }, [terrain, locations]);

  // Terreno rasterizado uma única vez (offscreen): prado recortado no
  // contorno real do RS, com borda creme arredondada e sombra de contato —
  // um diorama sobre a "mesa", sem oceano.
  const terrainCanvas = useMemo(() => {
    const off = document.createElement("canvas");
    off.width = CANVAS_W;
    off.height = CANVAS_H;
    const ctx = off.getContext("2d")!;
    const ts = STEP * PX;

    ctx.fillStyle = M.table;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // sombra suave do relevo na mesa, por trás da borda
    ctx.save();
    ctx.translate(0, 10);
    rsOutlinePath(ctx);
    ctx.fillStyle = M.tableShadow;
    ctx.fill();
    ctx.restore();

    // borda creme arredondada (papercraft) + contorno fino por dentro
    rsOutlinePath(ctx);
    ctx.lineJoin = "round";
    ctx.strokeStyle = M.border;
    ctx.lineWidth = 15;
    ctx.stroke();

    // prado, recortado com precisão no contorno real (sem serrilhado de tile)
    ctx.save();
    rsOutlinePath(ctx);
    ctx.clip();
    for (let r = 0; r < terrain.rows; r++) {
      for (let c = 0; c < terrain.cols; c++) {
        if (!terrain.land[r * terrain.cols + c]) continue;
        const checker = (Math.floor(c / 2) + Math.floor(r / 2)) % 2 === 0;
        ctx.fillStyle = checker ? M.landA : M.landB;
        ctx.fillRect(c * ts - 2, r * ts - 2, ts + 4, ts + 4);
      }
    }
    // morros: realce radial suave
    for (const [x, y] of decor.hills) {
      const g = ctx.createRadialGradient(x - 8, y - 10, 2, x, y, 30);
      g.addColorStop(0, M.hillHi);
      g.addColorStop(1, M.hillLo);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, 30, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // bosques: aglomerados de círculos, como no diorama
    for (const [x, y] of decor.forest) {
      ctx.fillStyle = M.trunk;
      ctx.fillRect(x - 2, y + 6, 4, 7);
      for (const [dx, dy, r2, col] of [
        [-8, 2, 11, M.forestA],
        [8, 3, 11, M.forestA],
        [0, -7, 13, M.forestB],
      ] as const) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // rio-fita azul-claro na reentrância litorânea real (Lagoa dos Patos)
    const riverPts: [number, number][] = [
      [30.77, 38.15],
      [31.98, 38.71],
      [31.1, 39.13],
      [30.79, 40.19],
    ].map(([x, z]) => toPx([x, z]));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = M.riverEdge;
    ctx.lineWidth = 13;
    ctx.beginPath();
    riverPts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = M.river;
    ctx.lineWidth = 8;
    ctx.beginPath();
    riverPts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.restore();

    return off;
  }, [terrain, decor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const sorted = [...locations].sort((a, b) => a.pos[1] - b.pos[1]);
    const hub = locations.find((l) => l.id === "1.1") ?? null;

    const draw = (t: number) => {
      ctx.drawImage(terrainCanvas, 0, 0);

      // estradinhas de terra, fixas, ligando a Reitoria a cada campus
      if (hub) {
        const [hx, hy] = toPx(hub.pos);
        ctx.lineCap = "round";
        ctx.strokeStyle = M.road;
        ctx.lineWidth = 3.5;
        ctx.setLineDash([1, 9]);
        for (const loc of locations) {
          if (loc.id === hub.id) continue;
          const [lx, ly] = toPx(loc.pos);
          ctx.beginPath();
          ctx.moveTo(hx, hy - 6);
          ctx.lineTo(lx, ly - 6);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // trilha em destaque: trajeto da demanda atual entre dois prédios
      if (route) {
        const [x1, y1] = toPx(route.from);
        const [x2, y2] = toPx(route.to);
        ctx.lineCap = "round";
        ctx.strokeStyle = M.routeAccent;
        ctx.lineWidth = 5;
        ctx.setLineDash([1, 11]);
        ctx.lineDashOffset = -t * 26;
        ctx.beginPath();
        ctx.moveTo(x1, y1 - 8);
        ctx.lineTo(x2, y2 - 8);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const loc of sorted) {
        const [bx, by] = toPx(loc.pos);
        drawHouse(ctx, bx, by, {
          big: loc.id === "1.1",
          active: loc.id === activeLocationId,
          t,
        });
      }
    };

    let raf = 0;
    let lastFrame = -1;
    const loop = (ms: number) => {
      const t = ms / 1000;
      // ~10fps bastam para o tracejado animado e mantêm o custo perto de zero
      const frame = Math.floor(t * 10);
      if (frame !== lastFrame) {
        lastFrame = frame;
        draw(t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [terrain, terrainCanvas, locations, activeLocationId, route]);

  // Posição de cada rótulo, sem sobreposição — ver placeLabels() acima.
  const labelLayout = useMemo(() => placeLabels(locations, toPx), [locations]);

  // Zoom de câmera: origem travada no pixel exato do prédio em foco; ao
  // voltar para a visão geral, mantém a última origem para "sair" do mesmo
  // lugar em que entrou.
  const lastOriginRef = useRef(`${CANVAS_W / 2}px ${CANVAS_H / 2}px`);
  const activeLoc = activeLocationId
    ? (locations.find((l) => l.id === activeLocationId) ?? null)
    : null;
  if (activeLoc) {
    const [ox, oy] = toPx(activeLoc.pos);
    lastOriginRef.current = `${ox}px ${oy - 12}px`;
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Moldura clara fixa (igual à do escritório): o zoom acontece DENTRO
          dela, como uma janela para o diorama. */}
      <div
        className="relative shrink-0 overflow-hidden rounded-2xl border-[6px] border-[#d9c8a8] shadow-2xl"
        style={{ width: CANVAS_W, height: CANVAS_H }}
      >
        <div
          className="absolute inset-0 transition-transform duration-[900ms] ease-in-out"
          style={{
            transform: activeLoc ? "scale(4)" : "scale(1)",
            transformOrigin: lastOriginRef.current,
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ width: CANVAS_W, height: CANVAS_H, imageRendering: "pixelated" }}
          />

          {locations.map((loc) => {
            const [x, y] = toPx(loc.pos);
            const isActive = loc.id === activeLocationId;
            const lp = labelLayout.get(loc.id) ?? { left: x, top: y - 46 };
            return (
              <div key={loc.id}>
                {/* alvo de clique sobre a casinha em si */}
                <button
                  onClick={() => onSelect(loc)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ left: x, top: y - 18, width: 46, height: 58 }}
                  title={loc.nome}
                  aria-label={loc.nome}
                />
                {/* rótulo, posicionado sem sobreposição por placeLabels() */}
                <button
                  onClick={() => onSelect(loc)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  style={{ left: lp.left, top: lp.top }}
                  title={loc.nome}
                >
                  <span
                    className={`text-[8px] font-bold px-1.5 py-px rounded-full border shadow whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-[#c1553a] text-[#fff6e6] border-[#8f3d28]"
                        : "bg-[#fff6e6]/95 text-[#4a3b57] border-[#5b4a6a]/40 group-hover:bg-[#ffe9d6]"
                    }`}
                  >
                    {cityKeyFromName(loc.nome)}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
