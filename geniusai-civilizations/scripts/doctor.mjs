#!/usr/bin/env node
/**
 * `npm run doctor` — diagnóstico de ambiente (RF do PRD §14, "script de
 * diagnóstico"): confere, ANTES de rodar `npm run dev`, se este ambiente
 * consegue de fato rodar o projeto — sem precisar subir o servidor para
 * descobrir. Zero dependências (só `node:*`), consistente com `scripts/dev.mjs`.
 *
 * Sempre roda a partir da raiz do workspace (`geniusai-civilizations/`) via
 * `npm run doctor`. Saída: uma linha por checagem (✓ ok, ⚠ aviso, ✗ bloqueio)
 * e um veredito final. Sai com código 1 se houver algum ✗ (bloqueio real);
 * avisos não impedem o `dev`, só chamam atenção.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNNERS = ["claude", "codex", "opencode", "ollama", "mock"];

const results = [];
function ok(msg) { results.push({ level: "ok", msg }); }
function warn(msg) { results.push({ level: "warn", msg }); }
function fail(msg) { results.push({ level: "fail", msg }); }

// ── .env: mesma busca em duas etapas do backend (config.ts:loadDotEnv) ─────
for (const file of [path.join(ROOT, "apps/backend/.env"), path.join(ROOT, ".env")]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // arquivo ausente — tentativa seguinte (ou nenhuma: env do processo já basta)
  }
}

// ── Node.js ──────────────────────────────────────────────────────────────
const [major] = process.versions.node.split(".").map(Number);
if (major >= 20) ok(`Node.js ${process.version} (>= 20 requerido)`);
else fail(`Node.js ${process.version} é antigo demais — instale Node 20 ou mais recente`);

// ── Runner configurado ───────────────────────────────────────────────────
const runner = (process.env.RUNNER ?? "claude").toLowerCase();
if (!RUNNERS.includes(runner)) {
  fail(`RUNNER="${process.env.RUNNER}" não é reconhecido (use: ${RUNNERS.join(" | ")})`);
} else if (runner === "mock") {
  ok('RUNNER=mock — nenhuma dependência externa, sempre disponível');
} else if (runner === "ollama") {
  const host = process.env.OLLAMA_HOST ?? "http://localhost:11434";
  try {
    const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) ok(`Ollama respondeu em ${host}`);
    else fail(`Ollama em ${host} respondeu ${res.status} — rode "ollama serve" e confira o modelo`);
  } catch {
    fail(`Não consegui falar com o Ollama em ${host} — rode "ollama serve" primeiro`);
  }
} else {
  const cmd = process.env.AGENT_CMD ?? runner;
  const probe = spawnSync(cmd, ["--version"], { stdio: "ignore", timeout: 10_000 });
  if (probe.error) fail(`CLI "${cmd}" (RUNNER=${runner}) não foi encontrado no PATH`);
  else if (probe.status !== 0) warn(`CLI "${cmd}" respondeu com código ${probe.status} a --version`);
  else ok(`CLI "${cmd}" (RUNNER=${runner}) disponível no PATH`);
}

// ── Porta livre ──────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
await new Promise((resolve) => {
  const srv = net.createServer();
  srv.once("error", (err) => {
    if (err.code === "EADDRINUSE") warn(`Porta ${port} já está em uso — pode ser este projeto já rodando`);
    else warn(`Não consegui testar a porta ${port}: ${err.message}`);
    resolve();
  });
  srv.once("listening", () => srv.close(() => { ok(`Porta ${port} livre em ${host}`); resolve(); }));
  srv.listen(port, host);
});

// ── DATA_DIR gravável ────────────────────────────────────────────────────
const dataDir = process.env.DATA_DIR ?? path.join(ROOT, "data");
try {
  mkdirSync(dataDir, { recursive: true });
  const probeFile = path.join(dataDir, `.doctor-probe-${process.pid}`);
  writeFileSync(probeFile, "ok");
  rmSync(probeFile);
  ok(`DATA_DIR gravável: ${dataDir}`);
} catch (err) {
  fail(`DATA_DIR não é gravável (${dataDir}): ${err instanceof Error ? err.message : String(err)}`);
}

// ── Veredito ─────────────────────────────────────────────────────────────
const ICON = { ok: "✓", warn: "⚠", fail: "✗" };
console.log("\nGeniusAI Civilizations — diagnóstico de ambiente\n");
for (const r of results) console.log(`  ${ICON[r.level]} ${r.msg}`);

const failures = results.filter((r) => r.level === "fail").length;
const warnings = results.filter((r) => r.level === "warn").length;
console.log();
if (failures > 0) {
  console.log(`✗ ${failures} bloqueio(s) — corrija antes de "npm run dev".`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`⚠ Tudo essencial ok, mas há ${warnings} aviso(s) acima.`);
} else {
  console.log("✓ Ambiente pronto — pode rodar \"npm run dev\".");
}
