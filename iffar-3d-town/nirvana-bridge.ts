import { serve } from "bun";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const PORT = Number(process.env.NIRVANA_BRIDGE_PORT ?? 4000);
const HOST = process.env.NIRVANA_BRIDGE_HOST ?? "127.0.0.1";
const PUBLIC_BRIDGE_URL = process.env.PUBLIC_BRIDGE_URL ?? "";
// Sem instalação real do Nirvana OS configurada, o bridge cai para um
// stand-in (tools/stub-engine.ts) e diretórios locais — o suficiente para
// explorar a cena 3D e o roteamento (Opção A do README) sem exigir nenhuma
// configuração. Aponte NIRVANA_ENGINE_PATH/IFFAR_TICKETS_DIR/IFFAR_OUTPUTS_DIR
// para uma instalação real (Opção B) para orquestrações de verdade.
// `||` (não `??`) de propósito: uma variável presente no .env mas vazia
// (`NIRVANA_ENGINE_PATH=`) deve cair no padrão, não virar um caminho vazio.
const ENGINE_PATH =
  process.env.NIRVANA_ENGINE_PATH || join(import.meta.dir, "tools/stub-engine.ts");
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

interface OrgUnit {
  id: string;
  slug: string;
  nome: string;
  parent: string | null;
  cargo?: string;
  funcao?: string;
}

interface RoutingRule {
  tema: string;
  keywords: string[];
  prioridade: number;
  cadeia_sistemica: string[];
  cadeia_campus: string[];
  base_legal: string[];
}

interface RoutingConfig {
  version: number;
  default_route: {
    nome: string;
    cadeia_sistemica: string[];
    base_legal: string[];
  };
  rules: RoutingRule[];
}

const orgChartRaw = readFileSync(ORG_CHART_PATH, "utf8");
const orgChartDoc = parseYaml(orgChartRaw) as { units: OrgUnit[] };
const units: OrgUnit[] = orgChartDoc.units;
const unitsById = new Map<string, OrgUnit>(units.map((u) => [u.id, u]));
const childrenByParent = new Map<string, OrgUnit[]>();
for (const u of units) {
  if (!u.parent) continue;
  const siblings = childrenByParent.get(u.parent) ?? [];
  siblings.push(u);
  childrenByParent.set(u.parent, siblings);
}

const routingRaw = readFileSync(ROUTING_PATH, "utf8");
const routing = parseYaml(routingRaw) as RoutingConfig;

const competenciasRaw = existsSync(COMPETENCIAS_PATH)
  ? readFileSync(COMPETENCIAS_PATH, "utf8")
  : null;
if (!competenciasRaw) {
  console.warn(
    `[Bridge] Aviso: competencias.yaml não encontrado em ${COMPETENCIAS_PATH}; tooltips institucionais ficarão sem resumo de competência.`,
  );
}

// Campi são as unidades de primeiro nível diferentes da Reitoria ("1.1"),
// nunca uma lista hardcoded no bridge.
const CAMPUS_ROOT_RE = /^1\.\d+$/;
const campusUnits = units.filter((u) => CAMPUS_ROOT_RE.test(u.id) && u.id !== "1.1");

console.log(
  `[Bridge] Organograma carregado: ${units.length} unidades, ${campusUnits.length} campi, ${routing.rules.length} regras de roteamento.`,
);

// ---------------------------------------------------------------------------
// NORMALIZAÇÃO E CLASSIFICAÇÃO DO BRIEFING
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectCampus(normalizedProblem: string): OrgUnit | null {
  for (const campus of campusUnits) {
    const campusName = normalize(campus.nome.replace(/^Campus\s+/i, ""));
    if (campusName && normalizedProblem.includes(campusName)) {
      return campus;
    }
  }
  return null;
}

