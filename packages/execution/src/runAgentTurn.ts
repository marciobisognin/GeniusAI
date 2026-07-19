import type { Agent } from "@genius/canon";
import type { LLMProviderAdapter } from "@genius/providers";
import type { ExecutionEvent } from "./events.js";
import { nowIso } from "./events.js";
import { buildPersonaPrompt, requiresApproval } from "./persona.js";

export interface RunAgentTurnInput {
  agent: Agent;
  adapter: LLMProviderAdapter;
  taskDescription: string;
  runId: string;
  onEvent: (event: ExecutionEvent) => void;
  /** Trechos relevantes recuperados da memória indexada (Etapa 6) — opcional, o chamador decide se busca. */
  memoryContext?: string;
}

export interface RunTurnResult {
  text: string;
  requiresApproval: boolean;
}

/** Executa a tarefa de UM agente: monta a persona, chama o provedor, decide se precisa de aprovação. */
export async function runAgentTurn(input: RunAgentTurnInput): Promise<RunTurnResult> {
  const { agent, adapter, taskDescription, runId, onEvent, memoryContext } = input;

  onEvent({ type: "task.step", runId, message: `Agente "${agent.nome}" iniciando a tarefa.`, ts: nowIso() });
  onEvent({ type: "task.tool_call", runId, message: `Chamando o modelo via provedor "${adapter.name}".`, ts: nowIso() });

  const completion = await adapter.complete({
    system: buildPersonaPrompt(agent, memoryContext),
    prompt: taskDescription,
  });

  const needsApproval = requiresApproval(agent.autonomia);
  onEvent({
    type: needsApproval ? "task.awaiting_approval" : "task.completed",
    runId,
    message: completion.text,
    ts: nowIso(),
  });

  return { text: completion.text, requiresApproval: needsApproval };
}
