import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { z } from "zod";
import type { AgentRunner } from "./agent";
import { RESPONSE_JSON_SCHEMA, snapshotForCiv } from "./agent";
import { CIV_IDS } from "./engine/types";
import type { CivId } from "./engine/types";
import type { Config } from "./config";
import { createGameLoop, type GameLoop } from "./orchestrator/GameLoop";
import type { LoopEvent } from "./orchestrator/events";
import {
  CorruptedSaveError,
  InvalidGameIdError,
  UnsupportedSaveVersionError,
  listSaves,
  loadWorld,
  readTraceSummary,
} from "./orchestrator/trace";

// ── Comandos do cliente: validados com zod (união discriminada) ────────────

const CivIdSchema = z.enum([...CIV_IDS] as [CivId, ...CivId[]]);
const GameIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, "gameId inválido");

const ClientCommandSchema = z.discriminatedUnion("action", [
  z.object({ type: z.literal("command"), action: z.enum(["play", "pause", "stop", "step", "list_saves"]) }),
  z.object({
    type: z.literal("command"),
    action: z.literal("set_speed"),
    speedMs: z.number().finite().min(0).max(600_000),
  }),
  z.object({
    type: z.literal("command"),
    action: z.literal("new_game"),
    seed: z.number().int().min(0).max(2_147_483_647).optional(),
    name: z.string().trim().min(1).max(40).optional(),
    speedMs: z.number().finite().min(0).max(600_000).optional(),
  }),
  z.object({ type: z.literal("command"), action: z.literal("load_game"), gameId: GameIdSchema }),
  z.object({
    type: z.literal("command"),
    action: z.literal("ask"),
    civ: CivIdSchema,
    question: z.string().trim().min(1).max(500),
  }),
]);

type ClientCommand = z.infer<typeof ClientCommandSchema>;

/**
 * Converte o nome digitado pelo usuário na parte legível do gameId:
 * minúsculas, sem acentos, apenas [a-z0-9-]. O sufixo de timestamp garante
 * unicidade e o resultado sempre satisfaz a allowlist de gameId.
 */
function slugifyName(name: string | undefined): string {
  const slug = (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/, "");
  return slug || "game";
}

/** Erro padronizado enviado ao cliente: sempre com `code` legível por máquina. */
function sendError(ws: WebSocket, code: string, message: string): void {
  ws.send(JSON.stringify({ type: "error", code, message }));
}

/**
 * Origins de browser aceitas no WebSocket: sem Origin (clientes não-browser,
 * ex.: testes/CLIs), localhost/127.0.0.1 em qualquer porta, e entradas extras
 * da configuração (ALLOWED_ORIGINS).
 */