function classify(problem: string): { rule: RoutingRule | null; campus: OrgUnit | null } {
  const normalized = normalize(problem);
  const campus = detectCampus(normalized);

  let best: RoutingRule | null = null;
  let bestScore = 0;
  for (const rule of routing.rules) {
    const matches = rule.keywords.filter((kw) => normalized.includes(normalize(kw))).length;
    if (matches === 0) continue;
    const score = matches * rule.prioridade;
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }
  return { rule: best, campus };
}

// ---------------------------------------------------------------------------
// RESOLUÇÃO DA CADEIA DE HANDOFF — derivada da hierarquia real do
// organograma, nunca de coordenadas ou ids fixos por campus.
// ---------------------------------------------------------------------------

const NAME_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em"]);

function significantWords(nome: string): Set<string> {
  return new Set(
    normalize(nome)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 0 && !NAME_STOPWORDS.has(w)),
  );
}

function findChildByName(parentId: string, nomeAlvo: string): OrgUnit | null {
  const alvo = normalize(nomeAlvo);
  const candidates = childrenByParent.get(parentId) ?? [];

  const exact = candidates.find((c) => normalize(c.nome) === alvo);
  if (exact) return exact;

  // estrutura reduzida (Arts. 114-120): campi menores combinam diretorias/
  // coordenações em uma única unidade com nome composto — um match por
  // substring cobre a maioria dos casos (ex.: "Diretoria de Administração"
  // dentro de "Diretoria de Administração, Planejamento e Desenvolvimento
  // Institucional").
  const bySubstring = candidates.find((c) => normalize(c.nome).includes(alvo));
  if (bySubstring) return bySubstring;

  // quando a unidade combinada reordena ou troca palavras (ex.: "Diretoria
  // de Pesquisa, Extensão e Produção" vs. "Diretoria de Ensino, Pesquisa e
  // Extensão" em campi menores), decide por sobreposição de palavras
  // significativas — ainda por lookup no organograma, nunca hardcode.
  const alvoWords = significantWords(nomeAlvo);
  let best: OrgUnit | null = null;
  let bestOverlap = 0;
  for (const c of candidates) {
    const candWords = significantWords(c.nome);
    const overlap = [...alvoWords].filter((w) => candWords.has(w)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = c;
    }
  }
  return bestOverlap > 0 ? best : null;
}

function resolveCampusChain(campus: OrgUnit, nomes: string[]): OrgUnit[] {
  const gabinete = findChildByName(campus.id, "Gabinete do(a) Diretor(a) Geral");
  const chain: OrgUnit[] = gabinete ? [gabinete] : [];
  let parentId = campus.id;
  for (const nome of nomes) {
    const found = findChildByName(parentId, nome);
    if (!found) {
      console.warn(
        `[Bridge] Aviso: unidade "${nome}" não encontrada em ${campus.nome} (estrutura reduzida?); passo ignorado.`,
      );
      continue;
    }
    chain.push(found);
    parentId = found.id;
  }
  return chain;
}

interface HandoffStep {
  from: string;
  to: string;
  action: string;
  base_legal: string[];
  delay: number;
}

