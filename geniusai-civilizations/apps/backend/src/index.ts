import { ConfigError, loadConfig, loadDotEnv } from "./config";
import { createRunner } from "./agent";
import { logger } from "./logger";
import { createServer } from "./server";

loadDotEnv();

let cfg;
try {
  cfg = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    logger.error("configuração inválida", { errorCode: "CONFIG_ERROR", detail: err.message });
    process.exit(1);
  }
  throw err;
}
const runner = createRunner(cfg);

logger.info("runner selecionado", { operation: "boot", runner: runner.name });
const { onLoopEvent, getLoop } = await createServer(cfg, runner);

// Log de progresso no terminal — útil para acompanhar a simulação também
// fora da UI (o "watchable" vale para o terminal do host, não só o browser).
// Sobrevive a troca de partida (new_game/load_game). Formato controlado por
// LOG_FORMAT (pretty por padrão, json para observabilidade — ver logger.ts).
onLoopEvent((e) => {
  const gameId = getLoop().gameId;
  if (e.type === "turn_start") {
    logger.info(`${e.civ} decidindo…`, { operation: "turn_start", gameId, tick: e.tick, civilizationId: e.civ });
  } else if (e.type === "turn_end") {
    const tools = e.actions.map((a) => a.tool).join(", ") || "nenhuma ação";
    logger.info(`${e.civ}: ${e.passed ? "passou o turno" : tools}`, {
      operation: "turn_end",
      gameId,
      tick: e.tick,
      civilizationId: e.civ,
      passed: e.passed,
    });
  } else if (e.type === "tick_end") {
    logger.info(`tick concluído (${e.events.length} eventos)`, {
      operation: "tick_end",
      gameId,
      tick: e.tick,
      eventCount: e.events.length,
    });
    const narration = e.events.find((ev) => ev.type === "narration") as { text?: string } | undefined;
    if (narration?.text) logger.info(`📰 ${narration.text}`, { operation: "narration", gameId, tick: e.tick });
  } else if (e.type === "loop_state") {
    logger.info(`estado: ${e.state}`, { operation: "loop_state", gameId, state: e.state });
  }
});