function originAllowed(origin: string | undefined, extra: string[]): boolean {
  if (!origin) return true;
  if (extra.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/**
 * Servidor HTTP + WebSocket do backend.
 * - GET /health → saúde do runner configurado.
 * - WebSocket: ao conectar, envia hello/health/world_init/history (histórico
 *   completo da partida, para repor timeline e raciocínio de uma reconexão);
 *   em seguida retransmite (broadcast) todo LoopEvent do GameLoop ativo.
 *   Comandos do cliente são validados por schema (INVALID_COMMAND quando não
 *   passam); comandos mutáveis nunca executam em paralelo (GAME_BUSY quando
 *   há tick ou troca de partida em andamento). `ask` consulta o agente real
 *   em modo somente leitura — não avança o turno nem altera memória.
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

  // Troca de partida (new_game/load_game) em andamento — comandos mutáveis
  // concorrentes são rejeitados com GAME_BUSY em vez de corromper o estado.
  let swapping = false;

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

  function loopOptions() {
    return {
      runner,
      speedMs: Number(process.env.TICK_SPEED_MS ?? 2000),
      turnTimeoutMs: Number(process.env.TURN_TIMEOUT_MS ?? 60_000),
      narrator: cfg.narrator ? runner : undefined,
    };
  }

  /**
   * Consulta somente leitura ao agente da civilização (comando `ask`):
   * mesmo runner e mesmo formato de resposta dos turnos, mas sem aplicar
   * ações, sem avançar tick e sem tocar na memória estratégica.
   */
  async function askCivilization(civId: CivId, question: string): Promise<string> {
    const civ = loop.world.civilizations[civId];
    const snapshot = snapshotForCiv(loop.world, civId);
    const system = [
      `Você é a voz da civilização "${civId}" em uma simulação observável.`,
      `Personalidade: ${civ.persona}`,
      `Um observador humano fará uma pergunta. Responda em primeira pessoa, em português,`,
      `com 2 a 4 frases, coerente com o estado atual do mundo e com sua memória estratégica.`,
      `Isto é apenas uma conversa: NÃO escolha ações de jogo.`,
      `Responda ESTRITAMENTE com um JSON { "reasoning": string, "actions": [] } — a resposta vai em "reasoning".`,
    ].join("\n");
    const user = [
      `Estado atual (tick ${loop.world.tick}):`,
      JSON.stringify(snapshot),
      ``,
      `Pergunta do observador: ${JSON.stringify(question)}`,
    ].join("\n");

    const decision = await runner.decide({
      system,
      user,
      schema: RESPONSE_JSON_SCHEMA,
      timeoutMs: Number(process.env.ASK_TIMEOUT_MS ?? 30_000),
    });
    const text = decision.reasoning.trim();
    if (!text) throw new Error("o agente respondeu vazio");
    return text;
  }

  async function handleCommand(ws: WebSocket, msg: ClientCommand): Promise<void> {
    switch (msg.action) {
      case "play":
        loop.play();
        return;
      case "pause":
        loop.pause();
        return;
      case "stop":
        loop.stop();
        return;

      case "step":
        if (loop.getState() === "running" || loop.isBusy() || swapping) {
          sendError(ws, "GAME_BUSY", "já existe um tick ou troca de partida em andamento");
          return;
        }
        void loop.step().catch((err) => {
          sendError(ws, "STEP_FAILED", err instanceof Error ? err.message : String(err));
        });
        return;

      case "set_speed":
        loop.setSpeed(msg.speedMs);
        return;

      case "list_saves":
        ws.send(JSON.stringify({ type: "saves", saves: await listSaves() }));
        return;

      case "new_game": {
        if (swapping) {
          sendError(ws, "GAME_BUSY", "troca de partida em andamento");
          return;
        }
        swapping = true;
        try {
          loop.stop();
          await loop.whenIdle();
          const opts = loopOptions();
          const next = await createGameLoop({
            ...opts,
            speedMs: msg.speedMs ?? opts.speedMs,
            seed: msg.seed ?? Math.floor(Math.random() * 1_000_000),
            gameId: `${slugifyName(msg.name)}-${Date.now()}`,
          });
          attachLoop(next);
          await sendFullState("broadcast");
        } finally {
          swapping = false;
        }
        return;
      }

      case "load_game": {
        if (swapping) {
          sendError(ws, "GAME_BUSY", "troca de partida em andamento");
          return;
        }
        swapping = true;
        try {
          const world = await loadWorld(msg.gameId);
          if (!world) {
            sendError(ws, "GAME_NOT_FOUND", `partida não encontrada: ${msg.gameId}`);
            return;
          }
          loop.stop();
          await loop.whenIdle();
          const next = await createGameLoop({ ...loopOptions(), world, gameId: msg.gameId });
          attachLoop(next);
          await sendFullState("broadcast");
        } catch (err) {
          if (err instanceof UnsupportedSaveVersionError || err instanceof CorruptedSaveError) {
            sendError(ws, err.code, err.message);
          } else if (err instanceof InvalidGameIdError) {
            sendError(ws, "INVALID_GAME_ID", err.message);
          } else {
            throw err;
          }
        } finally {
          swapping = false;
        }
        return;
      }

      case "ask": {
        try {
          const text = await askCivilization(msg.civ, msg.question);
          ws.send(
            JSON.stringify({ type: "answer", civ: msg.civ, question: msg.question, text, runner: runner.name }),
          );
        } catch (err) {
          sendError(
            ws,
            "ASK_FAILED",
            `a civilização não respondeu: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        return;
      }
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

  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: 64 * 1024,
    verifyClient: ({ origin }: { origin?: string }) => originAllowed(origin, cfg.allowedOrigins),
  });

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
        sendError(ws, "INVALID_COMMAND", "mensagem não é JSON válido");
        return;
      }

      const parsed = ClientCommandSchema.safeParse(msg);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        sendError(
          ws,
          "INVALID_COMMAND",
          `comando inválido: ${issue ? `${issue.path.join(".") || "(raiz)"} — ${issue.message}` : "formato desconhecido"}`,
        );
        return;
      }

      void handleCommand(ws, parsed.data).catch((err) => {
        sendError(ws, "INTERNAL_ERROR", err instanceof Error ? err.message : String(err));
      });
    });

    ws.on("close", () => clients.delete(ws));
  });

  const port = await new Promise<number>((resolve) => {
    httpServer.listen(cfg.port, cfg.host, () => resolve((httpServer.address() as AddressInfo).port));
  });
  console.log(
    `[backend] HTTP+WebSocket em http://${cfg.host}:${port} (runner: ${runner.name}${cfg.narrator ? ", narrador ligado" : ""})`,
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
