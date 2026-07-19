import { z } from "zod";

/**
 * Entidades canônicas do Genius Allspark Canvas — usadas por todos os
 * pacotes (`providers`, `agent-library`, `constructor`, `execution`,
 * `learning`) e pelo app `apps/canvas`. Nenhum pacote deve definir seu
 * próprio formato de Agent/Squad/etc. — sempre importar daqui.
 */

export const AutonomyLevel = z.enum(["A0", "A1", "A2", "A3", "A4", "A5"]);
export type AutonomyLevel = z.infer<typeof AutonomyLevel>;

export const EntityOrigin = z.enum([
  "catalogo",
  "gerado",
  "importado",
  "mind-clone",
  "institucional",
  "criado",
]);
export type EntityOrigin = z.infer<typeof EntityOrigin>;

export const ModelPolicy = z.object({
  default: z.string().min(1),
  fallback: z.string().min(1).optional(),
});
export type ModelPolicy = z.infer<typeof ModelPolicy>;

export const Agent = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  area: z.string().optional(),
  descricao: z.string().default(""),
  skills: z.array(z.string()).default([]),
  connectors: z.array(z.string()).default([]),
  modelPolicy: ModelPolicy.optional(),
  autonomia: AutonomyLevel.default("A0"),
  origem: EntityOrigin.default("criado"),
  origemDetalhe: z.string().optional(),
  mindCloneId: z.string().optional(),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().optional(),
});
export type Agent = z.infer<typeof Agent>;

export const Squad = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  area: z.string().optional(),
  descricao: z.string().default(""),
  agentIds: z.array(z.string()).default([]),
  liderAgentId: z.string().optional(),
  desempenho: z.number().min(0).max(1).optional(),
  origem: EntityOrigin.default("criado"),
  origemDetalhe: z.string().optional(),
  companyId: z.string().optional(),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type Squad = z.infer<typeof Squad>;

export const Company = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  descricao: z.string().optional(),
  squadIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type Company = z.infer<typeof Company>;

/** Perfil cognitivo estruturado de uma pessoa real — a base de DNA de um Agent. */
export const MindClone = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  identidade: z.string().default(""),
  conhecimento: z.string().default(""),
  raciocinioOperacional: z.string().default(""),
  comunicacao: z.string().default(""),
  restricoes: z.string().default(""),
  evolucao: z.string().default(""),
  documentosReferencia: z.array(z.string()).default([]),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type MindClone = z.infer<typeof MindClone>;

export const Skill = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  descricao: z.string().default(""),
  origem: z.enum(["catalogo", "gerada"]).default("gerada"),
});
export type Skill = z.infer<typeof Skill>;

/** Bundle portátil: exportação/importação de um recorte do sistema. */
export const Pack = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  versao: z.string().default("1.0.0"),
  agents: z.array(Agent).default([]),
  squads: z.array(Squad).default([]),
  skills: z.array(Skill).default([]),
  workflows: z.array(z.record(z.string(), z.unknown())).default([]),
});
export type Pack = z.infer<typeof Pack>;

export const ProviderType = z.enum([
  "anthropic",
  "openai-chat",
  "openai-codex",
  "ollama",
  "openai-compatible",
]);
export type ProviderType = z.infer<typeof ProviderType>;

export const ProviderConfig = z.object({
  id: z.string().min(1),
  tipo: ProviderType,
  nome: z.string().min(1),
  baseUrl: z.string().optional(),
  /** Nunca a chave em texto puro — referência ao keychain/variável de ambiente. */
  apiKeyRef: z.string().optional(),
  model: z.string().optional(),
  /** Binário/CLI para provedores baseados em processo (ex.: "openai-codex", "codex" ou caminho absoluto). */
  cmd: z.string().optional(),
  healthy: z.boolean().optional(),
  lastCheckedAt: z.string().datetime().optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfig>;

export const TaskStatus = z.enum([
  "rascunho",
  "planejado",
  "em_execucao",
  "bloqueado",
  "requer_aprovacao",
  "concluido",
  "concluido_com_ressalvas",
  "cancelado",
  "falhou",
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const Task = z.object({
  id: z.string().min(1),
  descricao: z.string().min(1),
  nodeId: z.string().optional(),
  status: TaskStatus.default("rascunho"),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type Task = z.infer<typeof Task>;

export const RunStep = z.object({
  ts: z.string().datetime(),
  type: z.string(),
  message: z.string(),
  /** Presente só em `task.awaiting_approval` — precisa sobreviver ao replay do SSE para quem conecta depois do evento ao vivo. */
  approvalId: z.string().optional(),
});
export type RunStep = z.infer<typeof RunStep>;

export const Run = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  agentId: z.string().optional(),
  squadId: z.string().optional(),
  providerId: z.string().optional(),
  status: TaskStatus.default("planejado"),
  steps: z.array(RunStep).default([]),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});
export type Run = z.infer<typeof Run>;

export const ApprovalStatus = z.enum(["pendente", "aprovado", "rejeitado"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const Approval = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  status: ApprovalStatus.default("pendente"),
  comentario: z.string().optional(),
  decididoPor: z.string().optional(),
  decididoEm: z.string().datetime().optional(),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type Approval = z.infer<typeof Approval>;

export const LearningFlow = z.object({
  id: z.string().min(1),
  taskPattern: z.string().min(1),
  stepsGeneralized: z.string().min(1),
  agentOrSkillOrigin: z.string().min(1),
  tags: z.array(z.string()).default([]),
  sourceRunId: z.string().min(1),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type LearningFlow = z.infer<typeof LearningFlow>;

export const MemoryChunkSourceType = z.enum([
  "learning-flow",
  "mind-clone-doc",
  "approved-result",
]);
export type MemoryChunkSourceType = z.infer<typeof MemoryChunkSourceType>;

export const MemoryChunk = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  sourceType: MemoryChunkSourceType,
  sourceId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type MemoryChunk = z.infer<typeof MemoryChunk>;

/**
 * Camada do Motor do Canvas (Etapa 1) — onde cada nó vive no espaço e o que
 * ele referencia. Um `CanvasNode` de tipo "agent"/"squad" aponta (`refId`)
 * para um `Agent`/`Squad` real; "note" e "execution" são autocontidos.
 */
export const CanvasNodeKind = z.enum(["agent", "squad", "note", "execution"]);
export type CanvasNodeKind = z.infer<typeof CanvasNodeKind>;

export const CanvasPosition = z.object({
  x: z.number(),
  y: z.number(),
});
export type CanvasPosition = z.infer<typeof CanvasPosition>;

export const ExecutionNodeStatus = z.enum([
  "aguardando",
  "executando",
  "aguardando_aprovacao",
  "concluido",
  "erro",
]);
export type ExecutionNodeStatus = z.infer<typeof ExecutionNodeStatus>;

export const CanvasNode = z.object({
  id: z.string().min(1),
  kind: CanvasNodeKind,
  refId: z.string().optional(),
  title: z.string().default(""),
  content: z.string().default(""),
  status: ExecutionNodeStatus.optional(),
  log: z.array(z.string()).default([]),
  position: CanvasPosition,
  /** Provedor LLM padrão deste nó (id de um ProviderConfig) — usado por Agent/Squad. */
  providerId: z.string().optional(),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().optional(),
});
export type CanvasNode = z.infer<typeof CanvasNode>;

export const CanvasEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type CanvasEdge = z.infer<typeof CanvasEdge>;
