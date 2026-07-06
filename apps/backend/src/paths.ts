import path from "node:path";
import { fileURLToPath } from "node:url";

// Raiz do repositório resolvida a partir deste arquivo (.../apps/backend/src),
// independente do diretório de trabalho. DATA_DIR sobrescreve (útil em testes).
const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../../..");

export function dataDir(): string {
  return process.env.DATA_DIR ?? path.join(REPO_ROOT, "data");
}
