import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { Agent, Squad } from "@genius/canon";
import { importCivilizationsProfiles } from "./fromCivilizationsProfiles.js";
import { importForesightAgents } from "./fromForesightYaml.js";
import { importSoIaAgents, importSoIaSquads } from "./fromSoIaAgents.js";

export interface LoadedLibrary {
  agents: Agent[];
  squads: Squad[];
}

/**
 * Único ponto do pacote que toca disco — os importadores em si (`fromSoIaAgents`,
 * `fromForesightYaml`, `fromCivilizationsProfiles`) são puros e testáveis sem
 * `fs`. Isto aqui é a conveniência de "importar da biblioteca com um clique":
 * lê os arquivos reais dos três projetos-irmãos a partir da raiz do
 * monorepo e devolve tudo já validado pelo canon.
 */
export async function loadFromRepo(repoRoot: string): Promise<LoadedLibrary> {
  const agents: Agent[] = [];
  const squads: Squad[] = [];

  const soIaAgentsPath = path.join(repoRoot, "so-ia/src/lib/data/agents.ts");
  const soIaSquadsPath = path.join(repoRoot, "so-ia/src/lib/org/squad-registry.ts");
  agents.push(...importSoIaAgents(await readFile(soIaAgentsPath, "utf-8"), "so-ia/src/lib/data/agents.ts"));
  squads.push(...importSoIaSquads(await readFile(soIaSquadsPath, "utf-8"), "so-ia/src/lib/org/squad-registry.ts"));

  const foresightDir = path.join(repoRoot, "geniusai-foresight/agents");
  const yamlNames = (await readdir(foresightDir)).filter((name) => name.endsWith(".yaml"));
  const foresightFiles = await Promise.all(
    yamlNames.map(async (name) => ({
      path: `geniusai-foresight/agents/${name}`,
      content: await readFile(path.join(foresightDir, name), "utf-8"),
    })),
  );
  agents.push(...importForesightAgents(foresightFiles));

  const civilizationsSharedPath = path.join(repoRoot, "geniusai-civilizations/packages/shared/src/index.ts");
  agents.push(
    ...importCivilizationsProfiles(
      await readFile(civilizationsSharedPath, "utf-8"),
      "geniusai-civilizations/packages/shared/src/index.ts",
    ),
  );

  return { agents, squads };
}
