import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Pack } from "@genius/canon";

export interface AvailablePackFile {
  filename: string;
  valid: boolean;
  nome?: string;
  versao?: string;
  error?: string;
}

/** "Watcher simples": lista os `.json` da pasta `packs/` e valida cada um contra o schema `Pack`, sem importar nada ainda. */
export async function listAvailablePackFiles(packsDir: string): Promise<AvailablePackFile[]> {
  let filenames: string[];
  try {
    filenames = (await readdir(packsDir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const results: AvailablePackFile[] = [];
  for (const filename of filenames) {
    try {
      const content = await readFile(path.join(packsDir, filename), "utf-8");
      const parsed = Pack.parse(JSON.parse(content));
      results.push({ filename, valid: true, nome: parsed.nome, versao: parsed.versao });
    } catch (err) {
      results.push({ filename, valid: false, error: String(err) });
    }
  }
  return results;
}

export async function readPackFile(packsDir: string, filename: string): Promise<Pack> {
  const content = await readFile(path.join(packsDir, filename), "utf-8");
  return Pack.parse(JSON.parse(content));
}
