import { fileURLToPath } from "node:url";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { loadFromRepo } from "@genius/agent-library";
import type { Repository } from "./db.js";
import type { Agent, Squad } from "@genius/canon";

/** packages/constructor/{src,dist} → sobe 3 níveis até a raiz do monorepo (funciona tanto compilado quanto via tsx/vitest). */
export const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export interface LibraryImportRepos {
  agents: Repository<Agent>;
  squads: Repository<Squad>;
}

/**
 * `POST /library/import`: roda os importadores de verdade contra os
 * arquivos reais de so-ia/foresight/civilizations (Etapa 3) e devolve um
 * diff (novo × já existente) — o import é sempre idempotente (upsert por
 * id), então rodar de novo depois que os arquivos de origem mudarem apenas
 * atualiza o que já existe.
 */
export function registerLibraryImport(
  app: FastifyInstance,
  repos: LibraryImportRepos,
  options: { repoRoot?: string } = {},
) {
  app.post("/library/import", async (_request, reply) => {
    const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
    let loaded: Awaited<ReturnType<typeof loadFromRepo>>;
    try {
      loaded = await loadFromRepo(repoRoot);
    } catch (err) {
      return reply.code(500).send({ error: "import_failed", detail: String(err) });
    }

    const agentesNovos: string[] = [];
    const agentesExistentes: string[] = [];
    for (const agent of loaded.agents) {
      (repos.agents.getById(agent.id) ? agentesExistentes : agentesNovos).push(agent.id);
      repos.agents.insert(agent);
    }

    const squadsNovos: string[] = [];
    const squadsExistentes: string[] = [];
    for (const squad of loaded.squads) {
      (repos.squads.getById(squad.id) ? squadsExistentes : squadsNovos).push(squad.id);
      repos.squads.insert(squad);
    }

    return {
      agentesNovos,
      agentesExistentes,
      squadsNovos,
      squadsExistentes,
      totalAgentes: loaded.agents.length,
      totalSquads: loaded.squads.length,
    };
  });
}
