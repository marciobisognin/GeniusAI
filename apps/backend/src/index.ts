import { loadConfig } from "./config";
import { createRunner } from "./agent";
import { createServer } from "./server";

const cfg = loadConfig();
const runner = createRunner(cfg);

console.log(`[backend] runner selecionado: ${runner.name}`);
createServer(runner, cfg.port);
