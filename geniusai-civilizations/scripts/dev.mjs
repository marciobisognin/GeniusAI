#!/usr/bin/env node
/**
 * `npm run dev` — comando único de desenvolvimento (RF-002):
 * sobe backend (HTTP + WebSocket) e frontend (Vite) juntos, repassa a saída
 * de ambos e encerra os dois quando um deles morre ou ao receber Ctrl+C.
 * Zero dependências: apenas child_process.
 */
import { spawn } from "node:child_process";

const workspaces = ["apps/backend", "apps/frontend"];
const procs = workspaces.map((ws) =>
  spawn("npm", ["run", "dev", "--workspace", ws], { stdio: "inherit", shell: process.platform === "win32" }),
);

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) p.kill("SIGINT");
  process.exitCode = code;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
for (const p of procs) {
  p.on("exit", (code) => shutdown(code ?? 0));
}
