import { DEFAULT_CIVILIZATIONS } from "@geniusai/shared";
import type { CivilizationDefinition } from "@geniusai/shared";
import { tick } from "../engine/engine";
import { createWorld } from "../engine/world";
import { CIV_IDS } from "../engine/types";
import type { CivDecision, CivId, World } from "../engine/types";
import type { AgentRunner } from "../agent/AgentRunner";
import type { AgentLogger } from "../agent/CivilizationAgentFactory";
import type { TurnResult } from "../agent/runTurn";
import { hydrateMemory, persistMemory } from "../agent/memory";
import { AgentOrchestrator } from "./AgentOrchestrator";
import { appendTrace, loadWorld, saveWorld } from "./trace";
import { narrate } from "./narrator";
import type { DisplayEvent, LoopEvent, LoopState } from "./events";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface GameLoopOptions {
  runner: AgentRunner;
  world?: World;
  seed?: number;
  /** Atraso entre ticks no modo play (ms). */
  speedMs?: number;
  /** Timeout por turno de agente (ms). */
  turnTimeoutMs?: number;
  gameId?: string;
  /** Grava memória/trace/save em disco (padrão true). */
  persist?: boolean;
  /**
   * Runner opcional para narrar os eventos de cada tick (manchete curta).
   * Decorativo — omitido por padrão. Se fornecido, reaproveita o mesmo
   * AgentRunner/schema dos agentes de civilização (ver orchestrator/narrator.ts).
   */
  narrator?: AgentRunner;
  narratorTimeoutMs?: number;
  /**
   * Sobrescreve civilizações específicas do catálogo padrão (§7 do PRD —
   * Agente Construtor). Parcial: civilizações omitidas usam
   * `DEFAULT_CIVILIZATIONS`. Só tem efeito ao CRIAR um mundo novo — um mundo
   * carregado de save já traz sua persona/recursos gravados.
   */
  definitions?: Partial<Record<CivId, CivilizationDefinition>>;
  /** Logger estruturado dos agentes (padrão: uma linha JSON no console). */
  agentLogger?: AgentLogger;
}

/**
 * Orquestrador da simulação. Coordena os turnos das civilizações, aplica as
 * decisões no World Engine, persiste memória/trace/save e emite eventos de
 * progresso (base do streaming para a UI).
 *
 * Modelo: em cada tick, todas as civilizações vivas decidem sobre o MESMO
 * snapshot pré-tick (sequencial, adequado à inferência local); depois o motor
 * aplica tudo de uma vez. A robustez do turno (fallback) vem do
 * `CivilizationAgent.decide()` (via `AgentOrchestrator`) — uma civilização
 * que falha apenas "passa o turno".
 */
export class GameLoop {
  world: World;
  readonly gameId: string;
  private readonly orchestrator: AgentOrchestrator;
  private readonly listeners = new Set<(e: LoopEvent) => void>();
  private state: LoopState = "idle";
  private speedMs: number;
  private turnTimeoutMs: number;
  private persist: boolean;
  private readonly narrator?: AgentRunner;
  private readonly narratorTimeoutMs: number;

  constructor(opts: GameLoopOptions) {
    const definitions = { ...DEFAULT_CIVILIZATIONS, ...opts.definitions };
    this.world = opts.world ?? createWorld(opts.seed ?? 42, definitions);
    this.speedMs = opts.speedMs ?? 1000;
    this.turnTimeoutMs = opts.turnTimeoutMs ?? 60_000;
    this.gameId = opts.gameId ?? `game-${this.world.seed}`;
    this.persist = opts.persist ?? true;
    this.narrator = opts.narrator;
    this.narratorTimeoutMs = opts.narratorTimeoutMs ?? 30_000;
    // Registro dos agentes desta partida (§7.4 — "Fluxo de criação"). Recriar
    // o orquestrador a cada GameLoop (nova partida OU carregada de save) É a
    // "restauração do agente ao carregar uma partida" exigida pelo PRD — os
    // agentes não têm estado próprio além do runner/definição; a memória de
    // longo prazo vive em `World.civilizations[*].memory`.
    this.orchestrator = new AgentOrchestrator({
      gameId: this.gameId,
      runner: opts.runner,
      definitions,
      logger: opts.agentLogger,
    });
  }

