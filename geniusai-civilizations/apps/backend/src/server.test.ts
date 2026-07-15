import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import WebSocket from "ws";
import { createServer } from "./server";
import type { Config } from "./config";
import type { AgentDecision, AgentRunner } from "./agent/AgentRunner";

function fixedRunner(decision: AgentDecision): AgentRunner {
  return { name: "fake", healthy: async () => true, decide: async () => decision };
}
const passRunner = fixedRunner({ reasoning: "sem ações", actions: [] });

function tempDataDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "gai-server-"));
  process.env.DATA_DIR = dir;
  return dir;
}

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    runner: "claude",
    model: "unused",
    ollamaHost: "unused",
    host: "127.0.0.1",
    port: 0, // porta livre escolhida pelo SO — testes não colidem entre si
    narrator: false,
    fogOfWarDefault: false,
    allowedOrigins: [],
    ...overrides,
  };
}

/** Cliente WS de teste: coleta mensagens e permite esperar por um predicado. */
async function connectClient(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const messages: Record<string, unknown>[] = [];
  ws.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  const waitFor = (pred: (m: Record<string, unknown>) => boolean, timeoutMs = 5000): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      const found = messages.find(pred);
      if (found) return resolve(found);
      const start = Date.now();
      const interval = setInterval(() => {
        const m = messages.find(pred);
        if (m) {
          clearInterval(interval);
          resolve(m);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error(`timeout esperando mensagem: ${pred}`));
        }
      }, 20);
    });

  return { ws, messages, waitFor, send: (payload: unknown) => ws.send(JSON.stringify(payload)) };
}

test("conexão: recebe hello, health, world_init e history (partida nova)", async () => {
  tempDataDir();
  const { httpServer, port } = await createServer(baseConfig(), passRunner);
  const client = await connectClient(port);

  await client.waitFor((m) => m.type === "hello");
  await client.waitFor((m) => m.type === "health");
  const worldInit = await client.waitFor((m) => m.type === "world_init");
  const history = await client.waitFor((m) => m.type === "history");

  assert.equal((worldInit.world as { tick: number }).tick, 0);
  assert.deepEqual(history.timeline, []);

  client.ws.close();
  httpServer.close();
});

