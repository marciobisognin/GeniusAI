import { beforeEach, describe, expect, it } from "vitest";
import {
  assembleOrganization,
  buildOrgWorkflow,
  buildSquads,
  createMemorySquadStore,
  createSquadTemplate,
  findSquadTemplate,
  loadRepository,
  organizationCovers,
  parseOrgText,
  setSquadStore,
  templateGoverno,
  type OrgNode,
} from "../src/index.js";

const CONTRATOS: OrgNode = {
  id: "n1",
  titulo: "Coordenação de Licitações e Contratos",
  area: "Licitações e Contratos",
  responsabilidades: ["fiscalizar contratos", "instruir processos de compra"],
  parentId: null,
};

const ENSINO: OrgNode = {
  id: "n2",
  titulo: "Diretoria de Ensino",
  area: "Ensino",
  responsabilidades: ["coordenar os cursos"],
  parentId: null,
};

describe("Lei 1 — nada existe sem o organograma", () => {
  it("cobre um assunto quando a área existe no organograma", () => {
    expect(organizationCovers({ area: "Licitações e Contratos" }, [CONTRATOS])).toBe(true);
  });

  it("não cobre uma área ausente do organograma", () => {
    expect(organizationCovers({ area: "Marketing", texto: "campanha de mídia paga" }, [CONTRATOS])).toBe(false);
  });

  it("organograma vazio não cobre nada", () => {
    expect(organizationCovers({ area: "Ensino" }, [])).toBe(false);
  });

  it("cobre pelo texto quando as responsabilidades tratam do assunto", () => {
    expect(
      organizationCovers({ area: "Compras", texto: "fiscalizar contrato administrativo" }, [CONTRATOS]),
    ).toBe(true);
  });

  it("aceita variação morfológica do português (contrato/contratos/contratual)", () => {
    expect(organizationCovers({ area: "Contratual" }, [CONTRATOS])).toBe(true);
  });
});

describe("importação de organograma", () => {
  it("lê uma linha por cargo e avisa quando não há hierarquia", () => {
    const result = parseOrgText("Reitoria\nPró-Reitoria de Ensino");
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].titulo).toBe("Reitoria");
    expect(result.nodes.every((node) => node.parentId === null)).toBe(true);
    expect(result.warnings.join(" ")).toContain("hierarquia");
  });

  it("infere hierarquia pela indentação", () => {
    const result = parseOrgText("Comercial\n  Vendas\n  Pré-vendas");
    expect(result.nodes).toHaveLength(3);
    const raiz = result.nodes[0];
    expect(result.nodes.slice(1).every((node) => node.parentId === raiz.id)).toBe(true);
  });

  it("texto vazio não produz nós", () => {
    expect(parseOrgText("").nodes).toHaveLength(0);
  });
});

describe("montagem da organização", () => {
  it("atribui um agente a cada função do organograma", () => {
    const assignments = assembleOrganization([CONTRATOS, ENSINO]);
    expect(assignments).toHaveLength(2);
    for (const assignment of assignments) {
      expect(assignment.agent).toBeTruthy();
      expect(["catalogo", "gerado"]).toContain(assignment.origem);
    }
  });

  it("gera agente quando o catálogo não tem correspondência", () => {
    const exotic: OrgNode = {
      id: "n9",
      titulo: "Setor de Zoologia Aplicada",
      area: "Zoologia Aplicada",
      responsabilidades: ["observar aves"],
      parentId: null,
    };
    expect(assembleOrganization([exotic])[0].origem).toBe("gerado");
  });

  it("monta squads a partir das atribuições", () => {
    const squads = buildSquads(assembleOrganization(templateGoverno));
    expect(squads.length).toBeGreaterThan(0);
    for (const squad of squads) expect(squad.membros.length).toBeGreaterThan(0);
  });

  it("deriva um workflow da atribuição", () => {
    const workflow = buildOrgWorkflow(assembleOrganization([CONTRATOS])[0]);
    expect(workflow.steps.length).toBeGreaterThan(0);
  });
});

describe("persistência de squads criados", () => {
  beforeEach(() => setSquadStore(null));

  it("por padrão não persiste — mesmo comportamento do so-ia fora do navegador", () => {
    const before = loadRepository().length;
    createSquadTemplate("Patrimônio", ["inventariar bens"]);
    expect(loadRepository()).toHaveLength(before);
  });

  it("persiste quando um store é injetado", () => {
    setSquadStore(createMemorySquadStore());
    const before = loadRepository().length;
    createSquadTemplate("Patrimônio", ["inventariar bens"]);
    expect(loadRepository()).toHaveLength(before + 1);
    expect(findSquadTemplate("Patrimônio")?.origem).toBe("criado");
  });

  it("não duplica o mesmo squad criado", () => {
    setSquadStore(createMemorySquadStore());
    createSquadTemplate("Patrimônio", ["inventariar bens"]);
    const afterFirst = loadRepository().length;
    createSquadTemplate("Patrimônio", ["inventariar bens"]);
    expect(loadRepository()).toHaveLength(afterFirst);
  });

  it("dryRun nunca escreve", () => {
    setSquadStore(createMemorySquadStore());
    const before = loadRepository().length;
    createSquadTemplate("Patrimônio", ["inventariar bens"], { dryRun: true });
    expect(loadRepository()).toHaveLength(before);
  });
});
