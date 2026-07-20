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

export interface RecordedLearning {
  flow: LearningFlow;
  /** Presente só quando esta aprovação cruzou o limiar e promoveu uma Skill nova. */
  promotedSkill: Skill | null;
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
): Promise<RecordedLearning | null> {
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

  return { flow, promotedSkill: proposedSkill };
}

/** Formata os resultados da busca semântica como contexto pronto para injetar no prompt de sistema. */
export function formatMemoryContext(results: MemorySearchResult[]): string {
  return results.map((r) => `- ${r.text}`).join("\n");
}

export interface MemoryProvenance {
  /** A tarefa em linguagem natural que originou este trecho — não o UUID do LearningFlow. */
  taskDescricao: string;
  /** Agente/líder responsável pela execução de origem. */
  agenteNome: string | undefined;
  /** Data em que o aprendizado foi registrado (a aprovação humana). */
  aprovadoEm: string;
}

/** Resolve um `sourceId` (id do LearningFlow) para algo que um humano lê — não um UUID solto. */
function resolveProcedencia(sourceId: string, sourceType: string, repos: LearningRepos): MemoryProvenance | null {
  if (sourceType !== "learning-flow") return null;
  const flow = repos.learningFlows.getById(sourceId);
  if (!flow) return null;
  const run = repos.runs.getById(flow.sourceRunId);
  const task = run ? repos.tasks.getById(run.taskId) : undefined;
  const agent = repos.agents.getById(flow.agentOrSkillOrigin);
  return {
    taskDescricao: task?.descricao ?? flow.taskPattern,
    agenteNome: agent?.nome,
    aprovadoEm: flow.createdAt,
  };
}

export function registerLearningRoutes(app: FastifyInstance, memory: LearningMemory, repos: LearningRepos) {
  app.get("/memory/search", async (request, reply) => {
    const { q, k } = request.query as { q?: string; k?: string };
    if (!q) return reply.code(400).send({ error: "missing_query", detail: "informe ?q=" });
    const topK = Number(k) > 0 ? Number(k) : 5;
    const results = await memory.search(q, topK);
    return results.map((r) => ({
      ...r,
      procedencia: resolveProcedencia(r.sourceId, r.sourceType, repos),
    }));
  });
}
