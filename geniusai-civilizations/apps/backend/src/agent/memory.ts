import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../paths";
import { InvalidGameIdError, isValidGameId } from "../orchestrator/trace";
import { CIV_IDS } from "../engine/types";
import type { CivId, World } from "../engine/types";

/**
 * Memória de longo prazo dos agentes, ISOLADA POR PARTIDA:
 * `data/memory/<gameId>/<civ>.md`. Duas partidas nunca compartilham (nem
 * contaminam) a estratégia acumulada uma da outra.
 */
function memoryDir(gameId: string): string {
  if (!isValidGameId(gameId)) throw new InvalidGameIdError(gameId);
  return path.join(dataDir(), "memory", gameId);
}

function memoryFile(gameId: string, civId: CivId): string {
  return path.join(memoryDir(gameId), `${civId}.md`);
}

/** Lê a memória persistida de uma civilização (vazio se não existir). */
export async function readMemory(gameId: string, civId: CivId): Promise<string> {
  try {
    return await readFile(memoryFile(gameId, civId), "utf8");
  } catch (err) {
    if (err instanceof InvalidGameIdError) throw err;
    return "";
  }
}

/** Persiste a memória de uma civilização em disco. */
export async function writeMemory(gameId: string, civId: CivId, text: string): Promise<void> {
  await mkdir(memoryDir(gameId), { recursive: true });
  await writeFile(memoryFile(gameId, civId), text, "utf8");
}

/**
 * Carrega as memórias do disco para dentro do mundo. Usar apenas ao INICIAR
 * uma partida nova — um mundo carregado de save já traz a memória correta
 * dentro de `civilizations[*].memory` e não deve ser sobrescrito.
 */
export async function hydrateMemory(gameId: string, world: World): Promise<void> {
  for (const id of CIV_IDS) {
    world.civilizations[id].memory = await readMemory(gameId, id);
  }
}

/** Salva as memórias do mundo em disco (após um tick). */
export async function persistMemory(gameId: string, world: World): Promise<void> {
  for (const id of CIV_IDS) {
    await writeMemory(gameId, id, world.civilizations[id].memory);
  }
}
