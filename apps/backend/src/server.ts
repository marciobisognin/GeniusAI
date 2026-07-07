import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { AgentRunner } from "./agent";
import { GameLoop } from "./orchestrator/GameLoop";
import type { LoopEvent } from "./orchestrator/events";

/** Mensagens que o cliente (UI) pode enviar ao servidor. */
type ClientCommand =
  | { type: "command"; action: "play" | "pause" | "stop" | "step" }
  | { type: "command"; action: "set_speed"; speedMs: number };

function isClientCommand(msg: unknown): msg is ClientCommand {
  return !!msg && typeof msg === "object" && (msg as { type?: unknown }).type === "command";
}

/**
 * Servidor HTTP + WebSocket do backend.
 * - GET /health → saúde do runner configurado.
 * - WebSocket: ao conectar, envia hello/health/world_init; em seguida
 *   retransmite (broadcast) todo LoopEvent do GameLoop compartilhado.
 *   Aceita comandos do cliente para controlar a simulação (play/pause/step/
 *   stop/set_speed) — não há "comandar civilização", só controle de reprodução.
 */
export function createServer(runner: AgentRunner, port: number) {
  const loop = new GameLoop({
    runner,
    seed: Number(process.env.SEED ?? 42),
    speedMs: Number(process.env.TICK_SPEED_MS ?? 2000),
    turnTimeoutMs: Number(process.env.TURN_TIMEOUT_MS ?? 60_000),
  });
  // Retoma memórias persistidas de uma execução anterior, se houver.
  void loop.hydrate();

  const clients = new Set<WebSocket>();
  const broadcast = (payload: unknown) => {
    const data = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(data);
    }
  };
  loop.on((event: LoopEvent) => broadcast(event));

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

    ws.send(JSON.stringify({ type: "world_init", world: loop.world, loopState: loop.getState() }));

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
      }
    });

    ws.on("close", () => clients.delete(ws));
  });

  httpServer.listen(port, () => {
    console.log(
      `[backend] HTTP+WebSocket em http://localhost:${port} (runner: ${runner.name})`,
    );
  });

  return { httpServer, wss, loop };
}
