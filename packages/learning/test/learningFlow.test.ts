import type { Agent, Run, Task } from "@genius/canon";
import type { CompletionInput, CompletionOutput, LLMProviderAdapter } from "@genius/providers";
import { describe, expect, it } from "vitest";
import { generalizeRun } from "../src/learningFlow.js";

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

const AGENT: Agent = {
  id: "agente-atesto-nf",
  nome: "Agente de Atesto de Nota Fiscal",
  descricao: "",
  skills: ["conferir-nf-contra-empenho"],
  connectors: [],
  autonomia: "A2",
  origem: "importado",
  createdAt: new Date().toISOString(),
};

const TASK: Task = {
  id: "t1",
  descricao: "Confira a NF 2041 do contrato 12/2025",
  status: "concluido",
  createdAt: new Date().toISOString(),
};

const RUN: Run = {
  id: "r1",
  taskId: "t1",
  agentId: "agente-atesto-nf",
  status: "concluido",
  steps: [
    { ts: new Date().toISOString(), type: "task.step", message: 'Agente "Agente de Atesto de Nota Fiscal" iniciando a tarefa.' },
    { ts: new Date().toISOString(), type: "task.awaiting_approval", message: "Atesto conferido: NF 2041 confere com o empenho 12/2025." },
  ],
};

describe("generalizeRun", () => {
  it("parseia o formato estruturado PADRAO/PASSOS/TAGS", async () => {
    const adapter = new FakeAdapter(
      "PADRAO: Conferir se uma NF confere com o empenho correspondente\nPASSOS: Localizar a NF e o empenho, comparar valores e número de contrato, registrar o atesto\nTAGS: conferencia-nf, atesto, financeiro",
    );
    const result = await generalizeRun({ task: TASK, run: RUN, agent: AGENT, adapter });

    expect(result.taskPattern).toBe("Conferir se uma NF confere com o empenho correspondente");
    expect(result.stepsGeneralized).toContain("Localizar a NF");
    expect(result.tags).toEqual(["conferencia-nf", "atesto", "financeiro"]);
    expect(adapter.lastInput?.prompt).toContain(TASK.descricao);
    expect(adapter.lastInput?.prompt).toContain("Atesto conferido");
  });

  it("cai para um resumo honesto (não inventa estrutura) quando o modelo não segue o formato", async () => {
    const adapter = new FakeAdapter("Isso foi feito conferindo a nota fiscal manualmente, sem seguir um roteiro fixo.");
    const result = await generalizeRun({ task: TASK, run: RUN, agent: AGENT, adapter });

    expect(result.taskPattern).toBe(TASK.descricao);
    expect(result.stepsGeneralized).toContain("conferindo a nota fiscal");
    expect(result.tags).toEqual(["conferir-nf-contra-empenho"]);
  });
});