  on(fn: (e: LoopEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: LoopEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  getState(): LoopState {
    return this.state;
  }

  setSpeed(ms: number): void {
    if (!Number.isFinite(ms)) return;
    this.speedMs = Math.min(600_000, Math.max(0, ms));
  }

  /** Há um tick em execução neste momento? */
  isBusy(): boolean {
    return this.inFlight !== null;
  }

  /** Resolve quando o tick em andamento (se houver) terminar. */
  async whenIdle(): Promise<void> {
    while (this.inFlight) {
      await this.inFlight.catch(() => {});
    }
  }

  aliveCivs(): CivId[] {
    return CIV_IDS.filter((id) => this.world.civilizations[id].alive);
  }

  isOver(): boolean {
    return this.world.victory !== null || this.aliveCivs().length <= 1;
  }

  /** Carrega memórias persistidas para dentro do mundo (partida nova). */
  async hydrate(): Promise<void> {
    await hydrateMemory(this.gameId, this.world);
  }

  /**
   * Consulta somente leitura ao agente de uma civilização (RF-032 — "Pergunte
   * à civilização"): não avança o tick, não aplica ações, não altera memória.
   */
  ask(civId: CivId, question: string): Promise<string> {
    return this.orchestrator.answerQuestion(civId, this.world, question);
  }

  private inFlight: Promise<World> | null = null;

  /**
   * Executa exatamente um tick. Chamadas concorrentes são serializadas —
   * nunca há dois ticks mutando o mesmo mundo ao mesmo tempo (proteção de
   * concorrência exigida pelo PRD; o servidor ainda pode rejeitar com
   * GAME_BUSY antes de chegar aqui, para dar feedback imediato).
   */
  async step(): Promise<World> {
    while (this.inFlight) {
      await this.inFlight.catch(() => {});
    }
    const run = this.doStep();
    this.inFlight = run;
    try {
      return await run;
    } finally {
      this.inFlight = null;
    }
  }

  private async doStep(): Promise<World> {
    // Partida encerrada: não há mais turnos a decidir (o motor também recusa).
    if (this.world.victory) return this.world;

    const nextTick = this.world.tick + 1;
    const decisions: CivDecision[] = [];
    const results: TurnResult[] = [];

    for (const id of CIV_IDS) {
      if (!this.world.civilizations[id].alive) continue;
      this.emit({ type: "turn_start", tick: nextTick, civ: id });
      const res = await this.orchestrator.decide(id, this.world, {
        timeoutMs: this.turnTimeoutMs,
        onToken: (chunk) => this.emit({ type: "turn_token", tick: nextTick, civ: id, chunk }),
      });
      results.push(res);
      decisions.push(res.decision);
      this.emit({
        type: "turn_end",
        tick: nextTick,
        civ: id,
        reasoning: res.reasoning,
        actions: res.decision.actions,
        passed: res.passed,
        errors: res.errors,
        advisorRecommendations: res.advisorRecommendations,
      });
    }

    this.world = tick(this.world, decisions);

    const narrationText = this.narrator
      ? await narrate(this.narrator, this.world.events, this.narratorTimeoutMs)
      : null;

    if (this.persist) {
      await persistMemory(this.gameId, this.world);
      await appendTrace(this.gameId, {
        tick: this.world.tick,
        decisions: results.map((r) => ({
          civ: r.decision.civ,
          reasoning: r.reasoning,
          actions: r.decision.actions,
          passed: r.passed,
          errors: r.errors,
          advisorRecommendations: r.advisorRecommendations,
        })),
        events: this.world.events,
        narration: narrationText ?? undefined,
      });
      await saveWorld(this.gameId, this.world);
    }

    const outboundEvents: DisplayEvent[] = narrationText
      ? [...this.world.events, { type: "narration", text: narrationText }]
      : this.world.events;
    this.emit({ type: "tick_end", tick: this.world.tick, events: outboundEvents, world: this.world });
    return this.world;
  }

  play(): void {
    if (this.state === "running") return;
    this.state = "running";
    this.emit({ type: "loop_state", state: "running" });
    void this.runLoop();
  }

  pause(): void {
    if (this.state !== "running") return;
    this.state = "paused";
    this.emit({ type: "loop_state", state: "paused" });
  }

  stop(): void {
    if (this.state === "stopped") return;
    this.state = "stopped";
    this.emit({ type: "loop_state", state: "stopped" });
  }

  private async runLoop(): Promise<void> {
    while (this.state === "running") {
      await this.step();
      if (this.state !== "running") break; // pausado/parado durante o tick
      if (this.isOver()) {
        this.stop();
        break;
      }
      await delay(this.speedMs);
    }
  }
}

/**
 * Cria um GameLoop retomando automaticamente de um save existente para o
 * `gameId` (ou seed) informado — "salvar/carregar partida" acontece de forma
 * transparente: se há um save em disco, a simulação continua de onde parou;
 * senão, começa um mundo novo. Também hidrata a memória das civilizações.
 */
export async function createGameLoop(opts: GameLoopOptions): Promise<GameLoop> {
  const seed = opts.seed ?? 42;
  const gameId = opts.gameId ?? `game-${seed}`;
  const saved = opts.world ? null : await loadWorld(gameId);

  const loop = new GameLoop({ ...opts, gameId, world: opts.world ?? saved ?? undefined });
  // Mundo vindo de save já carrega a memória correta em civilizations[*].memory;
  // hidratar do disco só faz sentido (e é seguro) para uma partida recém-criada.
  if (!opts.world && !saved) await loop.hydrate();
  return loop;
}
