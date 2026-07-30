import { serve } from "bun";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  buildSequence,
  loadOrgChart,
  loadRouting,
} from "./lib/routing.ts";

const PORT = Number(process.env.NIRVANA_BRIDGE_PORT ?? 4000);
const HOST = process.env.NIRVANA_BRIDGE_HOST ?? "127.0.0.1";
const PUBLIC_BRIDGE_URL = process.env.PUBLIC_BRIDGE_URL ?? "";
// Sem instalação real do Nirvana OS configurada, o bridge cai para o motor
// real embutido (tools/real-engine.ts), que usa a CLI `claude` local para
// gerar conteúdo de verdade (ver README) — o suficiente para explorar o
// sistema de ponta a ponta sem exigir nenhuma configuração além de ter a
// CLI autenticada. Aponte NIRVANA_ENGINE_PATH para outra instalação (ex.:
// tools/stub-engine.ts, para uma simulação instantânea sem custo de API,
// ou uma instalação real do Nirvana OS) se preferir.
// `||` (não `??`) de propósito: uma variável presente no .env mas vazia
// (`NIRVANA_ENGINE_PATH=`) deve cair no padrão, não virar um caminho vazio.
const ENGINE_PATH =
  process.env.NIRVANA_ENGINE_PATH || join(import.meta.dir, "tools/real-engine.ts");
const ORG_CHART_PATH =
  process.env.IFFAR_ORG_CHART_PATH ||
  join(import.meta.dir, "businesses/iffar/org-chart.yaml");
const ROUTING_PATH =
  process.env.IFFAR_ROUTING_PATH || join(import.meta.dir, "businesses/iffar/routing.yaml");
const TICKETS_DIR = process.env.IFFAR_TICKETS_DIR || join(import.meta.dir, ".data/tickets");
const OUTPUTS_DIR = process.env.IFFAR_OUTPUTS_DIR || join(import.meta.dir, ".data/outputs");
// Enriquecimento opcional dos tooltips da UI (resumo de competência por
// artigo do Anexo I) — não entra no boot fail-fast: a orquestração funciona
// sem ele, só a UI fica sem o resumo institucional.
const COMPETENCIAS_PATH =
  process.env.IFFAR_COMPETENCIAS_PATH ||
  join(import.meta.dir, "businesses/iffar/competencias.yaml");

// ---------------------------------------------------------------------------
// BOOT FAIL-FAST — a configuração é validada uma vez, na inicialização. Um
// bridge mal configurado não deve subir e responder 503 por requisição; deve
// falhar alto e cedo, com uma mensagem clara do que falta.
// ---------------------------------------------------------------------------

function checkRequiredPaths() {
  // TICKETS_DIR/OUTPUTS_DIR são apenas armazenamento local de execução — se
  // não existirem (padrão .data/ ou caminho customizado), cria-se em vez de
  // abortar; diferente de ENGINE_PATH/ORG_CHART_PATH/ROUTING_PATH, que
  // precisam apontar para um arquivo real e existente.
  for (const dir of [TICKETS_DIR, OUTPUTS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`[Bridge] Diretório criado: ${dir}`);
    }
  }

  const required: Array<[string, string]> = [
    ["NIRVANA_ENGINE_PATH", ENGINE_PATH],
    ["IFFAR_ORG_CHART_PATH", ORG_CHART_PATH],
    ["IFFAR_ROUTING_PATH", ROUTING_PATH],
  ];
  const missing = required.filter(([, value]) => !value || !existsSync(value));
  if (missing.length > 0) {
    console.error("[Bridge] Configuração incompleta — abortando inicialização.");
    for (const [name, value] of missing) {
      console.error(`  - ${name}: ${value ? `caminho não encontrado (${value})` : "não definido"}`);
    }
    console.error("Configure essas variáveis em .env (veja .env.example) e tente novamente.");
    process.exit(1);
  }
}

checkRequiredPaths();

// ---------------------------------------------------------------------------
// CAMADA DE DADOS INSTITUCIONAL — org-chart.yaml + routing.yaml carregados
// uma única vez no boot. Nunca lidos por requisição.
// ---------------------------------------------------------------------------

