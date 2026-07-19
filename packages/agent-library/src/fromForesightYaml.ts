import { Agent } from "@genius/canon";
import { parse as parseYaml } from "yaml";

/** Formato bruto de `geniusai-foresight/agents/*.yaml` — só os campos que este importador lê. */
interface RawForesightAgent {
  id: string;
  name: string;
  role: string;
  objective: string;
  allowed_tools?: string[];
}

export interface ForesightYamlFile {
  /** Caminho relativo (ex.: "geniusai-foresight/agents/causal-forecaster.yaml"), para origemDetalhe. */
  path: string;
  content: string;
}

/**
 * Converte os agentes declarativos do `geniusai-foresight` (um YAML por
 * agente: `causal-forecaster.yaml`, `country-profiler.yaml`,
 * `evidence-auditor.yaml`, `game-theory-modeler.yaml`,
 * `intake-orchestrator.yaml`, `red-team-calibrator.yaml`,
 * `report-narrator.yaml`, `simulation-engineer.yaml`) para o schema `Agent`
 * do canon. Puro: recebe o conteúdo já lido, não abre arquivo nenhum.
 */
export function importForesightAgents(files: ForesightYamlFile[]): Agent[] {
  return files.map(({ path, content }) => {
    const raw = parseYaml(content) as RawForesightAgent;
    return Agent.parse({
      id: raw.id,
      nome: raw.name,
      area: raw.role,
      descricao: raw.objective,
      skills: raw.allowed_tools ?? [],
      origem: "importado",
      origemDetalhe: path,
    });
  });
}
