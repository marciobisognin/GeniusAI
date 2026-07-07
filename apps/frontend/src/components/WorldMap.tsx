import { useEffect, useRef } from "react";
import { CIV_COLOR, type World } from "../types";

const TILE = 40;

const TERRAIN_BG: Record<string, string> = {
  plains: "#3a4a2f",
  forest: "#1f3a24",
  mountain: "#4a4640",
  coast: "#1f3a4a",
  desert: "#4a3f28",
};

interface Props {
  world: World | null;
}

export function WorldMap({ world }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = world.width * TILE;
    canvas.height = world.height * TILE;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Terreno + território.
    for (const row of world.map) {
      for (const tile of row) {
        const px = tile.x * TILE;
        const py = tile.y * TILE;
        ctx.fillStyle = TERRAIN_BG[tile.terrain] ?? "#333";
        ctx.fillRect(px, py, TILE, TILE);

        if (tile.owner) {
          ctx.fillStyle = CIV_COLOR[tile.owner];
          ctx.globalAlpha = 0.28;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.globalAlpha = 1;
        }

        if (tile.resource) {
          ctx.fillStyle = "#f5e6b8";
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.strokeRect(px, py, TILE, TILE);
      }
    }

    // Cidades e exércitos.
    for (const civ of Object.values(world.civilizations)) {
      const color = CIV_COLOR[civ.id];
      for (const city of civ.cities) {
        const cx = city.x * TILE + TILE / 2;
        const cy = city.y * TILE + TILE / 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0f1115";
        ctx.font = "10px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText(String(city.population), cx, cy + 3);
      }
      for (const army of civ.armies) {
        const ax = army.x * TILE + TILE / 2;
        const ay = army.y * TILE + TILE / 2;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax - 6, ay + 6);
        ctx.lineTo(ax, ay - 7);
        ctx.lineTo(ax + 6, ay + 6);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }, [world]);

  if (!world) {
    return <div className="card map-placeholder">aguardando estado do mundo…</div>;
  }

  return (
    <div className="card map-card">
      <canvas ref={canvasRef} className="map-canvas" />
    </div>
  );
}
