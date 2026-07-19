import { randomUUID } from "node:crypto";
import type { Agent, LearningFlow, MemoryChunk, Run, Skill, Squad, Task } from "@genius/canon";
import { generalizeRun, LearningMemory, maybePromoteSkill, type MemorySearchResult } from "@genius/learning";
import type { LLMProviderAdapter } from "@genius/providers";
import type { FastifyInstance } from "fastify";
import type { Repository } from "./db.js";

export interface LearningRepos {
  tasks: Repository<Task>;
  runs: Repository<Run>;
  agents: Repository<Agent>;
  squads: Repository<Squad>;
  learningFlows: Repository<LearningFlow>;
  memoryChunks: Repository<MemoryChunk>;
  skills: Repository<Skill>;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Resolve o "agente de origem" de um Run — o próprio Agent, ou o líder (ou primeiro membro) do Squad. */
function resolveOriginAgent(run: Run, repos: LearningRepos): Agent | undefined {
  if (run.agentId) return repos.agents.getById(run.agentId);
  if (run.squadId) {
    const squad = repos.squads.getById(run.squadId);
    if (!squad) return undefined;
    const leaderId = squad.liderAgentId ?? squad.agentIds[0];
    return leaderId ? repos.agents.getById(leaderId) : undefined;
  }
  return undefined;
}

/**
 * Gatilho da Etapa 6: chamado quando uma `Approval` vira "aprovado" (Etapa
 * 5). Generaliza a execução num `LearningFlow`, indexa o resultado na
 * memória vetorial, e verifica se o padrão já se repetiu o suficiente para
 * virar uma `Skill` formal.
 */
export async function recordApprovedRun(
  runId: string,
  repos: LearningRepos,
  memory: LearningMemory,
  adapter: LLMProviderAdapter,
): Promise<LearningFlow | null> {
  const run = repos.runs.getById(runId);
  if (!run) return null;
  const task = repos.tasks.getById(run.taskId);
  const agent = resolveOriginAgent(run, repos);
  if (!task || !agent) return null;

  const generalized = await generalizeRun({ task, run, agent, adapter });
  const flow = repos.learningFlows.insert({
    id: randomUUID(),
    taskPattern: generalized.taskPattern,
    stepsGeneralized: generalized.stepsGeneralized,
    agentOrSkillOrigin: agent.id,
    tags: generalized.tags,
    sourceRunId: run.id,
    createdAt: nowIso(),
  });

  const chunkText = `${flow.taskPattern}\n${flow.stepsGeneralized}`;
  const chunk = repos.memoryChunks.insert({
    id: randomUUID(),
    text: chunkText,
    sourceType: "learning-flow",
    sourceId: flow.id,
    metadata: { agentId: agent.id, tags: flow.tags },
    createdAt: nowIso(),
  });
  await memory.indexChunk({
    id: chunk.id,
    text: chunk.text,
    sourceType: chunk.sourceType,
    sourceId: chunk.sourceId,
    createdAt: chunk.createdAt,
  });

  const proposedSkill = maybePromoteSkill({
    agentId: agent.id,
    tags: flow.tags,
    existingFlows: repos.learningFlows.list(),
    existingSkills: repos.skills.list(),
  });
  if (proposedSkill) repos.skills.insert(proposedSkill);

  return flow;
}

/** Formata os resultados da busca semântica como contexto pronto para injetar no prompt de sistema. */
export function formatMemoryContext(results: MemorySearchResult[]): string {
  return results.map((r) => `- ${r.text}`).join("\n");
}

export function registerLearningRoutes(app: FastifyInstance, memory: LearningMemory) {
  app.get("/memory/search", async (request, reply) => {
    const { q, k } = request.query as { q?: string; k?: string };
    if (!q) return reply.code(400).send({ error: "missing_query", detail: "informe ?q=" });
    const topK = Number(k) > 0 ? Number(k) : 5;
    return memory.search(q, topK);
  });
}