test("command step: avança o tick e o cliente recebe o broadcast", async () => {
  tempDataDir();
  const { httpServer, port } = await createServer(baseConfig(), passRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  client.send({ type: "command", action: "step" });
  const tickEnd = await client.waitFor((m) => m.type === "tick_end", 10_000);
  assert.equal(tickEnd.tick, 1);

  client.ws.close();
  httpServer.close();
});

test("list_saves: reflete a partida após um step (persistida em disco)", async () => {
  tempDataDir();
  const { httpServer, port, getLoop } = await createServer(baseConfig(), passRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  client.send({ type: "command", action: "step" });
  await client.waitFor((m) => m.type === "tick_end", 10_000);

  client.send({ type: "command", action: "list_saves" });
  const saves = await client.waitFor((m) => m.type === "saves");
  const list = saves.saves as { gameId: string; tick: number }[];
  const mine = list.find((s) => s.gameId === getLoop().gameId);
  assert.ok(mine, "a partida atual deveria aparecer em list_saves");
  assert.equal(mine!.tick, 1);

  client.ws.close();
  httpServer.close();
});

test("load_game: partida inexistente devolve erro sem travar o servidor", async () => {
  tempDataDir();
  const { httpServer, port } = await createServer(baseConfig(), passRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  client.send({ type: "command", action: "load_game", gameId: "nao-existe" });
  const error = await client.waitFor((m) => m.type === "error");
  assert.match(error.message as string, /não encontrada/);

  client.ws.close();
  httpServer.close();
});

test("new_game → load_game: troca de partida e repõe o histórico salvo", async () => {
  tempDataDir();
  const { httpServer, port, getLoop } = await createServer(baseConfig(), passRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  const originalGameId = getLoop().gameId;
  client.send({ type: "command", action: "step" });
  await client.waitFor((m) => m.type === "tick_end", 10_000);
  assert.equal(getLoop().world.tick, 1);

  // new_game troca para um mundo novo (tick 0, gameId diferente).
  client.send({ type: "command", action: "new_game", seed: 123 });
  await new Promise((r) => setTimeout(r, 300)); // criação do GameLoop é assíncrona
  assert.notEqual(getLoop().gameId, originalGameId);
  assert.equal(getLoop().world.tick, 0);

  // load_game volta para a partida original, com o tick salvo.
  client.send({ type: "command", action: "load_game", gameId: originalGameId });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(getLoop().gameId, originalGameId);
  assert.equal(getLoop().world.tick, 1);

  client.ws.close();
  httpServer.close();
});

test("reconexão: novo cliente recebe a timeline e o raciocínio já registrados", async () => {
  tempDataDir();
  const { httpServer, port } = await createServer(baseConfig(), passRunner);
  const first = await connectClient(port);
  await first.waitFor((m) => m.type === "world_init");

  first.send({ type: "command", action: "step" });
  await first.waitFor((m) => m.type === "tick_end", 10_000);
  first.ws.close();

  // Uma segunda conexão (simulando reconexão/nova aba) deve ver o histórico.
  const second = await connectClient(port);
  const history = await second.waitFor((m) => m.type === "history");
  const timeline = history.timeline as { type: string }[];
  assert.ok(timeline.some((e) => e.type === "tick_started"));
  assert.ok((history.civs as Record<string, unknown>).rome);

  second.ws.close();
  httpServer.close();
});

test("segurança: comando malformado devolve INVALID_COMMAND (não é ignorado)", async () => {
  tempDataDir();
  const { httpServer, port } = await createServer(baseConfig(), passRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  client.send({ type: "command", action: "set_speed", speedMs: Infinity });
  const err1 = await client.waitFor((m) => m.type === "error");
  assert.equal(err1.code, "INVALID_COMMAND");

  client.ws.send("isto não é json");
  await client.waitFor((m) => m.type === "error" && m !== err1);

  client.ws.close();
  httpServer.close();
});

test("segurança: load_game com path traversal é rejeitado pelo schema", async () => {
  tempDataDir();
  const { httpServer, port, getLoop } = await createServer(baseConfig(), passRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");
  const before = getLoop().gameId;

  client.send({ type: "command", action: "load_game", gameId: "../../etc/passwd" });
  const error = await client.waitFor((m) => m.type === "error");
  assert.equal(error.code, "INVALID_COMMAND");
  assert.equal(getLoop().gameId, before, "o loop ativo não pode mudar");

  client.ws.close();
  httpServer.close();
});

test("concorrência: segundo step em paralelo recebe GAME_BUSY e o tick avança 1", async () => {
  tempDataDir();
  // Runner lento o bastante para o segundo step chegar durante o primeiro.
  const slowRunner: AgentRunner = {
    name: "fake",
    healthy: async () => true,
    decide: async () => {
      await new Promise((r) => setTimeout(r, 150));
      return { reasoning: "devagar", actions: [] };
    },
  };
  const { httpServer, port, getLoop } = await createServer(baseConfig(), slowRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  client.send({ type: "command", action: "step" });
  await new Promise((r) => setTimeout(r, 50)); // primeiro step já em andamento
  client.send({ type: "command", action: "step" });

  const busy = await client.waitFor((m) => m.type === "error");
  assert.equal(busy.code, "GAME_BUSY");

  await client.waitFor((m) => m.type === "tick_end", 10_000);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(getLoop().world.tick, 1, "apenas um tick deveria ter executado");

  client.ws.close();
  httpServer.close();
});

test("ask: consulta o agente real em modo somente leitura (não avança o tick)", async () => {
  tempDataDir();
  const askRunner = fixedRunner({ reasoning: "Sou Roma; seguimos firmes rumo à expansão.", actions: [] });
  const { httpServer, port, getLoop } = await createServer(baseConfig(), askRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  client.send({ type: "command", action: "ask", civ: "rome", question: "Qual é o seu plano?" });
  const answer = await client.waitFor((m) => m.type === "answer");
  assert.equal(answer.civ, "rome");
  assert.match(answer.text as string, /Roma/);
  assert.equal(answer.runner, "fake");
  assert.equal(getLoop().world.tick, 0, "ask não pode avançar a simulação");

  client.ws.close();
  httpServer.close();
});

test("ask: falha do runner vira erro ASK_FAILED visível", async () => {
  tempDataDir();
  const failingRunner: AgentRunner = {
    name: "fake",
    healthy: async () => true,
    decide: async () => {
      throw new Error("runner indisponível");
    },
  };
  const { httpServer, port } = await createServer(baseConfig(), failingRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  client.send({ type: "command", action: "ask", civ: "mali", question: "Como está o comércio?" });
  const error = await client.waitFor((m) => m.type === "error");
  assert.equal(error.code, "ASK_FAILED");

  client.ws.close();
  httpServer.close();
});

test("new_game: nome vira slug seguro no gameId e a seed é respeitada", async () => {
  tempDataDir();
  const { httpServer, port, getLoop } = await createServer(baseConfig(), passRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  client.send({
    type: "command",
    action: "new_game",
    name: "Ascensão do Mediterrâneo!",
    seed: 777,
    speedMs: 500,
  });
  await client.waitFor((m) => m.type === "world_init" && (m.gameId as string).startsWith("ascensao-do-mediterraneo"));

  assert.match(getLoop().gameId, /^ascensao-do-mediterraneo-\d+$/);
  assert.match(getLoop().gameId, /^[a-zA-Z0-9_-]{1,64}$/, "gameId sempre dentro da allowlist");
  assert.equal(getLoop().world.seed, 777);
  assert.equal(getLoop().world.tick, 0);

  client.ws.close();
  httpServer.close();
});

test("new_game: fogOfWar explícito no comando ativa a névoa nesta partida (Fase 20, RF-22)", async () => {
  tempDataDir();
  const { httpServer, port, getLoop } = await createServer(baseConfig({ fogOfWarDefault: false }), passRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  client.send({ type: "command", action: "new_game", name: "Névoa de guerra", fogOfWar: true });
  await client.waitFor((m) => m.type === "world_init" && (m.gameId as string).startsWith("nevoa-de-guerra"));

  assert.equal(getLoop().world.fogOfWar, true);
  assert.ok(Object.keys(getLoop().world.civilizations.rome.discovered).length > 0);

  client.ws.close();
  httpServer.close();
});

test("new_game: sem fogOfWar no comando, usa o padrão do servidor (config)", async () => {
  tempDataDir();
  const { httpServer, port, getLoop } = await createServer(baseConfig({ fogOfWarDefault: false }), passRunner);
  const client = await connectClient(port);
  await client.waitFor((m) => m.type === "world_init");

  client.send({ type: "command", action: "new_game", name: "Visão global" });
  await client.waitFor((m) => m.type === "world_init" && (m.gameId as string).startsWith("visao-global"));

  assert.equal(getLoop().world.fogOfWar, false);

  client.ws.close();
  httpServer.close();
});
