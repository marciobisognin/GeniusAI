// Decoração de jardim e pátio de entrada — o gramado com árvores ao redor
// do prédio inteiro e o portal "Bem-Vindo(a)!" no fim do corredor, como
// nos organogramas de referência.
import { C, TILE, roundRectPath } from "./canvasPrimitives";

// Gramado ao redor do prédio inteiro — a base sobre a qual o piso de tábua
// corrida "assenta", como o terreno em volta dos organogramas de
// referência. Cobre o canvas inteiro; o piso de madeira é desenhado por
// cima, só na área do prédio propriamente dito.
export function drawGrassGround(ctx: CanvasRenderingContext2D, w: number, h: number) {
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
export function drawTree(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
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

// Banco de praça de madeira, para o pátio de entrada.
export function drawBench(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
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
export function drawWelcomeSign(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  title: string,
) {
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
