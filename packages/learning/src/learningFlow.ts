import type { Agent, Run, Task } from "@genius/canon";
import type { LLMProviderAdapter } from "@genius/providers";

export interface GeneralizedFlow {
  taskPattern: string;
  stepsGeneralized: string;
  tags: string[];
}

function buildGeneralizationPrompt(task: Task, run: Run): string {
  const stepsText = run.steps.map((s) => `- [${s.type}] ${s.message}`).join("\n");
  return [
    `Tarefa original: ${task.descricao}`,
    "",
    "Passos executados e aprovados por um humano:",
    stepsText,
    "",
    "Generalize isso num procedimento reutilizável para tarefas semelhantes.",
    "Responda em EXATAMENTE três linhas, neste formato:",
    "PADRAO: <uma frase descrevendo o padrão geral da tarefa, sem os detalhes específicos deste caso>",
    "PASSOS: <resumo generalizado dos passos que deram certo>",
    "TAGS: <1 a 4 palavras-chave separadas por vírgula>",
  ].join("\n");
}

/** Parser tolerante: se o modelo não seguir o formato, cai para um resumo honesto em vez de inventar estrutura. */
function parseGeneralization(text: string, fallbackTaskPattern: string): GeneralizedFlow {
  const padrao = /PADRAO:\s*(.+)/i.exec(text)?.[1]?.trim();
  const passos = /PASSOS:\s*(.+)/i.exec(text)?.[1]?.trim();
  const tagsLine = /TAGS:\s*(.+)/i.exec(text)?.[1]?.trim();

  if (padrao && passos) {
    const tags = (tagsLine ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    return { taskPattern: padrao, stepsGeneralized: passos, tags };
  }

  return { taskPattern: fallbackTaskPattern, stepsGeneralized: text.trim(), tags: [] };
}

export interface GeneralizeRunInput {
  task: Task;
  run: Run;
  agent: Agent;
  adapter: LLMProviderAdapter;
}

/** Pede ao provedor configurado para generalizar uma execução aprovada num procedimento reutilizável. */
export async function generalizeRun(input: GeneralizeRunInput): Promise<GeneralizedFlow> {
  const { task, run, agent, adapter } = input;
  const completion = await adapter.complete({
    system: `Você ajuda a documentar procedimentos operacionais a partir de execuções reais do agente "${agent.nome}".`,
    prompt: buildGeneralizationPrompt(task, run),
  });
  const parsed = parseGeneralization(completion.text, task.descricao);
  if (parsed.tags.length === 0) {
    parsed.tags = agent.skills.slice(0, 3);
  }
  return parsed;
}
