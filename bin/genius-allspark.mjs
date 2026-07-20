#!/usr/bin/env node
/**
 * CLI de instalação/execução local do Genius Allspark Canvas — pensado
 * para `npx .` (dentro do clone do repositório) ou `npx github:<owner>/<repo>`
 * (direto do GitHub, sem clonar). Na primeira vez, instala dependências e
 * compila; nas seguintes, só liga o Super Construtor + o Canvas.
 *
 * Não requer nenhuma configuração — os provedores LLM (Ollama, ChatGPT,
 * Claude, etc.) são cadastrados depois, dentro do próprio Canvas.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONSTRUCTOR_PORT = Number(process.env.PORT ?? 4001);
const CANVAS_PORT = Number(process.env.CANVAS_PORT ?? 5173);
const NPM_CMD = process.platform === "win32" ? "npm.cmd" : "npm";

function log(msg) {
  console.log(`[genius-allspark] ${msg}`);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: ROOT });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} saiu com código ${code}`))));
  });
}

async function ensureBuilt() {
  const constructorEntry = path.join(ROOT, "packages", "constructor", "dist", "start.js");
  if (existsSync(constructorEntry)) return;
  log("Primeira execução — instalando dependências e compilando (só acontece uma vez)...");
  await run(NPM_CMD, ["install"]);
  await run(NPM_CMD, ["run", "build"]);
}

async function waitForHealth(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // ainda subindo — tenta de novo
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function openBrowser(url) {
  // Sem navegador gráfico disponível (servidor remoto, container, CI) não pode ser fatal — a URL já foi
  // impressa acima. `spawn` falha de forma ASSÍNCRONA quando o binário não existe (ex.: ENOENT de
  // "xdg-open" num container headless): só o try/catch não pega isso, precisa do listener de "error".
  try {
    let child;
    if (process.platform === "darwin") {
      child = spawn("open", [url], { detached: true, stdio: "ignore" });
    } else if (process.platform === "win32") {
      child = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
    } else {
      child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    }
    child.on("error", () => {});
    child.unref();
  } catch {
    // idem — sem navegador disponível, apenas segue com a URL impressa
  }
}

async function main() {
  await ensureBuilt();

  log(`Ligando o Super Construtor em http://127.0.0.1:${CONSTRUCTOR_PORT} ...`);
  const constructor = spawn(process.execPath, [path.join("packages", "constructor", "dist", "start.js")], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PORT: String(CONSTRUCTOR_PORT) },
  });
  constructor.on("error", (err) => log(`Não consegui ligar o Super Construtor: ${err.message}`));

  const constructorReady = await waitForHealth(`http://127.0.0.1:${CONSTRUCTOR_PORT}/health`);
  log(constructorReady ? "Super Construtor no ar." : "Super Construtor demorou a responder — veja os logs acima.");

  log(`Ligando o Canvas em http://localhost:${CANVAS_PORT} ...`);
  // Invoca o binário do vite direto (não via `npm run dev`): `npm` intercala uma camada de shell
  // (`npm` -> `sh -c` -> `vite`) que não repassa SIGTERM de forma confiável — `canvas.kill()` mataria
  // só o `npm`, deixando o processo real do vite (e a porta) órfão.
  const viteBin = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
  const canvas = spawn(viteBin, ["--port", String(CANVAS_PORT)], {
    cwd: path.join(ROOT, "apps", "canvas"),
    stdio: "inherit",
    env: { ...process.env, VITE_CONSTRUCTOR_URL: `http://127.0.0.1:${CONSTRUCTOR_PORT}` },
  });
  canvas.on("error", (err) => log(`Não consegui ligar o Canvas: ${err.message}`));

  const canvasUrl = `http://localhost:${CANVAS_PORT}`;
  await waitForHealth(canvasUrl);
  log(`Pronto! Abra ${canvasUrl} — tentando abrir automaticamente no navegador...`);
  openBrowser(canvasUrl);
  log("Ctrl+C encerra os dois processos.");

  function shutdown() {
    log("Encerrando...");
    constructor.kill();
    canvas.kill();
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(`[genius-allspark] Falhou: ${err.message}`);
  process.exit(1);
});
