import { useEffect, useRef, useState } from "react";
import { CIV_COLOR, CIV_IDS, CIV_LABEL, type CivId, type World } from "../types";

interface Props {
  world: World | null;
  selected: CivId;
  theme: "light" | "dark";
  /** Tile a destacar (Fase 17, §17 — "localizar no mapa"). */
  highlight?: { x: number; y: number } | null;
}

type TerrainPalette = Record<string, string>;

const TERRAIN_DARK: TerrainPalette = {
  plains: "#38462e",
  forest: "#243a26",
  mountain: "#46433d",
  coast: "#22394a",
  desert: "#4a3f28",
};

const TERRAIN_LIGHT: TerrainPalette = {
  plains: "#b8c48e",
  forest: "#8fae7f",
  mountain: "#b3aa96",
  coast: "#93b7c4",
  desert: "#dcc793",
};

const TERRAIN_LABEL: Record<string, string> = {
  plains: "planície",
  forest: "floresta",
  mountain: "montanha",
  coast: "costa",
  desert: "deserto",
};

function drawWorld(
  canvas: HTMLCanvasElement,
  world: World,
  selected: CivId,
  theme: "light" | "dark",
  cssWidth: number,
  highlight?: { x: number; y: number } | null,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || cssWidth <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  const tile = cssWidth / world.width;
  const cssHeight = tile * world.height;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.height = `${cssHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const terrain = theme === "dark" ? TERRAIN_DARK : TERRAIN_LIGHT;
  const gridColor = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(48,42,29,0.10)";

  for (const row of world.map) {
    for (const t of row) {
      const px = t.x * tile;
      const py = t.y * tile;
      ctx.fillStyle = terrain[t.terrain] ?? "#666";
      ctx.fillRect(px, py, tile + 0.5, tile + 0.5);

      if (t.owner) {
        ctx.fillStyle = CIV_COLOR[t.owner];
        ctx.globalAlpha = t.owner === selected ? 0.5 : 0.26;
        ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
        ctx.globalAlpha = 1;
      }

      if (t.resource) {
        const cx = px + tile / 2;
        const cy = py + tile / 2;
        const r = Math.max(2, tile * 0.09);
        ctx.fillStyle = theme === "dark" ? "#f5e6b8" : "#7a5c17";
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = gridColor;
      ctx.strokeRect(px, py, tile, tile);
    }
  }

  // Contorno do território da civilização selecionada.
  ctx.strokeStyle = CIV_COLOR[selected];
  ctx.lineWidth = Math.max(1.5, tile * 0.05);
  for (const row of world.map) {
    for (const t of row) {
      if (t.owner !== selected) continue;
      const px = t.x * tile;
      const py = t.y * tile;
      const neighbor = (x: number, y: number) => world.map[y]?.[x]?.owner === selected;
      ctx.beginPath();
      if (!neighbor(t.x, t.y - 1)) { ctx.moveTo(px, py); ctx.lineTo(px + tile, py); }
      if (!neighbor(t.x, t.y + 1)) { ctx.moveTo(px, py + tile); ctx.lineTo(px + tile, py + tile); }
      if (!neighbor(t.x - 1, t.y)) { ctx.moveTo(px, py); ctx.lineTo(px, py + tile); }
      if (!neighbor(t.x + 1, t.y)) { ctx.moveTo(px + tile, py); ctx.lineTo(px + tile, py + tile); }
      ctx.stroke();
    }
  }
  ctx.lineWidth = 1;

  for (const civ of Object.values(world.civilizations)) {
    const color = CIV_COLOR[civ.id];
    for (const city of civ.cities) {
      const cx = city.x * tile + tile / 2;
      const cy = city.y * tile + tile / 2;
      const r = Math.max(6, tile * 0.26);
      ctx.fillStyle = color;
      ctx.strokeStyle = theme === "dark" ? "#12141b" : "#fffdf4";
      ctx.lineWidth = Math.max(1.5, tile * 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fffdf4";
      ctx.font = `700 ${Math.max(9, tile * 0.24)}px ${getComputedStyle(canvas).fontFamily || "sans-serif"}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(city.population), cx, cy + 0.5);
    }
    for (const army of civ.armies) {
      const ax = army.x * tile + tile / 2;
      const ay = army.y * tile + tile / 2;
      const s = Math.max(5, tile * 0.18);
      ctx.strokeStyle = theme === "dark" ? "#12141b" : "#fffdf4";
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1.2, tile * 0.035);
      ctx.beginPath();
      ctx.moveTo(ax - s, ay + s);
      ctx.lineTo(ax, ay - s * 1.2);
      ctx.lineTo(ax + s, ay + s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // Névoa de guerra (Fase 20, §20 — RF-23): tiles ainda não descobertos pela
  // civilização selecionada ficam escurecidos e hachurados — o observador vê
  // exatamente a informação que a IA daquela civilização tem, por cima de
  // tudo (mesmo cidades/exércitos de outras civs que ela não descobriu).
  // Opacidade alta de propósito: precisa ser inconfundível à distância, não
  // uma sutileza de tom sobre o já colorido território de outra civ.
  if (world.fogOfWar) {
    const discovered = world.civilizations[selected].discovered;
    const fogFill = theme === "dark" ? "rgba(5,6,10,0.86)" : "rgba(28,23,14,0.82)";
    const hatch = theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.14)";
    ctx.save();
    for (const row of world.map) {
      for (const t of row) {
        if (discovered[`${t.x},${t.y}`]) continue;
        const px = t.x * tile;
        const py = t.y * tile;
        ctx.fillStyle = fogFill;
        ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
        // Hachura diagonal — leitura inequívoca de "não descoberto" mesmo em capturas pequenas.
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, tile + 0.5, tile + 0.5);
        ctx.clip();
        ctx.strokeStyle = hatch;
        ctx.lineWidth = Math.max(1, tile * 0.05);
        for (let o = -tile; o < tile * 2; o += Math.max(4, tile * 0.28)) {
          ctx.beginPath();
          ctx.moveTo(px + o, py);
          ctx.lineTo(px + o + tile, py + tile);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  if (highlight) {
    const hx = highlight.x * tile + tile / 2;
    const hy = highlight.y * tile + tile / 2;
    const r = tile * 0.62;
    ctx.strokeStyle = theme === "dark" ? "#ffe28a" : "#c9820a";
    ctx.lineWidth = Math.max(2, tile * 0.09);
    ctx.setLineDash([tile * 0.14, tile * 0.1]);
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function WorldMap({ world, selected, theme, highlight }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.floor(entries[0]?.contentRect.width ?? 0));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && world) drawWorld(canvas, world, selected, theme, width, highlight);
  }, [world, selected, theme, width, highlight]);

  return (
    <section className="card map-card" aria-label="Mapa do mundo">
      <div className="map-card-head">
        <div>
          <p className="eyebrow">Estado real do motor</p>
          <h2>Mapa do mundo · tick {world?.tick ?? 0}</h2>
        </div>
        <div className="map-card-chips">
          <span className="soft-chip">
            {world ? `${world.width}×${world.height} tiles · seed ${world.seed}` : "aguardando"}
          </span>
          {world?.fogOfWar && <span className="soft-chip fog-chip">🌫 névoa de guerra · vendo como {CIV_LABEL[selected]}</span>}
        </div>
      </div>
      <div className="map-frame" ref={frameRef}>
        {world ? (
          <canvas ref={canvasRef} className="map-canvas" />
        ) : (
          <div className="map-placeholder">aguardando estado do mundo…</div>
        )}
      </div>
      <div className="map-legend">
        {CIV_IDS.map((id) => (
          <span key={id} style={{ "--swatch": CIV_COLOR[id] } as React.CSSProperties}>
            <i /> {CIV_LABEL[id]}
          </span>
        ))}
        {Object.entries(TERRAIN_LABEL).map(([key, label]) => (
          <span key={key} style={{ "--swatch": (theme === "dark" ? TERRAIN_DARK : TERRAIN_LIGHT)[key] } as React.CSSProperties}>
            <i /> {label}
          </span>
        ))}
        <span className="legend-city" style={{ "--swatch": "var(--muted)" } as React.CSSProperties}><i /> cidade (população)</span>
        <span className="legend-army" style={{ "--swatch": "var(--muted)" } as React.CSSProperties}><i /> exército</span>
      </div>
    </section>
  );
}
