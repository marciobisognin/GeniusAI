import type { LearningFlow, Skill } from "@genius/canon";
import { describe, expect, it } from "vitest";
import { maybePromoteSkill } from "../src/skillPromotion.js";

function flow(agentOrSkillOrigin: string, tags: string[]): LearningFlow {
  return {
    id: crypto.randomUUID(),
    taskPattern: "padrão",
    stepsGeneralized: "passos",
    agentOrSkillOrigin,
    tags,
    sourceRunId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

describe("maybePromoteSkill", () => {
  it("abaixo do limiar não propõe nada", () => {
    const flows = [flow("a1", ["conferencia-nf"]), flow("a1", ["conferencia-nf"])];
    const result = maybePromoteSkill({ agentId: "a1", tags: ["conferencia-nf"], existingFlows: flows, existingSkills: [], threshold: 3 });
    expect(result).toBeNull();
  });

  it("no limiar, propõe uma Skill nova com origem 'gerada'", () => {
    const flows = [flow("a1", ["conferencia-nf"]), flow("a1", ["conferencia-nf"]), flow("a1", ["conferencia-nf"])];
    const result = maybePromoteSkill({ agentId: "a1", tags: ["conferencia-nf"], existingFlows: flows, existingSkills: [], threshold: 3 });
    expect(result?.nome).toBe("conferencia-nf");
    expect(result?.origem).toBe("gerada");
  });

  it("não conta flows de outro agente para o limiar", () => {
    const flows = [flow("outro-agente", ["conferencia-nf"]), flow("outro-agente", ["conferencia-nf"]), flow("outro-agente", ["conferencia-nf"])];
    const result = maybePromoteSkill({ agentId: "a1", tags: ["conferencia-nf"], existingFlows: flows, existingSkills: [], threshold: 3 });
    expect(result).toBeNull();
  });

  it("não propõe de novo uma skill que já existe (mesmo nome)", () => {
    const flows = [flow("a1", ["conferencia-nf"]), flow("a1", ["conferencia-nf"]), flow("a1", ["conferencia-nf"])];
    const existingSkills: Skill[] = [{ id: "s1", nome: "conferencia-nf", descricao: "", origem: "gerada" }];
    const result = maybePromoteSkill({ agentId: "a1", tags: ["conferencia-nf"], existingFlows: flows, existingSkills, threshold: 3 });
    expect(result).toBeNull();
  });
});
