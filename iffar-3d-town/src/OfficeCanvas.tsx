import { useEffect, useMemo, useRef, useState } from "react";
import type { Agent, Point, Seat, WalkState } from "./types/organogram";
import { drawDesk, drawSeatedPerson, drawWalker } from "./components/organogram/DeskNode";
import {
  drawBench,
  drawGrassGround,
  drawTree,
  drawWelcomeSign,
} from "./components/organogram/CourtyardDecoration";
import {
  drawBreakRoom,
  drawLoungeRoom,
  drawMeetingRoom,
  drawOfficeRoom,
  drawPodRoom,
  drawZenRoom,
  PixelRoomBanner,
  PixelRoomBlockFrame,
} from "./components/organogram/PixelRoomContainer";
import { buildPlan, buildWalk, walkPosition } from "./components/organogram/planBuilder";
import { C, carpet, GARDEN_MARGIN, hash01, roundRectPath, TILE, woodFloor } from "./components/organogram/canvasPrimitives";

// ---------------------------------------------------------------------------
// ESCRITÓRIO EM PIXEL ART (CANVAS) — ORGANOGRAMA COMPLETO DO PRÉDIO
// (REITORIA E CAMPI)
//
// Este componente é o viewport interativo (scroll/pan + alternância entre
// o modo Pixel Art e a Visão de Pássaro) do organograma espacial 2D — os
// blocos numerados por Pró-Reitoria/Diretoria real, as salas, as mesas
// com avatar e o pátio de entrada moram em src/components/organogram/;
// aqui só a orquestração (estado, animação, composição das peças).
//
// Um prédio único e contínuo — sem paredes cortando o andar em caixas
// separadas. Cada repartição direta da Reitoria/do campus (Pró-Reitoria,
// Diretoria, Comissão...) ganha sua própria área, lado a lado num só
// corredor; o limite entre uma e outra é só a cor do piso e a mobília. A
// chefia (Gabinete do(a) Reitor(a)/Diretor(a) Geral, com seus assessores
// diretos) fica na maior área, à esquerda, com mobília mais completa
// (quadros, sofá, estante). Repartições de 1-2 pessoas (comissões,
// colegiados) se juntam numa única área compartilhada — do contrário a
// Reitoria teria uma dezena de salas de uma pessoa só. Intercalados entre
// as áreas de trabalho, espaços de convivência (Estar, Copa, Reunião,
// Zen) dão um ar mais humano e próximo do dia a dia real de uma
// instituição de ensino.
//
// Quando a demanda passa de uma unidade para outra DENTRO do mesmo
// prédio, um mensageiro anda pelo corredor entre as duas repartições, em
// vez de a cena simplesmente saltar. Só quando a demanda muda de PRÉDIO
// (Reitoria <-> campus) é que a cena corta (isso já acontece um nível
// acima, no mapa).
//
// Todos os dados (agentes, cargos, competências) vêm do organograma real
// carregado via GET /api/org-chart (App.tsx) — nada é fixo aqui, ver
// CLAUDE.md e businesses/iffar/org-chart.yaml.
// ---------------------------------------------------------------------------

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
      drawGrassGround(ctx, plan.totalW, plan.totalH);
      woodFloor(ctx, GARDEN_MARGIN, GARDEN_MARGIN, plan.totalW - GARDEN_MARGIN * 2, plan.totalH - GARDEN_MARGIN * 2);

      // fileira de árvores emoldurando o prédio pelo alto e pelo pé, como
      // o gramado dos organogramas de referência
      for (let tx = GARDEN_MARGIN * 0.6; tx < plan.totalW - GARDEN_MARGIN * 0.4; tx += 5.5) {
        drawTree(ctx, tx, GARDEN_MARGIN * 0.5);
        drawTree(ctx, tx + 2.75, plan.totalH - GARDEN_MARGIN * 0.35);
      }

      for (const z of plan.zones) {
        carpet(ctx, z.x, z.y, z.w, z.h, z.floorA, z.floorB);
      }

      for (const z of plan.zones) {
        if (z.kind === "office") drawOfficeRoom(ctx, z);
        else if (z.kind === "pod") drawPodRoom(ctx, z);
        else if (z.kind === "lounge") drawLoungeRoom(ctx, z);
        else if (z.kind === "break") drawBreakRoom(ctx, z);
        else if (z.kind === "meeting") drawMeetingRoom(ctx, z);
        else if (z.kind === "zen") drawZenRoom(ctx, z);
      }

      // Entrada — pátio com bancos, jardineiras e o letreiro de
      // boas-vindas, sempre no fim do corredor (a mesma assinatura visual
      // dos organogramas de referência).
      for (const z of plan.zones) {
        if (z.kind !== "entrance") continue;
        const cx = z.x + z.w / 2;
        drawWelcomeSign(ctx, cx, z.y + z.h - 8.4, z.w, buildingName);
        drawBench(ctx, z.x + 2.6, z.y + z.h - 2.4);
        drawBench(ctx, z.x + z.w - 2.6, z.y + z.h - 2.4);
      }

      // Pessoas sentadas + mesas — a pessoa é desenhada primeiro (atrás),
      // depois a mesa (na frente, escondendo a parte de baixo do tronco),
      // como alguém sentado de frente atrás do próprio tampo.
      for (const seat of plan.seats) {
        const agent = agents.find((a) => a.id === seat.agentId);
        if (!agent) continue;
        const seed = hash01(agent.id);
        drawSeatedPerson(ctx, seat.deskX, seat.deskY - 0.85, seed, agent.id === visualActiveId, t);
        drawDesk(ctx, seat.deskX, seat.deskY, seed, t);
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

      // FOCO: o andar NÃO apaga — ele só recua um pouco, e a área que está
      // resolvendo a demanda ganha um cartão claro por cima. A leitura é
      // suave, não um holofote de palco.
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
              {plan.blocks.map((b, i) => (
                <PixelRoomBlockFrame
                  key={`block-${i}`}
                  block={b}
                  dimmed={Boolean(activeZone && !(activeZone.x >= b.x && activeZone.x < b.x + b.w))}
                />
              ))}

              {/* Faixa com o nome real da repartição, no topo de cada sala —
                  salas que já pertencem a um bloco numerado não repetem o
                  nome, o cabeçalho do bloco já diz qual é a repartição. */}
              {plan.zones.map((z, i) =>
                z.kind !== "entrance" && !plan.blocks.some((b) => z.x >= b.x && z.x < b.x + b.w) ? (
                  <PixelRoomBanner key={`zone-${i}`} zone={z} dimmed={Boolean(activeZone && activeZone !== z)} />
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

// Apelido pedido pela convenção de nomenclatura "viewport interativo com
// zoom/pan e troca dinâmica entre Reitoria e Campi" — mesmo componente
// acima; o scroll/pan já existe (overflow-auto) e a troca de prédio é
// orquestrada um nível acima, em App.tsx (activeLocationId).
export { OfficeCanvas as CampusMapViewer };
