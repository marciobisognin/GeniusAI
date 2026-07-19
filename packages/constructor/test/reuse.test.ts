import type { Agent, Squad } from "@genius/canon";
import { describe, expect, it } from "vitest";
import { matchAgent, matchSquad, synthesizeAgentDraft, synthesizeSquadDraft } from "../src/reuse.js";

const AGENTE_ATESTO: Agent = {
  id: "agente-atesto-nf",
  nome: "Agente de Atesto de Nota Fiscal",
  area: "Orçamento e Finanças",
  descricao: "Lê a NF-e, confere contra o empenho no SIPAC e checa regularidade fiscal.",
  skills: ["ler-nota-fiscal", "conferir-nf-contra-empenho", "checar-regularidade-fiscal"],
  connectors: [],
  autonomia: "A2",
  origem: "importado",
  createdAt: new Date().toISOString(),
};

const SQUAD_FINANCAS: Squad = {
  id: "tpl-financas",
  nome: "Squad de Orçamento e Finanças",
  area: "Orçamento e Finanças",
  descricao: "Atesto de notas fiscais, conciliação e execução orçamentária/financeira.",
  agentIds: [],
  origem: "importado",
  createdAt: new Date().toISOString(),
};

describe("matchAgent — mesmo algoritmo de so-ia/src/lib/org/matching.ts", () => {
  it("reaproveita um agente existente com sobreposição suficiente de vocabulário", () => {
    const result = matchAgent(
      { titulo: "Fiscal de Atesto de Nota Fiscal", area: "Finanças", responsabilidades: ["conferir nota fiscal", "checar regularidade fiscal"] },
      [AGENTE_ATESTO],
    );
    expect(result.candidate?.id).toBe("agente-atesto-nf");
    expect(result.score).toBeGreaterThan(0.34);
  });

  it("não reaproveita quando o papel não tem nada a ver com os candidatos", () => {
    const result = matchAgent(
      { titulo: "Especialista em Paisagismo", area: "Jardinagem", responsabilidades: ["podar árvores"] },
      [AGENTE_ATESTO],
    );
    expect(result.candidate).toBeNull();
  });

  it("lista vazia de candidatos nunca reaproveita", () => {
    const result = matchAgent({ titulo: "Qualquer coisa" }, []);
    expect(result.candidate).toBeNull();
    expect(result.score).toBe(0);
  });
});

describe("synthesizeAgentDraft", () => {
  it("gera skills a partir das responsabilidades (slugify)", () => {
    const draft = synthesizeAgentDraft({ titulo: "Fiscal de Contratos", responsabilidades: ["Checar Vigência", "Alertar Prazos"] });
    expect(draft.nome).toBe("Agente de Fiscal de Contratos");
    expect(draft.skills).toEqual(["checar-vigencia", "alertar-prazos"]);
    expect(draft.origem).toBe("gerado");
  });

  it("sem responsabilidades, usa o próprio título como skill", () => {
    const draft = synthesizeAgentDraft({ titulo: "Recepcionista Digital" });
    expect(draft.skills).toEqual(["recepcionista-digital"]);
  });
});

describe("matchSquad — mesmo algoritmo de so-ia/src/lib/org/squad-registry.ts", () => {
  it("reaproveita um squad existente compatível com a área", () => {
    const result = matchSquad({ titulo: "Financeiro", area: "Orçamento e Finanças" }, [SQUAD_FINANCAS]);
    expect(result.candidate?.id).toBe("tpl-financas");
  });

  it("não reaproveita quando a área não bate (limiar 0.5, mais rígido que agentes)", () => {
    const result = matchSquad({ titulo: "Marketing Digital", area: "Marketing" }, [SQUAD_FINANCAS]);
    expect(result.candidate).toBeNull();
  });
});

describe("synthesizeSquadDraft", () => {
  it("segue a convenção do so-ia: origem 'criado', desempenho inicial 0.75", () => {
    const draft = synthesizeSquadDraft({ titulo: "Nova Área", area: "Sustentabilidade", responsabilidades: ["medir pegada de carbono"] });
    expect(draft.nome).toBe("Squad de Sustentabilidade");
    expect(draft.origem).toBe("criado");
    expect(draft.desempenho).toBe(0.75);
  });
});