function buildSequence(problem: string) {
  const { rule, campus } = classify(problem);
  const cadeiaSistemicaIds = rule?.cadeia_sistemica ?? routing.default_route.cadeia_sistemica;
  const baseLegal = rule?.base_legal ?? routing.default_route.base_legal;
  const nomeRota = rule?.tema ?? routing.default_route.nome;

  const sistemicos = cadeiaSistemicaIds
    .map((id) => unitsById.get(id))
    .filter((u): u is OrgUnit => Boolean(u));

  const campusChain = campus && rule ? resolveCampusChain(campus, rule.cadeia_campus) : [];

  const reitoria = unitsById.get("1.1")!;
  const forward: OrgUnit[] = [reitoria, ...sistemicos, ...campusChain];
  // cadeias mais longas (mais hops entre Reitoria e campus) não devem
  // deixar a orquestração inteira mais lenta — o intervalo por passo
  // encolhe conforme a cadeia cresce, mantendo a duração total razoável.
  const totalHops = forward.length - 1 + (forward.length - 1);
  const STEP_DELAY = Math.max(1200, Math.min(2600, Math.round(18000 / Math.max(totalHops, 1))));

  const steps: HandoffStep[] = [];
  steps.push({
    from: "user",
    to: reitoria.id,
    action: `Recebendo briefing institucional: "${problem.slice(0, 60)}"`,
    base_legal: [],
    delay: 500,
  });

  for (let i = 0; i + 1 < forward.length; i++) {
    steps.push({
      from: forward[i]!.id,
      to: forward[i + 1]!.id,
      action: `Encaminhamento — ${forward[i + 1]!.nome} (${nomeRota})`,
      base_legal: baseLegal,
      delay: 500 + (i + 1) * STEP_DELAY,
    });
  }

  // volta: da unidade executora até a Reitoria, e desta ao usuário.
  const backward = [...forward].reverse();
  const baseDelay = 500 + forward.length * STEP_DELAY;
  for (let i = 0; i + 1 < backward.length; i++) {
    steps.push({
      from: backward[i]!.id,
      to: backward[i + 1]!.id,
      action: `Devolução do parecer — ${backward[i]!.nome} (${baseLegal.join("; ")})`,
      base_legal: baseLegal,
      delay: baseDelay + (i + 1) * STEP_DELAY,
    });
  }
  steps.push({
    from: reitoria.id,
    to: "user",
    action: "Artefato final consolidado e disponibilizado",
    base_legal: [],
    delay: baseDelay + backward.length * STEP_DELAY,
  });

  return steps;
}

// ---------------------------------------------------------------------------
// ARTEFATOS — vínculo ticket -> execução e checagem de caminho
// ---------------------------------------------------------------------------

function isAllowedArtifact(filePath: string): boolean {
  if (!filePath.toLowerCase().endsWith(".md")) return false;
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
          unidades: units.length,
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
        const content = readFileSync(filePath, "utf8");
        return new Response(content, {
          headers: { ...corsHeaders, "Content-Type": "text/markdown; charset=utf-8" },
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
        return new Response(orgChartRaw, {
          headers: { ...corsHeaders, "Content-Type": "text/yaml" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
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

        const sequence = buildSequence(problem);

        const child = spawn("bun", [ENGINE_PATH, "iffar", problem], {
          stdio: "pipe",
          env: {
            ...process.env,
            IFFAR_TICKET_ID: ticketId,
            IFFAR_TICKETS_DIR: TICKETS_DIR,
            IFFAR_OUTPUTS_DIR: OUTPUTS_DIR,
          },
        });

        let output = "";
        child.stdout.on("data", (data) => (output += data.toString()));
        child.stderr.on("data", (data) => (output += data.toString()));

        return new Promise((resolvePromise) => {
          child.on("close", (code) => {
            console.log(`[Bridge] Finalizado com código ${code}`);

            const artifactLinks: string[] = [];
            const ticketDir = join(TICKETS_DIR, ticketId);
            const base = bridgeBaseUrl(req);
            if (existsSync(join(ticketDir, "result.md"))) {
              const fullPath = join(ticketDir, "result.md");
              artifactLinks.push(`${base}/api/view-artifact?file=${encodeURIComponent(fullPath)}`);
            } else if (OUTPUTS_DIR) {
              const fallbackPath = join(OUTPUTS_DIR, "latest_result.md");
              if (existsSync(fallbackPath)) {
                artifactLinks.push(
                  `${base}/api/view-artifact?file=${encodeURIComponent(fallbackPath)}`,
                );
              }
            }

            resolvePromise(
              new Response(
                JSON.stringify({
                  success: code === 0,
                  ticketId,
                  output,
                  artifacts: artifactLinks,
                  sequence,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
              ),
            );
          });
        });
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
