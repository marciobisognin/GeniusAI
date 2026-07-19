import type { Agent, Squad } from "@genius/canon";
import type { CompletionInput, CompletionOutput, LLMProviderAdapter } from "@genius/providers";
import { describe, expect, it } from "vitest";
import type { ExecutionEvent } from "../src/events.js";
import { runSquadTurn } from "../src/runSquadTurn.js";

class FakeAdapter implements LLMProviderAdapter {
  readonly name: string;
  public calls: CompletionInput[] = [];
  constructor(
    private readonly response: string,
    name = "fake",
  ) {
    this.name = name;
  }
  async healthy() {
    return true;
  }
  async complete(input: CompletionInput): Promise<CompletionOutput> {
    this.calls.push(input);
    return { text: this.response };
  }
}

function agent(id: string, nome: string, autonomia: Agent["autonomia"] = "A2"): Agent {
  return {
    id,
    nome,
    descricao: "",
    skills: [],
    connectors: [],
    autonomia,
    origem: "criado",
    createdAt: new Date().toISOString(),
  };
}

const SQUAD: Squad = {
  id: "s1",
  nome: "Squad de Teste",
  descricao: "",
  agentIds: ["a1", "a2"],
  liderAgentId: "a1",
  origem: "criado",
  createdAt: new Date().toISOString(),
};

describe("runSquadTurn", () => {
  it("cada membro recebe a tarefa e o líder consolida as contribuições", async () => {
    const membro1 = agent("a1", "Líder Um");
    const membro2 = agent("a2", "Membro Dois");
    const adapterMembro1 = new FakeAdapter("contribuição do líder", "m1");
    const adapterMembro2 = new FakeAdapter("contribuição do membro 2", "m2");
    const adapterConsolidacao = new FakeAdapter("resposta final consolidada", "consolidador");

    let chamadasAoLider = 0;
    const adapterFor = (a: Agent): LLMProviderAdapter => {
      if (a.id === "a1") {
        chamadasAoLider += 1;
        return chamadasAoLider === 1 ? adapterMembro1 : adapterConsolidacao;
      }
      return adapterMembro2;
    };

    const events: ExecutionEvent[] = [];
    const result = await runSquadTurn({
      squad: SQUAD,
      members: [membro1, membro2],
      leader: membro1,
      adapterFor,
      taskDescription: "Preparar relatório",
      runId: "run1",
      onEvent: (e) => events.push(e),
    });

    expect(adapterMembro2.calls[0].prompt).toBe("Preparar relatório");
    expect(adapterConsolidacao.calls[0].system).toContain("Líder Um");
    expect(adapterConsolidacao.calls[0].prompt).toContain("contribuição do líder");
    expect(adapterConsolidacao.calls[0].prompt).toContain("contribuição do membro 2");
    expect(result.text).toBe("resposta final consolidada");
  });

  it("gate de aprovação usa a autonomia do LÍDER, não dos membros", async () => {
    const lider = agent("a1", "Líder A3", "A3");
    const membro = agent("a2", "Membro A0", "A0");
    const adapter = new FakeAdapter("ok");
    const result = await runSquadTurn({
      squad: SQUAD,
      members: [lider, membro],
      leader: lider,
      adapterFor: () => adapter,
      taskDescription: "tarefa",
      runId: "run1",
      onEvent: () => {},
    });
    expect(result.requiresApproval).toBe(false);
  });
});