const org = loadOrgChart(ORG_CHART_PATH);
const routing = loadRouting(ROUTING_PATH);
const competenciasRaw = existsSync(COMPETENCIAS_PATH) ? readFileSync(COMPETENCIAS_PATH, "utf8") : null;
if (!competenciasRaw) {
  console.warn(
    `[Bridge] Aviso: competencias.yaml não encontrado em ${COMPETENCIAS_PATH}; tooltips institucionais ficarão sem resumo de competência.`,
  );
}

console.log(
  `[Bridge] Organograma carregado: ${org.units.length} unidades, ${org.campusUnits.length} campi, ${routing.rules.length} regras de roteamento.`,
);

// ---------------------------------------------------------------------------
// ACOMPANHAMENTO DE TICKETS EM EXECUÇÃO — o motor real pode levar de
// segundos (pareceres curtos) a dezenas de minutos (o PDI institucional,
// que passa pelos 13 campi). Por isso /api/brief não espera o motor
// terminar: dispara o processo em background e devolve na hora; o
// front-end acompanha via polling em /api/ticket-status.
// ---------------------------------------------------------------------------

interface TicketState {
  status: "running" | "done" | "error";
  problem: string;
  startedAt: number;
  finishedAt?: number;
  exitCode?: number;
  output: string;
}

const tickets = new Map<string, TicketState>();

function isAllowedArtifact(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  if (!lower.endsWith(".md") && !lower.endsWith(".pdf")) return false;
  return [TICKETS_DIR, OUTPUTS_DIR].some((directory) => {
    let root: string;
    let candidate: string;
    try {
      root = realpathSync(resolve(directory));
      // o arquivo pode ainda não existir no instante da checagem de rota;
      // resolve o diretório-pai real e recompõe o caminho para neutralizar
      // symlinks sem exigir que o arquivo já esteja no disco.
      const resolved = resolve(filePath);
      const parent = realpathSync(resolve(resolved, ".."));
      candidate = join(parent, resolved.split(/[/\\]/).pop()!);
    } catch {
      return false;
    }
    const pathFromRoot = relative(root, candidate);
    return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
  });
}

function makeTicketId(problem: string): string {
  const hash = createHash("sha256").update(problem).digest("hex").slice(0, 8);
  return `${Date.now()}-${hash}`;
}

function bridgeBaseUrl(req: Request): string {
  if (PUBLIC_BRIDGE_URL) return PUBLIC_BRIDGE_URL;
  const host = req.headers.get("host");
  return host ? `http://${host}` : `http://${HOST}:${PORT}`;
}

