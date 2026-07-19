import path from "node:path";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import {
  Agent,
  Approval,
  CanvasEdge,
  CanvasNode,
  Company,
  LearningFlow,
  MemoryChunk,
  MindClone,
  Pack,
  ProviderConfig,
  Run,
  Squad,
  Task,
} from "@genius/canon";
import { createAdapter } from "@genius/providers";
import { createRepository, migrate, openDatabase, type Repository } from "./db.js";
import { registerExecutionRoutes } from "./execution.js";
import { DEFAULT_REPO_ROOT, registerLibraryImport } from "./libraryImport.js";
import { CompanyNotFoundError, exportCompanyAsPack, importPackIntoCompany, type PackRepos } from "./pack.js";
import { listAvailablePackFiles, readPackFile } from "./packsDir.js";
import { matchAgent, matchSquad, synthesizeAgentDraft, synthesizeSquadDraft, type RoleSpec } from "./reuse.js";

export interface BuildServerOptions {
  dbPath?: string;
  /** Raiz do monorepo, para a Etapa 3 (POST /library/import) achar so-ia/foresight/civilizations. */
  repoRoot?: string;
  /** Pasta de packs a observar (Etapa 4). Padrão: <repoRoot>/packs. */
  packsDir?: string;
}

export interface ConstructorServer {
  app: FastifyInstance;
  repos: ReturnType<typeof buildRepositories>;
}

function buildRepositories(db: ReturnType<typeof openDatabase>) {
  return {
    agents: createRepository(db, "agents", Agent),
    squads: createRepository(db, "squads", Squad),
    companies: createRepository(db, "companies", Company),
    mindClones: createRepository(db, "mind_clones", MindClone),
    providers: createRepository(db, "providers", ProviderConfig),
    tasks: createRepository(db, "tasks", Task),
    runs: createRepository(db, "runs", Run),
    approvals: createRepository(db, "approvals", Approval),
    learningFlows: createRepository(db, "learning_flows", LearningFlow),
    memoryChunks: createRepository(db, "memory_chunks", MemoryChunk),
    canvasNodes: createRepository(db, "canvas_nodes", CanvasNode),
    canvasEdges: createRepository(db, "canvas_edges", CanvasEdge),
  };
}

