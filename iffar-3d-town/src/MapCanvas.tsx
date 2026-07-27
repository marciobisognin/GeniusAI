import { useEffect, useMemo, useRef } from "react";
import { RS_OUTLINE, cityKeyFromName } from "./geo";

// ---------------------------------------------------------------------------
// MAPA DO RS EM PIXEL ART (CANVAS) — MESMA LINGUAGEM DOS ESCRITÓRIOS
//
// O estado é pintado tile a tile a partir do contorno real do IBGE
// (point-in-polygon pré-calculado): oceano com faixa de águas rasas e ondas
// animadas na costa, interior em dois tons de verde com tufos de grama e
// arvorezinhas, e a Lagoa dos Patos aparecendo naturalmente como água — a
// restinga litorânea faz parte do contorno. A Reitoria e os 13 campi são
// sprites de prédio (fachada verde, telhado vermelho, janelas acesas) na
// coordenada geográfica real. Quando uma demanda está num campus, uma linha
// pontilhada animada mostra o trajeto Reitoria -> campus sobre o mapa.
//
// O terreno é rasterizado UMA vez num canvas offscreen; o loop de animação
// (limitado a ~10fps) só recompõe terreno + ondas + rota + prédios.
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

// Paleta do mapa — clara e lúdica, harmonizada com a paleta dos escritórios.
const M = {
  water: "#79b7d6",
  waterDeep: "#6cabcc",
  shallow: "#a9d6e8",
  wave: "#eef8fc",
  landA: "#8fc177",
  landB: "#88ba70",
  tuft: "#6ea55c",
  treeLeaf: "#3f8f5a",
  treeLeafHi: "#4fae6c",
  treeTrunk: "#7c4a2d",
  facade: "#2e7d46",
  facadeDark: "#1f5c32",
  roof: "#d9534f",
  roofDark: "#b23f3c",
  window: "#ffe9a8",
  windowFrame: "#1f2430",
  door: "#7c4a2d",
  flag: "#f59e0b",
  routeDark: "#1f2430",
  route: "#f59e0b",
} as const;

