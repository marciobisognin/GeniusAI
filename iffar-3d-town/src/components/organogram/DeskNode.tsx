// Estação de trabalho pixelada: mesa + avatar (recortado dos organogramas
// de referência) + mensageiro que anda pelo corredor. O "nome/função" da
// pessoa é renderizado à parte, como overlay DOM, em PixelRoomContainer
// (plaquinha sob a mesa) — aqui só o desenho em canvas.
import avatarUrl1 from "../../assets/office/avatar1.png";
import avatarUrl2 from "../../assets/office/avatar2.png";
import avatarUrl3 from "../../assets/office/avatar3.png";
import avatarUrl4 from "../../assets/office/avatar4.png";
import avatarUrl5 from "../../assets/office/avatar5.png";
import { C, DESK_ACCENTS, SCREEN_COLORS, TILE, roundRectPath } from "./canvasPrimitives";

// Avatares recortados diretamente dos organogramas de referência enviados
// pelo dono do repositório (busto, sem o piso ao redor) — em vez de
// desenhados via código, para a aparência bater com a referência de fato.
// Um número pequeno de pessoas distintas se repete pelo prédio (mesma
// limitação de qualquer spritesheet finito), escolhida por hash do id do
// agente para ser estável entre renders.
export const AVATAR_SPRITES = [avatarUrl1, avatarUrl2, avatarUrl3, avatarUrl4, avatarUrl5].map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

// Estação de trabalho: um tampo de madeira simples com um único monitor
// centralizado (a pessoa senta atrás, de frente, com o rosto acima da
// tela) — mais perto da mesa única dos organogramas de referência do que
// da baia dupla-monitor de antes.
export function drawDesk(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number, t: number) {
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

// Pessoa sentada vista DE FRENTE — busto recortado do próprio organograma
// de referência (ver AVATAR_SPRITES acima). É desenhada ANTES da mesa
// (que fica na frente, escondendo a parte de baixo do tronco), para ler
// como alguém sentado atrás do próprio tampo, olhando para quem está
// vendo o prédio.
export function drawSeatedPerson(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
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
export function drawWalker(ctx: CanvasRenderingContext2D, x: number, y: number, shirt: string, t: number) {
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