function findArtifact(ticketId: string, base: string): string | null {
  const ticketDir = join(TICKETS_DIR, ticketId);
  for (const name of ["result.pdf", "result.md"]) {
    const fullPath = join(ticketDir, name);
    if (existsSync(fullPath)) {
      return `${base}/api/view-artifact?file=${encodeURIComponent(fullPath)}`;
    }
  }
  for (const name of ["latest_result.pdf", "latest_result.md"]) {
    const fallbackPath = join(OUTPUTS_DIR, name);
    if (existsSync(fallbackPath)) {
      return `${base}/api/view-artifact?file=${encodeURIComponent(fallbackPath)}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// SERVIDOR HTTP
// ---------------------------------------------------------------------------

console.log(`Starting Nirvana Bridge on port ${PORT}...`);

const corsHeaders = { "Access-Control-Allow-Origin": "*" };

serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response("OK", {
        headers: {
          ...corsHeaders,
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (url.pathname === "/api/health" && req.method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          engine: ENGINE_PATH,
          orgChart: ORG_CHART_PATH,
          unidades: org.units.length,
          rules: routing.rules.length,
          competencias: competenciasRaw ? "carregado" : "indisponivel",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (url.pathname === "/api/routing" && req.method === "GET") {
      return new Response(JSON.stringify(routing), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/competencias" && req.method === "GET") {
      if (!competenciasRaw) {
        return new Response(JSON.stringify({ competencias: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(competenciasRaw, {
        headers: { ...corsHeaders, "Content-Type": "text/yaml" },
      });
    }

    if (url.pathname === "/api/view-artifact" && req.method === "GET") {
      try {
        const filePath = url.searchParams.get("file");
        if (!filePath || !isAllowedArtifact(filePath) || !existsSync(filePath)) {
          return new Response(
            "# Arquivo não encontrado\nO relatório ainda está sendo gerado ou o caminho expirou.",
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "text/markdown; charset=utf-8" },
            },
          );
        }
        const isPdf = filePath.toLowerCase().endsWith(".pdf");
        const file = Bun.file(filePath);
        return new Response(file, {
          headers: {
            ...corsHeaders,
            "Content-Type": isPdf ? "application/pdf" : "text/markdown; charset=utf-8",
          },
        });
      } catch (err: any) {
        return new Response(`# Erro ao abrir arquivo\n${err.message}`, {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "text/markdown; charset=utf-8" },
        });
      }
    }

    if (url.pathname === "/api/org-chart" && req.method === "GET") {
      try {
        return new Response(Bun.file(ORG_CHART_PATH), {
          headers: { ...corsHeaders, "Content-Type": "text/yaml" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    if (url.pathname === "/api/ticket-status" && req.method === "GET") {
      const ticketId = url.searchParams.get("id");
      if (!ticketId) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const state = tickets.get(ticketId);
      if (!state) {
        return new Response(JSON.stringify({ error: "Ticket desconhecido" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const base = bridgeBaseUrl(req);
      const artifact = findArtifact(ticketId, base);
      return new Response(
        JSON.stringify({
          status: state.status,
          success: state.status === "done" && state.exitCode === 0,
          artifacts: artifact ? [artifact] : [],
          elapsedMs: (state.finishedAt ?? Date.now()) - state.startedAt,
          // só manda o log de saída do motor quando algo deu errado — ajuda
          // a diagnosticar sem inchar cada poll de status bem-sucedido.
          output: state.status === "error" ? state.output.slice(-4000) : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (url.pathname === "/api/brief" && req.method === "POST") {
      try {
        const body = await req.json();
        const problem = body.problem;

        if (!problem) {
          return new Response(JSON.stringify({ error: "Missing problem" }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const ticketId = makeTicketId(problem);
        console.log(`[Bridge] Disparando IFFar (ticket ${ticketId}): ${problem}`);

        const sequence = buildSequence(problem, org, routing);

        tickets.set(ticketId, {
          status: "running",
          problem,
          startedAt: Date.now(),
          output: "",
        });

        const child = spawn("bun", [ENGINE_PATH, "iffar", problem], {
          stdio: "pipe",
          env: {
            ...process.env,
            IFFAR_TICKET_ID: ticketId,
            IFFAR_TICKETS_DIR: TICKETS_DIR,
            IFFAR_OUTPUTS_DIR: OUTPUTS_DIR,
            IFFAR_ORG_CHART_PATH: ORG_CHART_PATH,
            IFFAR_ROUTING_PATH: ROUTING_PATH,
            IFFAR_COMPETENCIAS_PATH: COMPETENCIAS_PATH,
          },
        });

        child.stdout.on("data", (data) => {
          const state = tickets.get(ticketId);
          if (state) state.output += data.toString();
        });
        child.stderr.on("data", (data) => {
          const state = tickets.get(ticketId);
          if (state) state.output += data.toString();
        });
        child.on("close", (code) => {
          console.log(`[Bridge] Ticket ${ticketId} finalizado com código ${code}`);
          const state = tickets.get(ticketId);
          if (state) {
            state.status = code === 0 ? "done" : "error";
            state.exitCode = code ?? 1;
            state.finishedAt = Date.now();
          }
        });

        // Não espera o motor terminar — a UI acompanha via
        // /api/ticket-status enquanto anima a cadeia de unidades.
        return new Response(
          JSON.stringify({ ticketId, sequence, pending: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});
