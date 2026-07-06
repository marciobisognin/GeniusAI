import http from "node:http";
import { WebSocketServer } from "ws";
import type { AgentRunner } from "./agent";

/**
 * Servidor HTTP + WebSocket do backend.
 * Fase 0: expõe apenas o health check do runner e um canal WS de status.
 * Os eventos de simulação (estado do mundo, streaming de raciocínio) entram
 * nas fases seguintes.
 */
export function createServer(runner: AgentRunner, port: number) {
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
    ws.send(JSON.stringify({ type: "hello", runner: runner.name }));
    try {
      const healthy = await runner.healthy();
      ws.send(JSON.stringify({ type: "health", runner: runner.name, healthy }));
    } catch {
      ws.send(JSON.stringify({ type: "health", runner: runner.name, healthy: false }));
    }
  });

  httpServer.listen(port, () => {
    console.log(
      `[backend] HTTP+WebSocket em http://localhost:${port} (runner: ${runner.name})`,
    );
  });

  return { httpServer, wss };
}
