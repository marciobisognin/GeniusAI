import { randomUUID } from "node:crypto";
import { z } from "zod";

/**
 * Catálogo de eventos do Genius Allspark Canvas. Todo evento emitido por
 * qualquer pacote deve estar aqui — a suíte de testes falha se um evento
 * for emitido/consumido sem um schema de payload registrado (ver
 * `test/events.test.ts`), o que impede o "evento fantasma" que o Tradutor
 * de Eventos do PRD de produto precisa cobrir a 100%.
 */

export const EventType = z.enum([
  "agent.loaded",
  "squad.loaded",
  "company.created",
  "mindclone.created",
  "pack.imported",
  "pack.exported",
  "provider.registered",
  "provider.health_checked",
  "task.created",
  "task.step",
  "task.tool_call",
  "task.awaiting_approval",
  "task.completed",
  "task.failed",
  "run.started",
  "run.completed",
  "approval.granted",
  "approval.rejected",
  "learning.recorded",
  "learning.skill_promoted",
  "memory.indexed",
]);
export type EventType = z.infer<typeof EventType>;

export const EventEnvelope = z.object({
  id: z.string().min(1),
  type: EventType,
  ts: z.string().datetime(),
  correlationId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type EventEnvelope = z.infer<typeof EventEnvelope>;

/**
 * Schemas de payload por tipo de evento. Todo `EventType` declarado acima
 * deve ter uma entrada aqui — a cobertura é verificada em
 * `test/events.test.ts`.
 */
export const EventPayloadSchemas: Record<EventType, z.ZodTypeAny> = {
  "agent.loaded": z.object({ agentId: z.string(), origem: z.string() }),
  "squad.loaded": z.object({ squadId: z.string(), origem: z.string() }),
  "company.created": z.object({ companyId: z.string() }),
  "mindclone.created": z.object({ mindCloneId: z.string(), nome: z.string() }),
  "pack.imported": z.object({ packId: z.string(), nome: z.string() }),
  "pack.exported": z.object({ packId: z.string(), nome: z.string() }),
  "provider.registered": z.object({ providerId: z.string(), tipo: z.string() }),
  "provider.health_checked": z.object({ providerId: z.string(), healthy: z.boolean() }),
  "task.created": z.object({ taskId: z.string(), descricao: z.string() }),
  "task.step": z.object({ runId: z.string(), message: z.string() }),
  "task.tool_call": z.object({ runId: z.string(), tool: z.string() }),
  "task.awaiting_approval": z.object({ runId: z.string(), approvalId: z.string() }),
  "task.completed": z.object({ runId: z.string(), taskId: z.string() }),
  "task.failed": z.object({ runId: z.string(), reason: z.string() }),
  "run.started": z.object({ runId: z.string(), taskId: z.string() }),
  "run.completed": z.object({ runId: z.string() }),
  "approval.granted": z.object({ approvalId: z.string(), runId: z.string() }),
  "approval.rejected": z.object({ approvalId: z.string(), runId: z.string() }),
  "learning.recorded": z.object({ learningFlowId: z.string(), sourceRunId: z.string() }),
  "learning.skill_promoted": z.object({ skillId: z.string(), agentId: z.string() }),
  "memory.indexed": z.object({ chunkId: z.string(), sourceType: z.string() }),
};

/** Valida o envelope e, se houver schema de payload registrado, o payload também. */
export function parseEvent(raw: unknown): EventEnvelope {
  const envelope = EventEnvelope.parse(raw);
  const payloadSchema = EventPayloadSchemas[envelope.type];
  if (payloadSchema) {
    payloadSchema.parse(envelope.payload);
  }
  return envelope;
}

export function createEvent(
  type: EventType,
  payload: Record<string, unknown>,
  correlationId: string,
  id: string = randomUUID(),
): EventEnvelope {
  const envelope: EventEnvelope = {
    id,
    type,
    ts: new Date().toISOString(),
    correlationId,
    payload,
  };
  return parseEvent(envelope);
}
