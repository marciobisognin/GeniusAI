import { loadConfig } from "./config";
import { createRunner } from "./agent";
import { createServer } from "./server";

const cfg = loadConfig();
const runner = createRunner(cfg);

console.log(`[backend] runner selecionado: ${runner.name}`);
const { onLoopEvent } = await createServer(cfg, runner);

// Log de progresso no terminal — útil para acompanhar a simulação também
// fora da UI (o "watchable" vale para o terminal do host, não só o browser).
// Sobrevive a troca de partida (new_game/load_game).
onLoopEvent((e) => {
  if (e.type === "turn_start") console.log(`[loop] tick ${e.tick} · ${e.civ} decidindo…`);
  else if (e.type === "turn_end") {
    const tools = e.actions.map((a) => a.tool).join(", ") || "nenhuma ação";
    console.log(`[loop] tick ${e.tick} · ${e.civ}: ${e.passed ? "passou o turno" : tools}`);
  } else if (e.type === "tick_end") {
    console.log(`[loop] tick ${e.tick} concluído (${e.events.length} eventos)`);
    const narration = e.events.find((ev) => ev.type === "narration") as { text?: string } | undefined;
    if (narration?.text) console.log(`[loop] 📰 ${narration.text}`);
  } else if (e.type === "loop_state") console.log(`[loop] estado: ${e.state}`);
});