interface Terrain {
  cols: number;
  rows: number;
  land: Uint8Array;
  shallowTiles: number[]; // índices (row*cols+col) de água rasa junto à costa
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
  const shallowTiles: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (land[i]) continue;
      const n =
        (c > 0 && land[i - 1]) ||
        (c < cols - 1 && land[i + 1]) ||
        (r > 0 && land[i - cols]) ||
        (r < rows - 1 && land[i + cols]);
      if (n) shallowTiles.push(i);
    }
  }
  return { cols, rows, land, shallowTiles };
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  opts: { big: boolean; active: boolean; t: number },
) {
  const s = opts.big ? 1.35 : 1;
  const w = 36 * s;
  const fh = 20 * s; // altura da fachada
  const rh = 12 * s; // altura do telhado
  const left = bx - w / 2;
  const base = by;

  if (opts.active) {
    const pulse = 24 * s + Math.sin(opts.t * 4) * 3;
    ctx.strokeStyle = "rgba(245,158,11,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, base - 6, pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  // sombra no chão
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(left + 3, base - 3, w, 6);

  // fachada verde com contorno escuro
  ctx.fillStyle = M.facadeDark;
  ctx.fillRect(left - 2, base - fh - 2, w + 4, fh + 2);
  ctx.fillStyle = M.facade;
  ctx.fillRect(left, base - fh, w, fh);

  // janelas acesas (2 fileiras x 3 colunas)
  const winW = 5 * s;
  const winH = 5 * s;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = left + (4 + col * 11) * s;
      const wy = base - fh + (3 + row * 9) * s;
      ctx.fillStyle = M.windowFrame;
      ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
      ctx.fillStyle = M.window;
      ctx.fillRect(wx, wy, winW, winH);
    }
  }

  // porta
  ctx.fillStyle = M.door;
  ctx.fillRect(bx - 3 * s, base - 8 * s, 6 * s, 8 * s);

  // telhado vermelho em duas faixas, com beiral
  ctx.fillStyle = M.roofDark;
  ctx.fillRect(left - 4, base - fh - rh * 0.45 - 2, w + 8, rh * 0.45 + 2);
  ctx.fillStyle = M.roof;
  ctx.beginPath();
  ctx.moveTo(left - 4, base - fh - rh * 0.45);
  ctx.lineTo(bx, base - fh - rh - 4);
  ctx.lineTo(left + w + 4, base - fh - rh * 0.45);
  ctx.closePath();
  ctx.fill();

  // bandeira: fixa na Reitoria, animada no prédio ativo
  if (opts.big || opts.active) {
    const px0 = bx + (opts.big ? 10 : 8);
    const py0 = base - fh - rh - 4;
    ctx.fillStyle = M.windowFrame;
    ctx.fillRect(px0, py0 - 12, 2, 12);
    const wave = opts.active ? Math.sin(opts.t * 6) * 2 : 0;
    ctx.fillStyle = M.flag;
    ctx.beginPath();
    ctx.moveTo(px0 + 2, py0 - 12);
    ctx.lineTo(px0 + 12, py0 - 10 + wave);
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

  // Decoração (tufos de grama e árvores) — determinística por tile e longe
  // dos prédios, para não brotar árvore em cima de campus.
  const decor = useMemo(() => {
    const tufts: [number, number][] = [];
    const trees: [number, number][] = [];
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
        if (h > 0.993) trees.push([pxx, pxy]);
        else if (h > 0.95) tufts.push([pxx, pxy]);
      }
    }
    return { tufts, trees };
  }, [terrain, locations]);

  // Terreno rasterizado uma única vez (offscreen).
  const terrainCanvas = useMemo(() => {
    const off = document.createElement("canvas");
    off.width = CANVAS_W;
    off.height = CANVAS_H;
    const ctx = off.getContext("2d")!;
    const { cols, rows, land, shallowTiles } = terrain;
    const ts = STEP * PX;

    // água sólida com salpicos discretos — um tabuleiro de dois azuis lia
    // como "fundo transparente de PNG", não como oceano
    ctx.fillStyle = M.water;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = M.waterDeep;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (land[r * cols + c]) continue;
        if (hash01(`w${c},${r}`) > 0.94) ctx.fillRect(c * ts, r * ts + ts / 2, ts, 1.5);
      }
    }
    for (const i of shallowTiles) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      ctx.fillStyle = M.shallow;
      ctx.fillRect(c * ts, r * ts, ts, ts);
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!land[r * cols + c]) continue;
        const checker = (Math.floor(c / 2) + Math.floor(r / 2)) % 2 === 0;
        ctx.fillStyle = checker ? M.landA : M.landB;
        ctx.fillRect(c * ts, r * ts, ts, ts);
      }
    }
    // tufos de grama
    ctx.fillStyle = M.tuft;
    for (const [x, y] of decor.tufts) {
      ctx.fillRect(x - 2, y, 2, 2);
      ctx.fillRect(x + 1, y - 1, 2, 2);
    }
    // arvorezinhas
    for (const [x, y] of decor.trees) {
      ctx.fillStyle = M.treeTrunk;
      ctx.fillRect(x - 1, y, 3, 4);
      ctx.fillStyle = M.treeLeaf;
      ctx.fillRect(x - 5, y - 8, 10, 9);
      ctx.fillStyle = M.treeLeafHi;
      ctx.fillRect(x - 3, y - 10, 6, 4);
    }
    return off;
  }, [terrain, decor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const sorted = [...locations].sort((a, b) => a.pos[1] - b.pos[1]);
    const ts = STEP * PX;
    const { cols } = terrain;

    const draw = (t: number) => {
      ctx.drawImage(terrainCanvas, 0, 0);

      // ondas animadas na faixa de águas rasas
      ctx.fillStyle = M.wave;
      const phase = Math.floor(t * 2);
      for (let k = 0; k < terrain.shallowTiles.length; k++) {
        if ((k + phase) % 5 !== 0) continue;
        const i = terrain.shallowTiles[k];
        const r = Math.floor(i / cols);
        const c = i % cols;
        ctx.fillRect(c * ts, r * ts + ts / 2, ts, 1.5);
      }

      // rota da demanda entre os dois últimos prédios, tracejado que "anda"
      if (route) {
        const [x1, y1] = toPx(route.from);
        const [x2, y2] = toPx(route.to);
        ctx.lineCap = "round";
        ctx.strokeStyle = M.routeDark;
        ctx.lineWidth = 5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, y1 - 8);
        ctx.lineTo(x2, y2 - 8);
        ctx.stroke();
        ctx.strokeStyle = M.route;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([7, 7]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.moveTo(x1, y1 - 8);
        ctx.lineTo(x2, y2 - 8);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const loc of sorted) {
        const [bx, by] = toPx(loc.pos);
        drawBuilding(ctx, bx, by, {
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
      // ~10fps bastam para ondas/tracejado e mantêm o custo perto de zero
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

  // Alternância de rótulo acima/abaixo na ordem oeste->leste: vizinhos em x
  // ficam em alturas opostas, o que desfaz as colisões do aglomerado central
  // sem nenhuma posição ajustada à mão.
  const xOrder = useMemo(
    () => [...locations].sort((a, b) => a.pos[0] - b.pos[0]).map((l) => l.id),
    [locations],
  );

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
      {/* Moldura de madeira fixa (igual à do escritório): o zoom acontece
          DENTRO dela, como uma janela para o mundo do mapa. */}
      <div
        className="relative shrink-0 overflow-hidden rounded-2xl border-[6px] border-[#8a7a5c] shadow-2xl"
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
            // Reitoria sempre acima (sede, sprite maior); perto das bordas o
            // rótulo vai para o lado que não é cortado pela moldura; nos
            // demais, alterna pela ordem oeste->leste.
            const above =
              loc.id === "1.1" ||
              (y <= 90
                ? false
                : y >= CANVAS_H - 40
                  ? true
                  : xOrder.indexOf(loc.id) % 2 === 1);
            return (
              <button
                key={loc.id}
                onClick={() => onSelect(loc)}
                className={`absolute -translate-x-1/2 flex flex-col items-center cursor-pointer group ${
                  above ? "justify-start" : "justify-end"
                }`}
                style={{ left: x, top: above ? y - 76 : y - 46, width: 64, height: 72 }}
                title={loc.nome}
              >
                <span
                  className={`text-[8px] font-mono font-bold px-1.5 py-px rounded-full border shadow whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-amber-400 text-slate-950 border-amber-600"
                      : "bg-[#1f2430]/90 text-stone-100 border-white/15 group-hover:bg-[#2b3244]"
                  }`}
                >
                  {cityKeyFromName(loc.nome)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
