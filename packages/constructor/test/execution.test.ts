import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer, type ConstructorServer } from "../src/server.js";

/** Servidor HTTP real simulando um Ollama local — o mesmo padrão usado em server.test.ts e no pacote @genius/providers. */
function startFakeOllama(replyText: string): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/api/tags") {
        res.writeHead(200).end("{}");
        return;
      }
      if (req.url === "/api/generate") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ response: replyText }));
        return;
      }
      res.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
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

/** Lê o SSE real de /execution/runs/:id/events até acumular `minCount` eventos ou estourar o timeout. */
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

describe("Motor de Execução (Etapa 5) — POST /execution/run, SSE, POST /approvals/:id/resolve", () => {
  let server: ConstructorServer;
  let port: number;
  let fakeProvider: Awaited<ReturnType<typeof startFakeOllama>> | null = null;

  beforeEach(async () => {
    server = buildServer({ dbPath: ":memory:" });
    await server.app.listen({ port: 0, host: "127.0.0.1" });
    port = (server.app.server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await server.app.close();
    await fakeProvider?.close();
    fakeProvider = null;
  });

  it("executa um agente A3+ de ponta a ponta: cria Task/Run reais, transmite eventos via SSE e conclui", async () => {
    fakeProvider = await startFakeOllama("Relatório pronto.");
    await httpJson(port, "POST", "/providers", { id: "p1", nome: "Ollama Local", tipo: "ollama", baseUrl: fakeProvider.url, model: "llama3" });
    await httpJson(port, "POST", "/agents", { id: "a1", nome: "Agente Autônomo", autonomia: "A3", descricao: "", skills: [] });
    await httpJson(port, "POST", "/canvas-nodes", {
      id: "cn1",
      kind: "agent",
      refId: "a1",
      providerId: "p1",
      title: "Agente Autônomo",
      position: { x: 0, y: 0 },
    });

    const run = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription: "Prepare um relatório" });
    expect(run.status).toBe(202);
    const { runId, taskId } = run.json;

    const events = await collectSseEvents(port, runId, 3);
    expect(events.map((e) => e.type)).toEqual(["task.step", "task.tool_call", "task.completed"]);
    expect(events.at(-1)!.message).toBe("Relatório pronto.");

    const runRow = await httpJson(port, "GET", `/runs/${runId}`);
    expect(runRow.json.status).toBe("concluido");
    expect(runRow.json.steps).toHaveLength(3);

    const taskRow = await httpJson(port, "GET", `/tasks/${taskId}`);
    expect(taskRow.json.status).toBe("concluido");
  });

  it("agente A2 pausa em task.awaiting_approval; aprovação humana conclui o run e o evento chega ao vivo pelo mesmo SSE", async () => {
    fakeProvider = await startFakeOllama("Rascunho para revisão.");
    await httpJson(port, "POST", "/providers", { id: "p1", nome: "Ollama Local", tipo: "ollama", baseUrl: fakeProvider.url, model: "llama3" });
    await httpJson(port, "POST", "/agents", { id: "a1", nome: "Agente Supervisionado", autonomia: "A2", descricao: "", skills: [] });
    await httpJson(port, "POST", "/canvas-nodes", {
      id: "cn1",
      kind: "agent",
      refId: "a1",
      providerId: "p1",
      title: "Agente Supervisionado",
      position: { x: 0, y: 0 },
    });

    const run = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription: "Redigir comunicado" });
    const { runId } = run.json;

    const firstBatch = await collectSseEvents(port, runId, 3);
    expect(firstBatch.map((e) => e.type)).toEqual(["task.step", "task.tool_call", "task.awaiting_approval"]);
    const approvalId = firstBatch.at(-1)!.approvalId;
    expect(approvalId).toBeTruthy();
    // o canvas usa isto pra explicar o "porquê" da pausa, sem inventar jargão sem contexto
    expect(firstBatch.at(-1)!.autonomia).toBe("A2");

    const runRow = await httpJson(port, "GET", `/runs/${runId}`);
    expect(runRow.json.status).toBe("requer_aprovacao");
    expect(runRow.json.steps.at(-1).autonomia).toBe("A2"); // sobrevive à persistência, não só ao evento ao vivo
    const approvalRow = await httpJson(port, "GET", `/approvals/${approvalId}`);
    expect(approvalRow.json.status).toBe("pendente");

    // reconecta o SSE (simula alguém que chega depois do evento ao vivo) — replay também traz a autonomia
    const replay = await collectSseEvents(port, runId, 3);
    expect(replay.at(-1)!.autonomia).toBe("A2");

    // Conecta ANTES de aprovar, para provar que o evento final chega ao vivo (replay dos 3 + 1 em tempo real), não só via reconexão.
    const streamPromise = collectSseEvents(port, runId, 4);
    await new Promise((r) => setTimeout(r, 80));
    const resolved = await httpJson(port, "POST", `/approvals/${approvalId}/resolve`, { status: "aprovado" });
    expect(resolved.status).toBe(200);
    expect(resolved.json.status).toBe("aprovado");

    const allEvents = await streamPromise;
    expect(allEvents.map((e) => e.type)).toEqual([
      "task.step",
      "task.tool_call",
      "task.awaiting_approval",
      "task.completed",
    ]);

    const runRowAfter = await httpJson(port, "GET", `/runs/${runId}`);
    expect(runRowAfter.json.status).toBe("concluido");
  });

  it("rejeição humana marca o run e a task como 'falhou'", async () => {
    fakeProvider = await startFakeOllama("Rascunho.");
    await httpJson(port, "POST", "/providers", { id: "p1", nome: "Ollama Local", tipo: "ollama", baseUrl: fakeProvider.url, model: "llama3" });
    await httpJson(port, "POST", "/agents", { id: "a1", nome: "Agente A0", autonomia: "A0", descricao: "", skills: [] });
    await httpJson(port, "POST", "/canvas-nodes", { id: "cn1", kind: "agent", refId: "a1", providerId: "p1", title: "x", position: { x: 0, y: 0 } });

    const run = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription: "Enviar e-mail" });
    const { runId, taskId } = run.json;
    const events = await collectSseEvents(port, runId, 3);
    const approvalId = events.at(-1)!.approvalId;

    await httpJson(port, "POST", `/approvals/${approvalId}/resolve`, { status: "rejeitado", comentario: "Texto incorreto" });

    const runRow = await httpJson(port, "GET", `/runs/${runId}`);
    expect(runRow.json.status).toBe("falhou");
    const taskRow = await httpJson(port, "GET", `/tasks/${taskId}`);
    expect(taskRow.json.status).toBe("falhou");
  });

  it("executa um squad: cada membro contribui e o líder consolida, com A3+ concluindo direto", async () => {
    fakeProvider = await startFakeOllama("contribuição padrão");
    await httpJson(port, "POST", "/providers", { id: "p1", nome: "Ollama Local", tipo: "ollama", baseUrl: fakeProvider.url, model: "llama3" });
    await httpJson(port, "POST", "/agents", { id: "lider", nome: "Líder", autonomia: "A3", descricao: "", skills: [] });
    await httpJson(port, "POST", "/agents", { id: "membro", nome: "Membro", autonomia: "A2", descricao: "", skills: [] });
    await httpJson(port, "POST", "/squads", { id: "s1", nome: "Squad de Comunicação", agentIds: ["lider", "membro"], liderAgentId: "lider" });
    await httpJson(port, "POST", "/canvas-nodes", {
      id: "cn1",
      kind: "squad",
      refId: "s1",
      providerId: "p1",
      title: "Squad de Comunicação",
      position: { x: 0, y: 0 },
    });

    const run = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription: "Preparar campanha" });
    expect(run.status).toBe(202);
    const { runId } = run.json;

    // decompor (1) + (step+tool_call) por membro (2 membros x 2 = 4) + step de consolidação do líder (1) + evento final (1) = 7
    const events = await collectSseEvents(port, runId, 7);
    expect(events[0].type).toBe("task.step");
    expect(events[0].message).toContain("decompondo a tarefa");
    expect(events.at(-1)!.type).toBe("task.completed");
    expect(events.at(-1)!.message).toBe("contribuição padrão");

    const runRow = await httpJson(port, "GET", `/runs/${runId}`);
    expect(runRow.json.status).toBe("concluido");
    expect(runRow.json.squadId).toBe("s1");
  });

  it("POST /execution/run com canvasNodeId inexistente responde 404", async () => {
    const res = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "fantasma", taskDescription: "x" });
    expect(res.status).toBe(404);
  });

  it("POST /execution/run num nó 'note' responde 400 not_executable", async () => {
    await httpJson(port, "POST", "/canvas-nodes", { id: "cn1", kind: "note", title: "nota", position: { x: 0, y: 0 } });
    const res = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription: "x" });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe("not_executable");
  });

  it("POST /execution/run sem providerId configurado no nó responde 400 missing_provider", async () => {
    await httpJson(port, "POST", "/agents", { id: "a1", nome: "Agente", autonomia: "A3", descricao: "", skills: [] });
    await httpJson(port, "POST", "/canvas-nodes", { id: "cn1", kind: "agent", refId: "a1", title: "x", position: { x: 0, y: 0 } });
    const res = await httpJson(port, "POST", "/execution/run", { canvasNodeId: "cn1", taskDescription: "x" });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe("missing_provider");
  });
});
