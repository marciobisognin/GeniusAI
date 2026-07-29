// Paleta institucional + formas de mobília genéricas reutilizadas por toda
// a "planta" do prédio (Reitoria e campi) — o design system em pixel art
// compartilhado entre PixelRoomContainer, DeskNode e CourtyardDecoration.

export const TILE = 20;

// Faixa de jardim ao redor do prédio inteiro (não só na entrada) — grama e
// árvores emolduram o piso de tábua corrida, como nos organogramas de
// referência, em vez do prédio flutuar sozinho no canvas.
export const GARDEN_MARGIN = 2.4;

// Paleta amostrada quadro a quadro do vídeo de referência do Gather 2.0:
// piso de tábua corrida quente, carpetes pastel, mesas claras, cadeiras
// azul-marinho e móveis em pêssego/madeira clara. Nada de cinza industrial.
export const C = {
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
export const DESK_ACCENTS = ["#f8f8f5", "#f8f8f5", "#e8c893", "#c9e8e0", "#f8f8f5", "#f2dce4"];
export const SCREEN_COLORS = ["#5b8fd4", "#d47fb0", "#5bb99a", "#e0ae5e", "#7b8ad4", "#4fc0c0"];

// Piso neutro para as salas de repartição — nos organogramas de
// referência, a cor de identidade de cada Pró-Reitoria/Diretoria mora na
// moldura do bloco numerado, não no piso; a sala em si fica num tom claro
// e discreto, quase igual de uma repartição para outra.
export const POD_PALETTE: readonly [string, string][] = [
  ["#d9dde2", "#d1d5da"], // cinza-azulado neutro
];

// Paleta de molduras dos blocos numerados — uma cor institucional distinta
// por Pró-Reitoria/Diretoria, como nos organogramas de referência (cada
// bloco grande tem sua própria cor de contorno).
export const BLOCK_COLORS = ["#2f6b3f", "#2f5a8f", "#8a6a1f", "#6a3f8a", "#8a4a2f", "#2f7a7a"];

export function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// Escurece uma cor hex — usado para tirar o tom do banner de cada sala a
// partir da própria cor do carpete, como as faixas escuras com o nome da
// repartição nos organogramas de referência.
export function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * (1 - amt);
  const g = ((n >> 8) & 255) * (1 - amt);
  const b = (n & 255) * (1 - amt);
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

export function roundRectPath(
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

// Piso de tábua corrida do prédio propriamente dito: creme quente com
// juntas em tijolo (fiadas deslocadas), exatamente como o chão de
// circulação do vídeo — desenhado só dentro do footprint do prédio
// (x0,y0,w,h), com o gramado por baixo/ao redor.
export function woodFloor(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
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
export function carpet(
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

// Divisória baixa de baia (separa estações dentro da ilha aberta)
export function divider(
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
export function plant(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
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

export function frame(ctx: CanvasRenderingContext2D, cx: number, cy: number, tint: string) {
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

export function shelf(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
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

export function sofa(ctx: CanvasRenderingContext2D, cx: number, cy: number, horizontal = true) {
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

export function roundTable(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
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
export function cushion(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
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
export function pond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
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
export function officeChair(ctx: CanvasRenderingContext2D, x: number, y: number) {
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

export function emptyChair(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  officeChair(ctx, cx * TILE, cy * TILE);
}
