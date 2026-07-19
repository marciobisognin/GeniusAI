import type { Agent } from "@genius/canon";
import type { CompletionInput, CompletionOutput, LLMProviderAdapter } from "@genius/providers";
import { describe, expect, it } from "vitest";
import { runAgentTurn } from "../src/runAgentTurn.js";
import type { ExecutionEvent } from "../src/events.js";

class FakeAdapter implements LLMProviderAdapter {
  readonly name = "fake";
  public lastInput: CompletionInput | null = null;
  constructor(private readonly response: string) {}
  async healthy() {
    return true;
  }
  async complete(input: CompletionInput): Promise<CompletionOutput> {
    this.lastInput = input;
    return { text: this.response };
  }
}

function baseAgent(overrides: Partial<Agent>): Agent {
  return {
    id: "a1",
    nome: "Agente de Teste",
    descricao: "Faz coisas de teste.",
    skills: ["testar"],
    connectors: [],
    autonomia: "A2",
    origem: "criado",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("runAgentTurn", () => {
  it("monta a persona no prompt de sistema e chama o adapter", async () => {
    const adapter = new FakeAdapter("resposta do agente");
    const events: ExecutionEvent[] = [];
    const agent = baseAgent({ nome: "Agente de Atesto", area: "Finanças", autonomia: "A3" });

    const result = await runAgentTurn({
      agent,
      adapter,
      taskDescription: "Conferir a NF 123",
      runId: "run1",
      onEvent: (e) => events.push(e),
    });

    expect(adapter.lastInput?.system).toContain("Agente de Atesto");
    expect(adapter.lastInput?.system).toContain("Finanças");
    expect(adapter.lastInput?.prompt).toBe("Conferir a NF 123");
    expect(result.text).toBe("resposta do agente");
  });

  it("A3+ completa direto (task.completed), sem aprovação", async () => {
    const events: ExecutionEvent[] = [];
    const result = await runAgentTurn({
      agent: baseAgent({ autonomia: "A3" }),
      adapter: new FakeAdapter("ok"),
      taskDescription: "tarefa",
      runId: "run1",
      onEvent: (e) => events.push(e),
    });
    expect(result.requiresApproval).toBe(false);
    expect(events.map((e) => e.type)).toContain("task.completed");
    expect(events.map((e) => e.type)).not.toContain("task.awaiting_approval");
  });

  it.each(["A0", "A1", "A2"])("autonomia %s sempre pausa para aprovação (task.awaiting_approval)", async (autonomia) => {
    const events: ExecutionEvent[] = [];
    const result = await runAgentTurn({
      agent: baseAgent({ autonomia: autonomia as Agent["autonomia"] }),
      adapter: new FakeAdapter("rascunho"),
      taskDescription: "tarefa",
      runId: "run1",
      onEvent: (e) => events.push(e),
    });
    expect(result.requiresApproval).toBe(true);
    expect(events.at(-1)?.type).toBe("task.awaiting_approval");
    expect(events.at(-1)?.message).toBe("rascunho");
  });

  it("emite task.step e task.tool_call antes do resultado, em ordem", async () => {
    const events: ExecutionEvent[] = [];
    await runAgentTurn({
      agent: baseAgent({ autonomia: "A3" }),
      adapter: new FakeAdapter("ok"),
      taskDescription: "tarefa",
      runId: "run1",
      onEvent: (e) => events.push(e),
    });
    expect(events.map((e) => e.type)).toEqual(["task.step", "task.tool_call", "task.completed"]);
  });
});
