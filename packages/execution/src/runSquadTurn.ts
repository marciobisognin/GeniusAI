import type { Agent, Squad } from "@genius/canon";
import type { LLMProviderAdapter } from "@genius/providers";
import type { ExecutionEvent } from "./events.js";
import { nowIso } from "./events.js";
import { buildPersonaPrompt, requiresApproval } from "./persona.js";
import type { RunTurnResult } from "./runAgentTurn.js";

export interface RunSquadTurnInput {
  squad: Squad;
  /** Membros do squad, na ordem de `squad.agentIds` (já resolvidos do banco pelo chamador). */
  members: Agent[];
  /** O líder — normalmente `squad.liderAgentId` resolvido; cai para `members[0]` se ausente. */
  leader: Agent;
  /** Cada membro pode ter um provedor diferente configurado no seu nó. */
  adapterFor: (agent: Agent) => LLMProviderAdapter;
  taskDescription: string;
  runId: string;
  onEvent: (event: ExecutionEvent) => void;
  /** Trechos relevantes recuperados da memória indexada (Etapa 6) — opcional, o chamador decide se busca. */
  memoryContext?: string;
}

/**
 * Decompõe a tarefa entre os membros do squad (cada um recebe a mesma
 * descrição — a decomposição por sub-tarefa fica para uma iteração
 * futura, não finge inteligência que ainda não existe) e o líder consolida
 * as contribuições numa resposta final.
 */
export async function runSquadTurn(input: RunSquadTurnInput): Promise<RunTurnResult> {
  const { squad, members, leader, adapterFor, taskDescription, runId, onEvent, memoryContext } = input;

  onEvent({
    type: "task.step",
    runId,
    message: `Squad "${squad.nome}" decompondo a tarefa entre ${members.length} membro(s).`,
    ts: nowIso(),
  });

  const contributions: string[] = [];
  for (const member of members) {
    onEvent({ type: "task.step", runId, message: `${member.nome} está trabalhando na tarefa.`, ts: nowIso() });
    onEvent({ type: "task.tool_call", runId, message: `${member.nome} chamando o modelo.`, ts: nowIso() });
    const result = await adapterFor(member).complete({
      system: buildPersonaPrompt(member, memoryContext),
      prompt: taskDescription,
    });
    contributions.push(`${member.nome}: ${result.text}`);
  }

  onEvent({ type: "task.step", runId, message: `${leader.nome} (líder) consolidando as contribuições.`, ts: nowIso() });
  const consolidation = await adapterFor(leader).complete({
    system: buildPersonaPrompt(leader, memoryContext),
    prompt: `Tarefa original: ${taskDescription}\n\nContribuições da equipe:\n${contributions.join("\n\n")}\n\nConsolide isso numa resposta final única, coesa.`,
  });

  const needsApproval = requiresApproval(leader.autonomia);
  onEvent({
    type: needsApproval ? "task.awaiting_approval" : "task.completed",
    runId,
    message: consolidation.text,
    ts: nowIso(),
  });

  return { text: consolidation.text, requiresApproval: needsApproval };
}
