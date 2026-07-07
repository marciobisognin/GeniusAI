import { tick } from "../engine/engine";
import { createWorld } from "../engine/world";
import { CIV_IDS } from "../engine/types";
import type { CivDecision, CivId, World } from "../engine/types";
import type { AgentRunner } from "../agent/AgentRunner";
import { runCivilizationTurn } from "../agent/runTurn";
import type { TurnResult } from "../agent/runTurn";
import { hydrateMemory, persistMemory } from "../agent/memory";
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
}

/**
 * Orquestrador da simulação. Coordena os turnos das civilizações, aplica as
 * decisões no World Engine, persiste memória/trace/save e emite eventos de
 * progresso (base do streaming para a UI).
 *
 * Modelo: em cada tick, todas as civilizações vivas decidem sobre o MESMO
 * snapshot pré-tick (sequencial, adequado à inferência local); depois o motor
 * aplica tudo de uma vez. A robustez do turno (fallback) vem de
 * runCivilizationTurn — uma civilização que falha apenas "passa o turno".
 */
export class GameLoop {
  world: World;
  readonly gameId: string;
  private readonly runner: AgentRunner;
  private readonly listeners = new Set<(e: LoopEvent) => void>();
  private state: LoopState = "idle";
  private speedMs: number;
  private turnTimeoutMs: number;
  private persist: boolean;
  private readonly narrator?: AgentRunner;
  private readonly narratorTimeoutMs: number;

  constructor(opts: GameLoopOptions) {
    this.runner = opts.runner;
    this.world = opts.world ?? createWorld(opts.seed ?? 42);
    this.speedMs = opts.speedMs ?? 1000;
    this.turnTimeoutMs = opts.turnTimeoutMs ?? 60_000;
    this.gameId = opts.gameId ?? `game-${this.world.seed}`;
    this.persist = opts.persist ?? true;
    this.narrator = opts.narrator;
    this.narratorTimeoutMs = opts.narratorTimeoutMs ?? 30_000;
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
    this.speedMs = Math.max(0, ms);
  }

  aliveCivs(): CivId[] {
    return CIV_IDS.filter((id) => this.world.civilizations[id].alive);
  }

  isOver(): boolean {
    return this.aliveCivs().length <= 1;
  }

  /** Carrega memórias persistidas para dentro do mundo (retomar partida). */
  async hydrate(): Promise<void> {
    await hydrateMemory(this.world);
  }

  /** Executa exatamente um tick (todas as civilizações vivas decidem). */
  async step(): Promise<World> {
    const nextTick = this.world.tick + 1;
    const decisions: CivDecision[] = [];
    const results: TurnResult[] = [];

    for (const id of CIV_IDS) {
      if (!this.world.civilizations[id].alive) continue;
      this.emit({ type: "turn_start", tick: nextTick, civ: id });
      const res = await runCivilizationTurn(this.world, id, this.runner, {
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
      });
    }

    this.world = tick(this.world, decisions);

    const narrationText = this.narrator
      ? await narrate(this.narrator, this.world.events, this.narratorTimeoutMs)
      : null;

    if (this.persist) {
      await persistMemory(this.world);
      await appendTrace(this.gameId, {
        tick: this.world.tick,
        decisions: results.map((r) => ({
          civ: r.decision.civ,
          reasoning: r.reasoning,
          actions: r.decision.actions,
          passed: r.passed,
          errors: r.errors,
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
  await loop.hydrate();
  return loop;
}
