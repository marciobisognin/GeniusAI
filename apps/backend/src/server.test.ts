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
    port: 0, // porta livre escolhida pelo SO — testes não colidem entre si
    narrator: false,
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
