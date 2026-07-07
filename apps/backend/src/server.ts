import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import type { AgentRunner } from "./agent";
import type { Config } from "./config";
import { createGameLoop, type GameLoop } from "./orchestrator/GameLoop";
import type { LoopEvent } from "./orchestrator/events";
import { listSaves, loadWorld, readTraceSummary } from "./orchestrator/trace";

/** Mensagens que o cliente (UI) pode enviar ao servidor. */
type ClientCommand =
  | { type: "command"; action: "play" | "pause" | "stop" | "step" }
  | { type: "command"; action: "set_speed"; speedMs: number }
  | { type: "command"; action: "list_saves" }
  | { type: "command"; action: "new_game"; seed?: number }
  | { type: "command"; action: "load_game"; gameId: string };

function isClientCommand(msg: unknown): msg is ClientCommand {
  return !!msg && typeof msg === "object" && (msg as { type?: unknown }).type === "command";
}

/**
 * Servidor HTTP + WebSocket do backend.
 * - GET /health → saúde do runner configurado.
 * - WebSocket: ao conectar, envia hello/health/world_init/history (histórico
 *   completo da partida, para repor timeline e raciocínio de uma reconexão);
 *   em seguida retransmite (broadcast) todo LoopEvent do GameLoop ativo.
 *   Aceita comandos do cliente: play/pause/stop/step/set_speed (controle de
 *   reprodução — nunca "comandar" uma civilização) e list_saves/new_game/
 *   load_game (persistência — Fase 5).
 */
export async function createServer(cfg: Config, runner: AgentRunner) {
  let loop: GameLoop = await createGameLoop({
    runner,
    seed: Number(process.env.SEED ?? 42),
    speedMs: Number(process.env.TICK_SPEED_MS ?? 2000),
    turnTimeoutMs: Number(process.env.TURN_TIMEOUT_MS ?? 60_000),
    narrator: cfg.narrator ? runner : undefined,
  });

  const clients = new Set<WebSocket>();
  const broadcast = (payload: unknown) => {
    const data = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(data);
    }
  };

  // Listeners externos (ex.: log no terminal) sobrevivem a troca de partida —
  // `notify` é sempre religado ao loop ativo por `attachLoop`.
  const externalListeners = new Set<(e: LoopEvent) => void>();
  const notify = (event: LoopEvent) => {
    broadcast(event);
    for (const fn of externalListeners) fn(event);
  };

  let unsubscribe = loop.on(notify);
  function attachLoop(next: GameLoop): void {
    unsubscribe();
    loop = next;
    unsubscribe = loop.on(notify);
  }

  /** Envia (ou transmite) o estado completo: mundo atual + histórico da partida. */
  async function sendFullState(target: WebSocket | "broadcast"): Promise<void> {
    const summary = await readTraceSummary(loop.gameId);
    const worldInit = {
      type: "world_init",
      world: loop.world,
      loopState: loop.getState(),
      gameId: loop.gameId,
    };
    const history = { type: "history", timeline: summary.timeline, civs: summary.civs };
    if (target === "broadcast") {
      broadcast(worldInit);
      broadcast(history);
    } else {
      target.send(JSON.stringify(worldInit));
      target.send(JSON.stringify(history));
    }
  }

  const httpServer = http.createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");

    if (req.method === "GET" && req.url === "/health") {
      const healthy = await runner.healthy();
      res.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: healthy, runner: runner.name }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", async (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "hello", runner: runner.name }));

    try {
      const healthy = await runner.healthy();
      ws.send(JSON.stringify({ type: "health", runner: runner.name, healthy }));
    } catch {
      ws.send(JSON.stringify({ type: "health", runner: runner.name, healthy: false }));
    }

    await sendFullState(ws);

    ws.on("message", (raw) => {
      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!isClientCommand(msg)) return;

      switch (msg.action) {
        case "play":
          loop.play();
          break;
        case "pause":
          loop.pause();
          break;
        case "stop":
          loop.stop();
          break;
        case "step":
          if (loop.getState() !== "running") void loop.step();
          break;
        case "set_speed":
          loop.setSpeed(msg.speedMs);
          break;
        case "list_saves":
          void listSaves().then((saves) => ws.send(JSON.stringify({ type: "saves", saves })));
          break;
        case "new_game": {
          loop.stop();
          const gameId = `game-${Date.now()}`;
          void createGameLoop({
            runner,
            seed: msg.seed ?? Math.floor(Math.random() * 1_000_000),
            gameId,
            speedMs: Number(process.env.TICK_SPEED_MS ?? 2000),
            turnTimeoutMs: Number(process.env.TURN_TIMEOUT_MS ?? 60_000),
            narrator: cfg.narrator ? runner : undefined,
          }).then((next) => {
            attachLoop(next);
            void sendFullState("broadcast");
          });
          break;
        }
        case "load_game": {
          const gameId = msg.gameId;
          void loadWorld(gameId).then(async (world) => {
            if (!world) {
              ws.send(JSON.stringify({ type: "error", message: `partida não encontrada: ${gameId}` }));
              return;
            }
            loop.stop();
            const next = await createGameLoop({
              runner,
              world,
              gameId,
              speedMs: Number(process.env.TICK_SPEED_MS ?? 2000),
              turnTimeoutMs: Number(process.env.TURN_TIMEOUT_MS ?? 60_000),
              narrator: cfg.narrator ? runner : undefined,
            });
            attachLoop(next);
            await sendFullState("broadcast");
          });
          break;
        }
      }
    });

    ws.on("close", () => clients.delete(ws));
  });

  const port = await new Promise<number>((resolve) => {
    httpServer.listen(cfg.port, () => resolve((httpServer.address() as AddressInfo).port));
  });
  console.log(
    `[backend] HTTP+WebSocket em http://localhost:${port} (runner: ${runner.name}${cfg.narrator ? ", narrador ligado" : ""})`,
  );

  return {
    httpServer,
    wss,
    port,
    /** Loop ativo no momento — pode mudar após new_game/load_game. */
    getLoop: () => loop,
    /** Assina eventos do loop ativo, sobrevivendo a troca de partida. */
    onLoopEvent: (fn: (e: LoopEvent) => void): (() => void) => {
      externalListeners.add(fn);
      return () => externalListeners.delete(fn);
    },
  };
}
