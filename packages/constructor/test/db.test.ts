import { Agent } from "@genius/canon";
import { beforeEach, describe, expect, it } from "vitest";
import { createRepository, migrate, openDatabase, type Repository } from "../src/db.js";

describe("camada de persistência (SQLite)", () => {
  let repo: Repository<Agent>;

  beforeEach(() => {
    const db = openDatabase(":memory:");
    migrate(db);
    repo = createRepository(db, "agents", Agent);
  });

  it("banco vazio lista []", () => {
    expect(repo.list()).toEqual([]);
  });

  it("insere, lê e lista uma entidade validada", () => {
    const inserted = repo.insert({ id: "a1", nome: "Agente de Teste" });
    expect(inserted.id).toBe("a1");
    expect(repo.getById("a1")?.nome).toBe("Agente de Teste");
    expect(repo.list()).toHaveLength(1);
  });

  it("rejeita entidade inválida (sem schema) antes de tocar o banco", () => {
    expect(() => repo.insert({ nome: "sem id" })).toThrow();
    expect(repo.list()).toHaveLength(0);
  });

  it("upsert por id (insert duas vezes com o mesmo id atualiza)", () => {
    repo.insert({ id: "a1", nome: "Nome 1" });
    repo.insert({ id: "a1", nome: "Nome 2" });
    expect(repo.list()).toHaveLength(1);
    expect(repo.getById("a1")?.nome).toBe("Nome 2");
  });

  it("update faz merge parcial e valida o resultado", () => {
    repo.insert({ id: "a1", nome: "Original", skills: ["x"] });
    const updated = repo.update("a1", { nome: "Atualizado" });
    expect(updated?.nome).toBe("Atualizado");
    expect(updated?.skills).toEqual(["x"]);
  });

  it("update em id inexistente devolve undefined", () => {
    expect(repo.update("fantasma", { nome: "x" })).toBeUndefined();
  });

  it("remove de fato o registro", () => {
    repo.insert({ id: "a1", nome: "Agente" });
    expect(repo.remove("a1")).toBe(true);
    expect(repo.getById("a1")).toBeUndefined();
    expect(repo.remove("a1")).toBe(false);
  });
});
