import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { Agent, Approval, CanvasNode, ProviderConfig, Run, RunStep, Task } from "@genius/canon";
import { createAdapter } from "@genius/providers";
import { runAgentTurn, runSquadTurn, type ExecutionEvent } from "@genius/execution";
import { LearningMemory } from "@genius/learning";
import type { FastifyInstance } from "fastify";
import type { Repository } from "./db.js";
import { formatMemoryContext, recordApprovedRun, type LearningRepos } from "./learning.js";

export interface ExecutionRepos extends LearningRepos {
  canvasNodes: Repository<CanvasNode>;
  providers: Repository<ProviderConfig>;
  approvals: Repository<Approval>;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Motor de Execução (Etapa 5), integrado ao Super Construtor: `POST
 * /execution/run` dispara em segundo plano (não bloqueia a requisição — o
 * "▶" no canvas é fire-and-forget); `GET /execution/runs/:id/events`
 * retransmite ao vivo por SSE (com replay do que já aconteceu, para quem
 * conectar atrasado); `POST /approvals/:id/resolve` é o gatilho humano que
 * completa ou derruba uma execução pausada em A0–A2.
 */
export function registerExecutionRoutes(app: FastifyInstance, repos: ExecutionRepos, memory: LearningMemory) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(100);

  function persistStep(runId: string, event: ExecutionEvent) {
    const run = repos.runs.getById(runId);
    if (!run) return;
    const step: RunStep = {
      ts: event.ts,
      type: event.type,
      message: event.message,
      approvalId: event.approvalId,
      autonomia: event.autonomia,
    };
    repos.runs.update(runId, { steps: [...run.steps, step] });
  }

  async function executeInBackground(run: Run, task: Task, kind: "agent" | "squad", adapter: ReturnType<typeof createAdapter>) {
    // Preenchido antes de chamar runAgentTurn/runSquadTurn — é o Agent (ou líder do Squad) cuja
    // autonomia decide se a execução pausa; o onEvent usa isto para o canvas explicar o "porquê".
    let autonomiaResponsavel: string | undefined;

    const onEvent = (event: ExecutionEvent) => {
      let finalEvent = event;
      if (event.type === "task.awaiting_approval") {
        const approval = repos.approvals.insert({
          id: randomUUID(),
          runId: run.id,
          status: "pendente",
          createdAt: nowIso(),
        });
        finalEvent = { ...event, approvalId: approval.id, autonomia: autonomiaResponsavel };
      }
      persistStep(run.id, finalEvent);
      emitter.emit(run.id, finalEvent);
    };

    try {
      // Etapa 6: busca na memória indexada antes de rodar — o sistema literalmente fica melhor a cada aprovação.
      const memoryResults = await memory.search(task.descricao, 3);
      const memoryContext = memoryResults.length > 0 ? formatMemoryContext(memoryResults) : undefined;
      if (memoryContext) {
        onEvent({
          type: "task.step",
          runId: run.id,
          message: `Memória: ${memoryResults.length} trecho(s) relevante(s) de execuções aprovadas anteriores injetado(s) como contexto.`,
          ts: nowIso(),
        });
      }

      let result: { requiresApproval: boolean };
      if (kind === "agent") {
        const agent = repos.agents.getById(run.agentId!)!;
        autonomiaResponsavel = agent.autonomia;
        result = await runAgentTurn({ agent, adapter, taskDescription: task.descricao, runId: run.id, onEvent, memoryContext });
      } else {
        const squad = repos.squads.getById(run.squadId!)!;
        const members = squad.agentIds.map((id) => repos.agents.getById(id)).filter((a): a is Agent => Boolean(a));
        const leader = (squad.liderAgentId && repos.agents.getById(squad.liderAgentId)) || members[0];
        autonomiaResponsavel = leader.autonomia;
        result = await runSquadTurn({
          squad,
          members,
          leader,
          adapterFor: () => adapter,
          taskDescription: task.descricao,
          runId: run.id,
          onEvent,
          memoryContext,
        });
      }
      const status = result.requiresApproval ? "requer_aprovacao" : "concluido";
      repos.runs.update(run.id, { status, completedAt: result.requiresApproval ? undefined : nowIso() });
      repos.tasks.update(task.id, { status });
    } catch (err) {
      const failEvent: ExecutionEvent = { type: "task.failed", runId: run.id, message: String(err), ts: nowIso() };
      persistStep(run.id, failEvent);
      emitter.emit(run.id, failEvent);
      repos.runs.update(run.id, { status: "falhou", completedAt: nowIso() });
      repos.tasks.update(task.id, { status: "falhou" });
    }
  }

