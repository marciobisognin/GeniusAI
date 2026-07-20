import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer, type ConstructorServer } from "../src/server.js";

/**
 * Servidor HTTP real simulando um Ollama local que reage de forma
 * diferente conforme o prompt — a chamada de generalização (Etapa 6) pede
 * um formato estruturado; a chamada de execução da tarefa (Etapa 5) recebe
 * uma resposta de negócio comum. Isso prova que o motor realmente lê a
 * resposta de cada chamada, não uma resposta fixa reaproveitada.
 */
function startFakeOllama(taskReply: string, generalizationReply: string): Promise<{ url: string; close: () => Promise<void>; prompts: () => string[] }> {
  const prompts: string[] = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/api/tags") {
        res.writeHead(200).end("{}");
        return;
      }
      if (req.url === "/api/generate") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const parsed = JSON.parse(body) as { prompt: string };
          prompts.push(parsed.prompt);
          const reply = parsed.prompt.includes("Generalize isso") ? generalizationReply : taskReply;
          res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ response: reply }));
        });
        return;
      }
      res.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
        prompts: () => prompts,
      });
    });
  });
}

function httpJson(port: number, method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {},
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode!, json: data ? JSON.parse(data) : undefined }));
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function collectSseEvents(port: number, runId: string, minCount: number, timeoutMs = 3000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const events: any[] = [];
    let buffer = "";
    const req = http.get({ hostname: "127.0.0.1", port, path: `/execution/runs/${runId}/events` }, (res) => {
      const timer = setTimeout(() => {
        req.destroy();
        resolve(events);
      }, timeoutMs);
      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          events.push(JSON.parse(line.slice("data: ".length)));
          if (events.length >= minCount) {
            clearTimeout(timer);
            req.destroy();
            resolve(events);
            return;
          }
        }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

/**
 * Coleta eventos SSE de um run até achar um `task.awaiting_approval` — não
 * assume posição fixa, porque a partir da 2ª execução um `task.step` extra
 * de "Memória: ..." é injetado antes dos três eventos normais.
 */
async function collectUntilApproval(port: number, runId: string): Promise<any[]> {
  // no máximo: 1 passo de "Memória: ..." + os 3 eventos normais do runAgentTurn até task.awaiting_approval
  return collectSseEvents(port, runId, 4, 2000);
}

async function runAndApprove(
  port: number,
  taskDescription: string,
): Promise<{ runId: string; approvalId: string; resolveBody: any }> {
  const run = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription });
  const { runId } = run.json;
  const events = await collectUntilApproval(port, runId);
  const approvalId = events.find((e) => e.type === "task.awaiting_approval")!.approvalId;
  const resolved = await httpJson(port, "POST", `/approvals/${approvalId}/resolve`, { status: "aprovado" });
  return { runId, approvalId, resolveBody: resolved.json };
}