function registerCrud(app: FastifyInstance, path: string, repo: Repository<{ id: string }>) {
  app.get(`/${path}`, async () => repo.list());

  app.get(`/${path}/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const entity = repo.getById(id);
    if (!entity) return reply.code(404).send({ error: "not_found" });
    return entity;
  });

  app.post(`/${path}`, async (request, reply) => {
    try {
      const entity = repo.insert(request.body);
      return reply.code(201).send(entity);
    } catch (err) {
      return reply.code(400).send({ error: "invalid_entity", detail: String(err) });
    }
  });

  app.patch(`/${path}/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const updated = repo.update(id, request.body as Record<string, unknown>);
      if (!updated) return reply.code(404).send({ error: "not_found" });
      return updated;
    } catch (err) {
      return reply.code(400).send({ error: "invalid_entity", detail: String(err) });
    }
  });

  app.delete(`/${path}/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const removed = repo.remove(id);
    return reply.code(removed ? 204 : 404).send();
  });
}

/**
 * Testa a conexão de um provedor de verdade — chama `healthy()` do adapter
 * real (HTTP ou processo, conforme o tipo) e persiste o resultado. A chamada
 * de rede/processo acontece aqui, no servidor — nunca no navegador, para que
 * a chave de API (resolvida de `apiKeyRef` via variável de ambiente) nunca
 * trafegue para o cliente.
 */
function registerProviderHealthCheck(app: FastifyInstance, repo: Repository<ProviderConfig>) {
  app.post("/providers/:id/health-check", async (request, reply) => {
    const { id } = request.params as { id: string };
    const config = repo.getById(id);
    if (!config) return reply.code(404).send({ error: "not_found" });

    let healthy: boolean;
    try {
      const adapter = createAdapter(config);
      healthy = await adapter.healthy();
    } catch (err) {
      return reply.code(400).send({ error: "adapter_error", detail: String(err) });
    }

    const updated = repo.update(id, { healthy, lastCheckedAt: new Date().toISOString() });
    return updated;
  });
}

/**
 * "Reaproveitar ou criar" (Etapa 4): busca um candidato compatível entre o
 * que já existe; nunca grava sozinho — devolve também um `draft` pronto
 * para o chamador decidir (via POST /agents ou /squads normal) se quer
 * mesmo criar um novo registro.
 */
function registerReuseRoutes(app: FastifyInstance, repos: { agents: Repository<Agent>; squads: Repository<Squad> }) {
  app.post("/agents/match", async (request) => {
    const spec = request.body as RoleSpec;
    const { candidate, score } = matchAgent(spec, repos.agents.list());
    return { candidate, score, draft: synthesizeAgentDraft(spec) };
  });

  app.post("/squads/match", async (request) => {
    const spec = request.body as RoleSpec;
    const { candidate, score } = matchSquad(spec, repos.squads.list());
    return { candidate, score, draft: synthesizeSquadDraft(spec) };
  });
}

/** Exportar/importar Companies como Pack, e observar a pasta `packs/` do repositório (Etapa 4). */
function registerPackRoutes(app: FastifyInstance, repos: PackRepos, packsDir: string) {
  app.post("/companies/:id/export-pack", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return exportCompanyAsPack(id, repos);
    } catch (err) {
      if (err instanceof CompanyNotFoundError) return reply.code(404).send({ error: "not_found" });
      throw err;
    }
  });

  app.post("/companies/:id/import-pack", async (request, reply) => {
    const { id } = request.params as { id: string };
    let pack: Pack;
    try {
      pack = Pack.parse(request.body);
    } catch (err) {
      return reply.code(400).send({ error: "invalid_pack", detail: String(err) });
    }
    try {
      return importPackIntoCompany(pack, id, repos);
    } catch (err) {
      if (err instanceof CompanyNotFoundError) return reply.code(404).send({ error: "not_found" });
      throw err;
    }
  });

  app.get("/packs/available", async () => listAvailablePackFiles(packsDir));

  app.post("/packs/import", async (request, reply) => {
    const { filename, companyId } = request.body as { filename: string; companyId: string };
    let pack: Pack;
    try {
      pack = await readPackFile(packsDir, filename);
    } catch (err) {
      return reply.code(400).send({ error: "invalid_pack_file", detail: String(err) });
    }
    try {
      return importPackIntoCompany(pack, companyId, repos);
    } catch (err) {
      if (err instanceof CompanyNotFoundError) return reply.code(404).send({ error: "not_found" });
      throw err;
    }
  });
}

/** Monta o servidor do Super Construtor. Não chama `.listen()` — quem chama decide a porta (produção vs. teste). */
export function buildServer(options: BuildServerOptions = {}): ConstructorServer {
  const db = openDatabase(options.dbPath ?? ":memory:");
  migrate(db);
  const repos = buildRepositories(db);
  const app = Fastify({ logger: false });

  app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));

  registerCrud(app, "agents", repos.agents);
  registerCrud(app, "squads", repos.squads);
  registerCrud(app, "companies", repos.companies);
  registerCrud(app, "mind-clones", repos.mindClones);
  registerCrud(app, "providers", repos.providers);
  registerCrud(app, "tasks", repos.tasks);
  registerCrud(app, "runs", repos.runs);
  registerCrud(app, "approvals", repos.approvals);
  registerCrud(app, "learning-flows", repos.learningFlows);
  registerCrud(app, "memory-chunks", repos.memoryChunks);
  registerCrud(app, "canvas-nodes", repos.canvasNodes);
  registerCrud(app, "canvas-edges", repos.canvasEdges);
  registerProviderHealthCheck(app, repos.providers);
  registerLibraryImport(app, { agents: repos.agents, squads: repos.squads }, { repoRoot: options.repoRoot });
  registerReuseRoutes(app, { agents: repos.agents, squads: repos.squads });
  registerPackRoutes(
    app,
    { agents: repos.agents, squads: repos.squads, companies: repos.companies },
    options.packsDir ?? path.join(options.repoRoot ?? DEFAULT_REPO_ROOT, "packs"),
  );
  registerExecutionRoutes(app, {
    canvasNodes: repos.canvasNodes,
    agents: repos.agents,
    squads: repos.squads,
    providers: repos.providers,
    tasks: repos.tasks,
    runs: repos.runs,
    approvals: repos.approvals,
  });

  return { app, repos };
}
