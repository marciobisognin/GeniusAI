import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadFromRepo } from "../src/loadFromRepo.js";

// packages/agent-library/test -> packages/agent-library -> packages -> raiz do monorepo
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("loadFromRepo — integração contra os arquivos REAIS deste repositório (não fixtures)", () => {
  it("importa os agentes e squads reais de so-ia, foresight e civilizations", async () => {
    const { agents, squads } = await loadFromRepo(REPO_ROOT);

    // so-ia: 6 agentsEmpresa + 6 agentsGoverno = 12 (ver so-ia/src/lib/data/agents.ts)
    // foresight: 8 arquivos .yaml em geniusai-foresight/agents/
    // civilizations: 4 civilizações em DEFAULT_CIVILIZATIONS
    const soIaAgents = agents.filter((a) => a.origemDetalhe === "so-ia/src/lib/data/agents.ts");
    const foresightAgents = agents.filter((a) => a.origemDetalhe?.startsWith("geniusai-foresight/agents/"));
    const civAgents = agents.filter(
      (a) => a.origemDetalhe === "geniusai-civilizations/packages/shared/src/index.ts",
    );

    expect(soIaAgents).toHaveLength(12);
    expect(foresightAgents).toHaveLength(8);
    expect(civAgents).toHaveLength(4);
    expect(agents).toHaveLength(soIaAgents.length + foresightAgents.length + civAgents.length);

    expect(squads).toHaveLength(7); // institutionalSquads, incluindo o squad de fundação (ver squad-registry.ts)

    // Agentes-âncora citados no PRD/README devem estar presentes de verdade.
    expect(agents.some((a) => a.id === "agente-atesto-nf")).toBe(true);
    expect(agents.some((a) => a.id === "agente-pesquisa-precos")).toBe(true);
    expect(squads.some((s) => s.id === "tpl-fundacao")).toBe(true);

    // Os líderes das 4 civilizações do README (Roma/Egito/Grécia/Mali).
    const lideres = civAgents.map((a) => a.nome).sort();
    expect(lideres).toEqual(["Cleópatra", "César", "Mansa Musa", "Péricles"].sort());

    // Todo agente/squad importado é validado pelo canon — id, nome e origem nunca vazios.
    for (const agent of agents) {
      expect(agent.id.length).toBeGreaterThan(0);
      expect(agent.nome.length).toBeGreaterThan(0);
      expect(agent.origem).toBe("importado");
    }
  });
});
