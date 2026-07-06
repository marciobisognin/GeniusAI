import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../paths";
import type { Action, CivId, GameEvent, World } from "../engine/types";

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
