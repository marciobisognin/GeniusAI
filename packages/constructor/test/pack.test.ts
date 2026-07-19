import { beforeEach, describe, expect, it } from "vitest";
import { Agent, Company, Squad } from "@genius/canon";
import { createRepository, migrate, openDatabase } from "../src/db.js";
import { CompanyNotFoundError, exportCompanyAsPack, importPackIntoCompany, type PackRepos } from "../src/pack.js";

describe("exportCompanyAsPack / importPackIntoCompany — ida e volta sem perdas", () => {
  let repos: PackRepos;

  beforeEach(() => {
    const db = openDatabase(":memory:");
    migrate(db);
    repos = {
      agents: createRepository(db, "agents", Agent),
      squads: createRepository(db, "squads", Squad),
      companies: createRepository(db, "companies", Company),
    };
  });

  it("lança CompanyNotFoundError ao exportar uma Company inexistente", () => {
    expect(() => exportCompanyAsPack("fantasma", repos)).toThrow(CompanyNotFoundError);
  });

  it("exporta uma Company com seus squads e os agentes desses squads", () => {
    repos.agents.insert({ id: "a1", nome: "Agente Um" });
    repos.agents.insert({ id: "a2", nome: "Agente Dois" });
    repos.squads.insert({ id: "s1", nome: "Squad Um", agentIds: ["a1", "a2"] });
    repos.companies.insert({ id: "c1", nome: "Instituto Exemplo", squadIds: ["s1"] });

    const pack = exportCompanyAsPack("c1", repos);
    expect(pack.nome).toBe("Instituto Exemplo");
    expect(pack.squads).toHaveLength(1);
    expect(pack.agents.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("critério de aceite da Etapa 4: exportar e reimportar em uma Company vazia produz o mesmo resultado", () => {
    repos.agents.insert({ id: "a1", nome: "Agente Um", skills: ["x"] });
    repos.squads.insert({ id: "s1", nome: "Squad Um", agentIds: ["a1"], desempenho: 0.9 });
    repos.companies.insert({ id: "origem", nome: "Empresa Origem", squadIds: ["s1"] });

    const pack = exportCompanyAsPack("origem", repos);

    const emptyCompany = repos.companies.insert({ id: "destino", nome: "Empresa Destino", squadIds: [] });
    expect(emptyCompany.squadIds).toEqual([]);

    const result = importPackIntoCompany(pack, "destino", repos);
    // "s1"/"a1" já existiam no catálogo global (vieram da Company de origem) —
    // "novo" descreve o catálogo, não a Company; por isso aparecem como
    // "existentes" aqui. O que prova o critério de aceite é a associação:
    expect(result.squadsExistentes).toEqual(["s1"]);
    expect(result.agentesExistentes).toEqual(["a1"]);
    expect(result.company.squadIds).toEqual(["s1"]);

    // O squad importado agora pertence à Company de destino.
    expect(repos.squads.getById("s1")?.companyId).toBe("destino");

    // Reexportar a Company de destino produz um Pack com os mesmos agentes/squads do original.
    const reexported = exportCompanyAsPack("destino", repos);
    expect(reexported.agents.map((a) => a.id)).toEqual(pack.agents.map((a) => a.id));
    expect(reexported.squads.map((s) => s.id)).toEqual(pack.squads.map((s) => s.id));
    expect(reexported.agents[0].skills).toEqual(pack.agents[0].skills);
  });

  it("reimportar o mesmo Pack na mesma Company é idempotente (upsert, sem duplicar)", () => {
    repos.agents.insert({ id: "a1", nome: "Agente Um" });
    repos.squads.insert({ id: "s1", nome: "Squad Um", agentIds: ["a1"] });
    repos.companies.insert({ id: "c1", nome: "Empresa", squadIds: ["s1"] });
    const pack = exportCompanyAsPack("c1", repos);

    const first = importPackIntoCompany(pack, "c1", repos);
    expect(first.agentesNovos).toEqual([]); // já existiam antes mesmo da 1ª importação (é a própria origem)
    expect(first.agentesExistentes).toEqual(["a1"]);

    const second = importPackIntoCompany(pack, "c1", repos);
    expect(second.agentesExistentes).toEqual(["a1"]);
    expect(repos.companies.getById("c1")?.squadIds).toEqual(["s1"]); // sem duplicar
  });

  it("importar num id de Company inexistente lança CompanyNotFoundError", () => {
    repos.agents.insert({ id: "a1", nome: "Agente" });
    repos.squads.insert({ id: "s1", nome: "Squad", agentIds: ["a1"] });
    repos.companies.insert({ id: "c1", nome: "Empresa", squadIds: ["s1"] });
    const pack = exportCompanyAsPack("c1", repos);

    expect(() => importPackIntoCompany(pack, "fantasma", repos)).toThrow(CompanyNotFoundError);
  });
});
