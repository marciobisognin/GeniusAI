import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../paths";
import { CIV_IDS } from "../engine/types";
import type { CivId, World } from "../engine/types";

function memoryDir(): string {
  return path.join(dataDir(), "memory");
}

function memoryFile(civId: CivId): string {
  return path.join(memoryDir(), `${civId}.md`);
}

/** Lê a memória persistida de uma civilização (vazio se não existir). */
export async function readMemory(civId: CivId): Promise<string> {
  try {
    return await readFile(memoryFile(civId), "utf8");
  } catch {
    return "";
  }
}

/** Persiste a memória de uma civilização em disco. */
export async function writeMemory(civId: CivId, text: string): Promise<void> {
  await mkdir(memoryDir(), { recursive: true });
  await writeFile(memoryFile(civId), text, "utf8");
}

/** Carrega as memórias do disco para dentro do mundo (início de partida). */
export async function hydrateMemory(world: World): Promise<void> {
  for (const id of CIV_IDS) {
    world.civilizations[id].memory = await readMemory(id);
  }
}

/** Salva as memórias do mundo em disco (após um tick). */
export async function persistMemory(world: World): Promise<void> {
  for (const id of CIV_IDS) {
    await writeMemory(id, world.civilizations[id].memory);
  }
}