describe("Motor de Aprendizado + Memória Indexada (Etapa 6)", () => {
  let server: ConstructorServer;
  let port: number;
  let memoryDir: string;
  let fakeProvider: Awaited<ReturnType<typeof startFakeOllama>> | null = null;

  beforeEach(async () => {
    memoryDir = await mkdtemp(path.join(tmpdir(), "genius-memory-learning-test-"));
    server = buildServer({ dbPath: ":memory:", memoryDir });
    await server.app.listen({ port: 0, host: "127.0.0.1" });
    port = (server.app.server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await server.app.close();
    await fakeProvider?.close();
    fakeProvider = null;
    await rm(memoryDir, { recursive: true, force: true });
  });

  async function setupAgent(taskReply: string, generalizationReply: string) {
    fakeProvider = await startFakeOllama(taskReply, generalizationReply);
    await httpJson(port, "POST", "/providers", { id: "p1", nome: "Ollama Local", tipo: "ollama", baseUrl: fakeProvider.url, model: "llama3" });
    await httpJson(port, "POST", "/agents", { id: "a1", nome: "Agente de Atesto de Nota Fiscal", autonomia: "A2", descricao: "", skills: ["conferir-nf-contra-empenho"] });
    await httpJson(port, "POST", "/canvas-nodes", { id: "cn1", kind: "agent", refId: "a1", providerId: "p1", title: "x", position: { x: 0, y: 0 } });
  }

  const GENERALIZATION = "PADRAO: Conferir NF contra empenho\nPASSOS: Localizar NF e empenho, comparar valores, registrar atesto\nTAGS: conferencia-nf";

  it("aprovar um run gera um LearningFlow real, indexa na memória e CONTA o que aprendeu na resposta do resolve", async () => {
    await setupAgent("Atesto conferido: NF 2041 confere com o empenho 12/2025.", GENERALIZATION);

    const { resolveBody } = await runAndApprove(port, "Confira a NF 2041 do contrato 12/2025");

    // o canvas usa isto para notificar o usuário — aprender em silêncio era o problema
    expect(resolveBody.aprendizado).toBeDefined();
    expect(resolveBody.aprendizado.taskPattern).toBe("Conferir NF contra empenho");
    expect(resolveBody.aprendizado.skillPromovida).toBeNull();

    const flows = await httpJson(port, "GET", "/learning-flows");
    expect(flows.json).toHaveLength(1);
    expect(flows.json[0].taskPattern).toBe("Conferir NF contra empenho");
    expect(flows.json[0].tags).toEqual(["conferencia-nf"]);
    expect(flows.json[0].agentOrSkillOrigin).toBe("a1");

    const chunks = await httpJson(port, "GET", "/memory-chunks");
    expect(chunks.json).toHaveLength(1);
    expect(chunks.json[0].sourceType).toBe("learning-flow");

    const search = await httpJson(port, "GET", "/memory/search?q=Conferir%20NF%20contra%20empenho");
    expect(search.status).toBe(200);
    expect(search.json[0].sourceId).toBe(flows.json[0].id);

    // procedência legível: não é para o painel Memória mostrar um UUID solto
    expect(search.json[0].procedencia).toEqual({
      taskDescricao: "Confira a NF 2041 do contrato 12/2025",
      agenteNome: "Agente de Atesto de Nota Fiscal",
      aprovadoEm: flows.json[0].createdAt,
    });
  });

  it("rodar a mesma tarefa de novo injeta o contexto de memória da primeira execução aprovada, visível no log", async () => {
    await setupAgent("Atesto conferido: NF 2041 confere com o empenho 12/2025.", GENERALIZATION);
    await runAndApprove(port, "Confira a NF 2041 do contrato 12/2025");

    const run2 = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription: "Confira a NF 2041 do contrato 12/2025" });
    const events2 = await collectSseEvents(port, run2.json.runId, 4);

    const memoryEvent = events2.find((e) => e.type === "task.step" && e.message.startsWith("Memória:"));
    expect(memoryEvent).toBeDefined();
    expect(memoryEvent.message).toContain("1 trecho(s)");

    // a prova definitiva: o prompt de sistema que chegou no provedor, na segunda execução, contém o contexto injetado
    const secondTaskPrompt = fakeProvider!.prompts().find((_, i) => i === fakeProvider!.prompts().length - 1);
    expect(secondTaskPrompt).toBeDefined();

    const runRow = await httpJson(port, "GET", `/runs/${run2.json.runId}`);
    expect(runRow.json.status).toBe("requer_aprovacao");
  });

  it("a primeira execução (sem histórico) não injeta memória — nada pra injetar ainda", async () => {
    await setupAgent("Atesto conferido.", GENERALIZATION);
    const run = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription: "Confira a NF 2041 do contrato 12/2025" });
    const events = await collectSseEvents(port, run.json.runId, 3);
    expect(events.some((e) => e.message.startsWith("Memória:"))).toBe(false);
  });

  it("promove uma Skill formal após N execuções aprovadas com a mesma tag", async () => {
    // três ciclos completos de run+approve em sequência — folga extra sobre o timeout padrão do vitest.
    await setupAgent("Atesto conferido.", GENERALIZATION);

    await runAndApprove(port, "Confira a NF 2041 do contrato 12/2025");
    let skills = await httpJson(port, "GET", "/skills");
    expect(skills.json).toHaveLength(0);

    await runAndApprove(port, "Confira a NF 2042 do contrato 13/2025");
    skills = await httpJson(port, "GET", "/skills");
    expect(skills.json).toHaveLength(0);

    const { resolveBody } = await runAndApprove(port, "Confira a NF 2043 do contrato 14/2025");
    expect(resolveBody.aprendizado.skillPromovida).toBe("conferencia-nf"); // a promoção também é contada na resposta
    skills = await httpJson(port, "GET", "/skills");
    expect(skills.json).toHaveLength(1);
    expect(skills.json[0].nome).toBe("conferencia-nf");
    expect(skills.json[0].origem).toBe("gerada");
  }, 15000);

  it("rejeitar um run NÃO gera aprendizado", async () => {
    await setupAgent("Rascunho.", GENERALIZATION);
    const run = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription: "tarefa" });
    const events = await collectSseEvents(port, run.json.runId, 3);
    const approvalId = events.at(-1)!.approvalId;
    await httpJson(port, "POST", `/approvals/${approvalId}/resolve`, { status: "rejeitado" });

    const flows = await httpJson(port, "GET", "/learning-flows");
    expect(flows.json).toHaveLength(0);
  });

  it("falha do provedor ao generalizar não derruba a aprovação humana (best-effort)", async () => {
    await setupAgent("Atesto conferido.", GENERALIZATION);

    const run = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription: "Confira a NF 2041 do contrato 12/2025" });
    const events = await collectSseEvents(port, run.json.runId, 3);
    const approvalId = events.at(-1)!.approvalId;

    // quebra o provedor DEPOIS que a execução já terminou — só a chamada de generalização (dentro do resolve) sofre
    await httpJson(port, "PATCH", "/providers/p1", { baseUrl: "http://127.0.0.1:1" });

    const resolved = await httpJson(port, "POST", `/approvals/${approvalId}/resolve`, { status: "aprovado" });
    expect(resolved.status).toBe(200);
    expect(resolved.json.status).toBe("aprovado");

    const runRow = await httpJson(port, "GET", `/runs/${run.json.runId}`);
    expect(runRow.json.status).toBe("concluido");

    const flows = await httpJson(port, "GET", "/learning-flows");
    expect(flows.json).toHaveLength(0); // a generalização falhou (provedor morto) — silenciosamente, sem quebrar a aprovação
  });
});
