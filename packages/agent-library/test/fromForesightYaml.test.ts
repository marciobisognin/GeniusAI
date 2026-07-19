import { describe, expect, it } from "vitest";
import { importForesightAgents } from "../src/fromForesightYaml.js";

const CAUSAL_FORECASTER_YAML = `
id: causal-forecaster
name: Cientista Causal
role: Cientista Causal
objective: Define world state, DAG/SCM, baselines, regimes, distribuições e forecast contract quantitativo.
allowed_tools:
  - read_evidence
  - write_structured_artifact
`;

describe("importForesightAgents — YAML declarativo do geniusai-foresight", () => {
  it("mapeia um agente YAML para o canon", () => {
    const agents = importForesightAgents([
      { path: "geniusai-foresight/agents/causal-forecaster.yaml", content: CAUSAL_FORECASTER_YAML },
    ]);
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({
      id: "causal-forecaster",
      nome: "Cientista Causal",
      area: "Cientista Causal",
      descricao: "Define world state, DAG/SCM, baselines, regimes, distribuições e forecast contract quantitativo.",
      skills: ["read_evidence", "write_structured_artifact"],
      origem: "importado",
      origemDetalhe: "geniusai-foresight/agents/causal-forecaster.yaml",
    });
  });

  it("aceita múltiplos arquivos de uma vez", () => {
    const agents = importForesightAgents([
      { path: "a.yaml", content: `id: a\nname: A\nrole: R\nobjective: O` },
      { path: "b.yaml", content: `id: b\nname: B\nrole: R2\nobjective: O2` },
    ]);
    expect(agents.map((a) => a.id)).toEqual(["a", "b"]);
  });
});
