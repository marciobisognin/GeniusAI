import { appendFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../paths";
import type { Action, CivId, GameEvent, World } from "../engine/types";
import type { DisplayEvent } from "./events";

function tracesDir(): string {
  return path.join(dataDir(), "traces");
}
function savesDir(): string {
  return path.join(dataDir(), "saves");
}

export interface TraceRecord {
  tick: number;
  decisions: {
    civ: CivId;
    reasoning: string;
    actions: Action[];
    passed: boolean;
    errors: string[];
  }[];
  events: GameEvent[];
  /** Manchete opcional do narrador (ver orchestrator/narrator.ts). */
  narration?: string;
}

/** Anexa um registro do tick ao trace da partida (JSON Lines). */
export async function appendTrace(gameId: string, record: TraceRecord): Promise<void> {
  await mkdir(tracesDir(), { recursive: true });
  await appendFile(path.join(tracesDir(), `${gameId}.jsonl`), `${JSON.stringify(record)}\n`, "utf8");
}

/** Salva um snapshot completo do mundo (para salvar/carregar partida). */
export async function saveWorld(gameId: string, world: World): Promise<void> {
  await mkdir(savesDir(), { recursive: true });
  await writeFile(path.join(savesDir(), `${gameId}.json`), JSON.stringify(world), "utf8");
}

/** Carrega um snapshot salvo (ou null se não existir). */
export async function loadWorld(gameId: string): Promise<World | null> {
  try {
    const raw = await readFile(path.join(savesDir(), `${gameId}.json`), "utf8");
    return JSON.parse(raw) as World;
  } catch {
    return null;
  }
}

/** Lê todo o histórico de ticks de uma partida (vazio se não existir). */
export async function readTrace(gameId: string): Promise<TraceRecord[]> {
  try {
    const raw = await readFile(path.join(tracesDir(), `${gameId}.jsonl`), "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as TraceRecord);
  } catch {
    return [];
  }
}

export interface SaveInfo {
  gameId: string;
  tick: number;
  seed: number;
  updatedAt: string;
}

/** Lista as partidas salvas em disco (mais recente primeiro). */
export async function listSaves(): Promise<SaveInfo[]> {
  let files: string[];
  try {
    files = await readdir(savesDir());
  } catch {
    return [];
  }

  const infos: SaveInfo[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(savesDir(), file);
    try {
      const [raw, st] = await Promise.all([readFile(full, "utf8"), stat(full)]);
      const world = JSON.parse(raw) as World;
      infos.push({
        gameId: file.replace(/\.json$/, ""),
        tick: world.tick,
        seed: world.seed,
        updatedAt: st.mtime.toISOString(),
      });
    } catch {
      // arquivo corrompido/parcial — ignora
    }
  }
  return infos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface CivLastTurn {
  reasoning: string;
  actions: Action[];
  passed: boolean;
  errors: string[];
}

export interface TraceSummary {
  /** Todos os eventos (+ narrações) da partida, em ordem cronológica. */
  timeline: DisplayEvent[];
  /** Última decisão registrada de cada civilização. */
  civs: Partial<Record<CivId, CivLastTurn>>;
}

/**
 * Reduz o trace completo a um resumo pronto para repor o estado de um
 * cliente que acabou de conectar (ou reconectar): a timeline inteira (na
 * mesma forma — GameEvent[] + narração sintética — que o streaming ao vivo
 * usa em `tick_end`) e o último raciocínio/ações de cada civilização.
 */
export function summarizeTrace(records: TraceRecord[]): TraceSummary {
  const timeline: DisplayEvent[] = [];
  const civs: Partial<Record<CivId, CivLastTurn>> = {};

  for (const record of records) {
    timeline.push(...record.events);
    if (record.narration) timeline.push({ type: "narration", text: record.narration });
    for (const d of record.decisions) {
      civs[d.civ] = { reasoning: d.reasoning, actions: d.actions, passed: d.passed, errors: d.errors };
    }
  }

  return { timeline, civs };
}

/** Atalho: lê o trace de uma partida e já devolve o resumo (timeline + civs). */
export async function readTraceSummary(gameId: string): Promise<TraceSummary> {
  return summarizeTrace(await readTrace(gameId));
}