  app.post("/execution/run", async (request, reply) => {
    const { canvasNodeId, taskDescription } = request.body as { canvasNodeId: string; taskDescription: string };

    const node = repos.canvasNodes.getById(canvasNodeId);
    if (!node) return reply.code(404).send({ error: "not_found", detail: "canvas node" });
    if (node.kind !== "agent" && node.kind !== "squad") {
      return reply.code(400).send({ error: "not_executable", detail: "só nós de agente ou squad podem ser executados" });
    }
    if (!node.refId) {
      return reply.code(400).send({ error: "missing_ref", detail: "este nó não está ligado a um Agent/Squad real" });
    }
    if (!node.providerId) {
      return reply.code(400).send({ error: "missing_provider", detail: "configure um provedor para este nó antes de executar" });
    }
    const providerConfig = repos.providers.getById(node.providerId);
    if (!providerConfig) return reply.code(404).send({ error: "not_found", detail: "provider" });

    let adapter: ReturnType<typeof createAdapter>;
    try {
      adapter = createAdapter(providerConfig);
    } catch (err) {
      return reply.code(400).send({ error: "adapter_error", detail: String(err) });
    }

    if (node.kind === "agent" && !repos.agents.getById(node.refId)) {
      return reply.code(404).send({ error: "not_found", detail: "agent" });
    }
    if (node.kind === "squad") {
      const squad = repos.squads.getById(node.refId);
      if (!squad) return reply.code(404).send({ error: "not_found", detail: "squad" });
      if (squad.agentIds.length === 0) {
        return reply.code(400).send({ error: "empty_squad", detail: "squad sem membros" });
      }
    }

    const task = repos.tasks.insert({
      id: randomUUID(),
      descricao: taskDescription,
      nodeId: canvasNodeId,
      status: "em_execucao",
      createdAt: nowIso(),
    });
    const run = repos.runs.insert({
      id: randomUUID(),
      taskId: task.id,
      agentId: node.kind === "agent" ? node.refId : undefined,
      squadId: node.kind === "squad" ? node.refId : undefined,
      providerId: node.providerId,
      status: "em_execucao",
      steps: [],
      startedAt: nowIso(),
    });

    void executeInBackground(run, task, node.kind, adapter);

    return reply.code(202).send({ runId: run.id, taskId: task.id });
  });

  app.get("/execution/runs/:id/events", async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = repos.runs.getById(id);
    if (!run) return reply.code(404).send({ error: "not_found" });

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // reply.hijack() sai do ciclo normal do Fastify, então o hook onSend do
      // @fastify/cors nunca roda aqui — sem isto o EventSource do navegador
      // falha em silêncio (CORS) e o ExecutionNode nunca recebe eventos.
      "Access-Control-Allow-Origin": request.headers.origin ?? "*",
      Vary: "Origin",
    });

    for (const step of run.steps) {
      reply.raw.write(
        `data: ${JSON.stringify({ type: step.type, runId: id, message: step.message, ts: step.ts, approvalId: step.approvalId, autonomia: step.autonomia })}\n\n`,
      );
    }

    const listener = (event: ExecutionEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    emitter.on(id, listener);
    request.raw.on("close", () => {
      emitter.off(id, listener);
      reply.raw.end();
    });
  });

  app.post("/approvals/:id/resolve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const approval = repos.approvals.getById(id);
    if (!approval) return reply.code(404).send({ error: "not_found" });

    const body = request.body as { status: "aprovado" | "rejeitado"; comentario?: string; decididoPor?: string };
    if (body.status !== "aprovado" && body.status !== "rejeitado") {
      return reply.code(400).send({ error: "invalid_status" });
    }

    const updated = repos.approvals.update(id, {
      status: body.status,
      comentario: body.comentario,
      decididoPor: body.decididoPor,
      decididoEm: nowIso(),
    })!;

    const run = repos.runs.getById(approval.runId);
    if (run) {
      const lastStep = run.steps.at(-1);
      const finalStatus = body.status === "aprovado" ? "concluido" : "falhou";
      repos.runs.update(run.id, { status: finalStatus, completedAt: nowIso() });
      repos.tasks.update(run.taskId, { status: finalStatus });

      const event: ExecutionEvent = {
        type: body.status === "aprovado" ? "task.completed" : "task.failed",
        runId: run.id,
        message: body.status === "aprovado" ? (lastStep?.message ?? "") : `Rejeitado: ${body.comentario ?? "sem comentário"}`,
        ts: nowIso(),
      };
      persistStep(run.id, event);
      emitter.emit(run.id, event);

      // Etapa 6: toda aprovação positiva vira aprendizado — best-effort, uma
      // falha aqui (ex.: provedor indisponível) não pode derrubar a aprovação já concluída.
      // O que foi aprendido volta na resposta, para o canvas poder CONTAR ao
      // usuário que o sistema aprendeu (em vez de aprender em silêncio).
      if (body.status === "aprovado" && run.providerId) {
        const providerConfig = repos.providers.getById(run.providerId);
        if (providerConfig) {
          try {
            const adapter = createAdapter(providerConfig);
            const learning = await recordApprovedRun(run.id, repos, memory, adapter);
            if (learning) {
              return {
                ...updated,
                aprendizado: {
                  taskPattern: learning.flow.taskPattern,
                  tags: learning.flow.tags,
                  skillPromovida: learning.promotedSkill?.nome ?? null,
                },
              };
            }
          } catch {
            // silencioso de propósito — o aprendizado é um extra, não pode quebrar a aprovação humana.
          }
        }
      }
    }

    return updated;
  });
}
