import { describe, expect, it } from "vitest";
import {
  Agent,
  Approval,
  CanvasEdge,
  CanvasNode,
  Company,
  LearningFlow,
  MemoryChunk,
  MindClone,
  Pack,
  ProviderConfig,
  Run,
  Squad,
  Task,
} from "../src/schemas.js";

describe("schemas canônicos — round-trip parse/serialize", () => {
  it("Agent aceita o mínimo e aplica defaults", () => {
    const agent = Agent.parse({ id: "a1", nome: "Agente de Teste" });
    expect(agent.autonomia).toBe("A0");
    expect(agent.skills).toEqual([]);
    expect(JSON.parse(JSON.stringify(agent)).id).toBe("a1");
  });

  it("Agent aceita modelPolicy e origem importado", () => {
    const agent = Agent.parse({
      id: "a2",
      nome: "Agente de Qualificação de Leads",
      area: "Vendas",
      skills: ["enriquecer-lead"],
      modelPolicy: { default: "claude-sonnet" },
      autonomia: "A3",
      origem: "importado",
      origemDetalhe: "so-ia/src/lib/data/agents.ts",
    });
    expect(agent.modelPolicy?.default).toBe("claude-sonnet");
  });

  it("Squad referencia agentes e líder", () => {
    const squad = Squad.parse({
      id: "s1",
      nome: "Squad de Fundação",
      agentIds: ["a1", "a2"],
      liderAgentId: "a1",
      desempenho: 0.98,
      origem: "institucional",
    });
    expect(squad.agentIds).toHaveLength(2);
  });

  it("Company referencia squads", () => {
    const company = Company.parse({ id: "c1", nome: "Instituto Exemplo", squadIds: ["s1"] });
    expect(company.squadIds).toContain("s1");
  });

  it("MindClone exige as seis camadas com default vazio quando omitidas", () => {
    const clone = MindClone.parse({ id: "mc1", nome: "Marta" });
    expect(clone.identidade).toBe("");
    expect(clone.documentosReferencia).toEqual([]);
  });

  it("Pack é um bundle auto-contido", () => {
    const pack = Pack.parse({
      id: "p1",
      nome: "Pack de Licitações",
      agents: [{ id: "a1", nome: "Agente de Atesto" }],
      squads: [{ id: "s1", nome: "Squad de Licitações" }],
    });
    expect(pack.agents).toHaveLength(1);
    expect(pack.versao).toBe("1.0.0");
  });

  it("ProviderConfig nunca tem campo de chave em texto puro — só referência", () => {
    const provider = ProviderConfig.parse({
      id: "prov1",
      tipo: "ollama",
      nome: "Ollama local",
      baseUrl: "http://localhost:11434",
    });
    expect(provider).not.toHaveProperty("apiKey");
    expect(provider.apiKeyRef).toBeUndefined();
  });

  it("Task, Run e Approval encadeiam pelo id", () => {
    const task = Task.parse({ id: "t1", descricao: "Preparar atesto da NF 2041" });
    const run = Run.parse({ id: "r1", taskId: task.id, status: "em_execucao" });
    const approval = Approval.parse({ id: "ap1", runId: run.id, status: "pendente" });
    expect(run.taskId).toBe(task.id);
    expect(approval.runId).toBe(run.id);
  });

  it("LearningFlow e MemoryChunk carregam procedência", () => {
    const flow = LearningFlow.parse({
      id: "lf1",
      taskPattern: "atesto de nota fiscal",
      stepsGeneralized: "1. conferir NF contra empenho 2. citar página",
      agentOrSkillOrigin: "conferir-nf-contra-empenho",
      sourceRunId: "r1",
    });
    const chunk = MemoryChunk.parse({
      id: "mem1",
      text: flow.stepsGeneralized,
      sourceType: "learning-flow",
      sourceId: flow.id,
    });
    expect(chunk.sourceId).toBe(flow.id);
  });

  it("rejeita entidades sem os campos obrigatórios", () => {
    expect(() => Agent.parse({ id: "a3" })).toThrow();
    expect(() => Squad.parse({ nome: "sem id" })).toThrow();
  });

  it("CanvasNode exige posição e aceita os quatro tipos", () => {
    const note = CanvasNode.parse({ id: "cn1", kind: "note", position: { x: 10, y: 20 } });
    expect(note.log).toEqual([]);
    const execution = CanvasNode.parse({
      id: "cn2",
      kind: "execution",
      position: { x: 0, y: 0 },
      status: "executando",
      log: ["iniciado"],
    });
    expect(execution.status).toBe("executando");
    expect(() => CanvasNode.parse({ id: "cn3", kind: "note" })).toThrow();
    expect(() => CanvasNode.parse({ id: "cn4", kind: "invalido", position: { x: 0, y: 0 } })).toThrow();
  });

  it("CanvasEdge conecta dois nós pelo id", () => {
    const edge = CanvasEdge.parse({ id: "ce1", source: "cn1", target: "cn2" });
    expect(edge.source).toBe("cn1");
  });
});
