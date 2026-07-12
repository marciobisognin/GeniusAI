#!/usr/bin/env node
/**
 * Smoke test E2E (RF do PRD §13.6, versão mínima): sobe backend (RUNNER=mock)
 * e o frontend BUILDADO (vite preview), abre um Chromium real e percorre o
 * fluxo: conectar → criar partida pelo modal → 2 ticks → propostas/timeline →
 * perguntar à civilização. Sai com código ≠ 0 em qualquer falha.
 *
 * Uso: npm run build && npm run e2e
 * Env: CHROMIUM_PATH aponta para um Chromium já instalado (opcional; sem ele
 *      o Playwright usa o navegador que `npx playwright install chromium` baixou).
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND_PORT = 8787; // o build do frontend aponta para ws://localhost:8787
const PREVIEW_PORT = 4173;

const children = [];
function run(cmd, args, env = {}) {
  const p = spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  p.stdout.on("data", (d) => process.stdout.write(`[${args.at(-1)}] ${d}`));
  p.stderr.on("data", (d) => process.stderr.write(`[${args.at(-1)}] ${d}`));
  children.push(p);
  return p;
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // servidor ainda subindo
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout esperando ${url}`);
}

let failed = false;
try {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "gai-e2e-"));
  run("npx", ["tsx", "apps/backend/src/index.ts"], {
    RUNNER: "mock",
    PORT: String(BACKEND_PORT),
    DATA_DIR: dataDir,
    TICK_SPEED_MS: "200",
  });
  run("npm", ["run", "preview", "--workspace", "apps/frontend", "--", "--port", String(PREVIEW_PORT), "--strictPort"]);

  await waitForHttp(`http://localhost:${BACKEND_PORT}/health`);
  await waitForHttp(`http://localhost:${PREVIEW_PORT}`);

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(20_000);

  // Conexão e estado inicial.
  await page.goto(`http://localhost:${PREVIEW_PORT}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=● conectado");
  console.log("✓ conectado ao backend (runner mock)");

  // Criação de partida pelo modal (RF-010).
  await page.click('button:text("Nova partida")');
  await page.waitForSelector(".modal-card");
  await page.fill('.modal-card input[placeholder*="Ascensão"]', "Partida E2E");
  await page.fill('.modal-card input[placeholder="aleatória"]', "42");
  await page.click('button:text("Fundar civilizações")');
  await page.waitForSelector("text=Tick: 0");
  console.log("✓ partida criada pelo modal");

  // Dois ticks com decisões do mock.
  for (let i = 1; i <= 2; i++) {
    await page.click('button:text("Step")');
    await page.waitForSelector(`text=Tick: ${i}`);
  }
  console.log("✓ 2 ticks executados");

  // Vista Mundo & Diplomacia: mapa e propostas derivados do motor.
  await page.click('.topbar-tabs button:text("Mundo & Diplomacia")');
  await page.waitForSelector(".map-canvas");
  await page.waitForSelector(".proposals-card");
  console.log("✓ mapa e painel de propostas renderizados");

  // Pergunte à civilização (agente real em modo somente leitura).
  await page.click('.topbar-tabs button:text("Crônicas")');
  await page.click('.ask-card button:text("Perguntar")');
  await page.waitForSelector(".answer-source");
  const source = await page.textContent(".answer-source");
  if (!/mock/.test(source ?? "")) throw new Error(`resposta sem atribuição do runner: ${source}`);
  console.log("✓ pergunta respondida pelo agente (runner mock)");

  await browser.close();
  console.log("\nE2E smoke: OK");
} catch (err) {
  failed = true;
  console.error("\nE2E smoke: FALHOU —", err instanceof Error ? err.message : err);
} finally {
  for (const p of children) p.kill("SIGINT");
  process.exit(failed ? 1 : 0);
}
