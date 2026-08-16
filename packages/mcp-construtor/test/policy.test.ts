import { describe, expect, it } from "vitest";
import {
  AUTONOMY_REQUIRING_APPROVAL,
  FORBIDDEN_ROUTES,
  READABLE_ENTITIES,
  decideExecution,
  requiresHumanApproval,
} from "../src/policy.js";
import { CONSTRUCTOR_TOOLS } from "../src/tools.js";

/**
 * Estes testes existem para que alargar a superfície do servidor seja uma
 * decisão consciente. Se alguém expuser a resolução de aprovações ou a escrita
 * de credenciais, algum destes falha.
 */
describe("a superfície é assimétrica de propósito", () => {
  it("provedores não são legíveis — guardam credenciais", () => {
    expect(READABLE_ENTITIES).not.toContain("providers");
  });

  it("nenhuma ferramenta alcança as rotas proibidas", () => {
    const código = CONSTRUCTOR_TOOLS.map((tool) => tool.handler.toString()).join("\n");
    for (const trecho of ["approvals/", "/providers", "library/import", "packs/import", "import-pack"]) {
      expect(código, `alguma ferramenta toca ${trecho}`).not.toContain(trecho);
    }
  });

  it("a lista de rotas proibidas cobre aprovação, credencial e importação", () => {
    const texto = FORBIDDEN_ROUTES.join(" ");
    expect(texto).toContain("approvals/:id/resolve");
    expect(texto).toContain("providers");
    expect(texto).toContain("import");
  });

  it("as ferramentas de escrita se limitam a executar e exportar", () => {
    const escrita = CONSTRUCTOR_TOOLS.filter((tool) => tool.handler.toString().includes("post("));
    expect(escrita.map((tool) => tool.name).sort()).toEqual([
      "constructor_execute",
      "constructor_export_pack",
      "constructor_match_agent",
      "constructor_match_squad",
    ]);
  });
});

describe("autonomia decide quem executa", () => {
  it("A0–A2 exigem aprovação humana", () => {
    for (const autonomia of AUTONOMY_REQUIRING_APPROVAL) {
      expect(requiresHumanApproval(autonomia), autonomia).toBe(true);
    }
  });

  it("A3+ executa sozinho", () => {
    for (const autonomia of ["A3", "A4", "A5"]) {
      expect(requiresHumanApproval(autonomia), autonomia).toBe(false);
    }
  });

  it("valor inesperado cai do lado seguro — exige aprovação", () => {
    // Lista de permissão, não de bloqueio: nulo, vazio ou um nível novo que
    // ainda não existe não podem escapar do portão por omissão.
    for (const valor of [undefined, "", "A9", "a4", "sim", "null"]) {
      expect(requiresHumanApproval(valor), String(valor)).toBe(true);
    }
  });

  it("recusa execução de agente A2 explicando o motivo", () => {
    const decision = decideExecution({ kind: "agent", autonomias: ["A2"] });
    expect(decision.permitido).toBe(false);
    expect(decision.motivo).toContain("aprovação humana");
    expect(decision.motivo).toContain("Canvas");
  });

  it("permite execução de agente A4", () => {
    expect(decideExecution({ kind: "agent", autonomias: ["A4"] }).permitido).toBe(true);
  });

  it("um squad é bloqueado pelo membro de menor autonomia", () => {
    const decision = decideExecution({ kind: "squad", autonomias: ["A5", "A4", "A1"] });
    expect(decision.permitido).toBe(false);
    expect(decision.autonomia).toBe("A1");
  });

  it("sem autonomia conhecida, não executa", () => {
    const decision = decideExecution({ kind: "agent", autonomias: [] });
    expect(decision.permitido).toBe(false);
    expect(decision.motivo).toContain("na dúvida");
  });

  it("nó que não é agente nem squad não executa", () => {
    expect(decideExecution({ kind: "note", autonomias: ["A5"] }).permitido).toBe(false);
  });
});
