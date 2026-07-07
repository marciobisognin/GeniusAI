import { loadConfig } from "./config";
import { createRunner } from "./agent";

const cfg = loadConfig();
const runner = createRunner(cfg);

const healthy = await runner.healthy();
console.log(`runner=${runner.name} healthy=${healthy}`);
process.exit(healthy ? 0 : 1);
