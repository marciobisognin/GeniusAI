#!/usr/bin/env bun
/**
 * Motor real de geração de conteúdo do IFFar 3D Town — substitui o
 * `stub-engine.ts` como padrão de `NIRVANA_ENGINE_PATH`. Diferente do stub
 * (que só escreve um `result.md` de exemplo), este motor de fato gera o
 * artefato: usa a CLI `claude` local, já autenticada nesta máquina, em modo
 * não-interativo (`claude -p`) para produzir um parecer real (temas comuns)
 * ou um documento institucional completo em capítulos (temas de alcance
 * institucional, como o PDI, que envolvem os 13 campi via
 * `broadcast_all_campi` em routing.yaml).
 *
 * Requisitos do ambiente onde o bridge roda: a CLI `claude` instalada e
 * autenticada (ver README). Sem isso, aponte `NIRVANA_ENGINE_PATH` para
 * `tools/stub-engine.ts` (simulação instantânea, sem custo de API) ou para
 * uma instalação real do Nirvana OS.
 *
 * Uso: bun real-engine.ts <negocio> <problema>
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildContributionPlan,
  loadCompetencias,
  loadOrgChart,
  loadRouting,
  type Competencia,
  type ContributionPlan,
  type OrgUnit,
} from "../lib/routing.ts";

const [, , , ...rest] = process.argv;
const problem = rest.join(" ").trim();
const ticketId = process.env.IFFAR_TICKET_ID;
const ticketsDir = process.env.IFFAR_TICKETS_DIR;
const outputsDir = process.env.IFFAR_OUTPUTS_DIR;

const ORG_CHART_PATH =
  process.env.IFFAR_ORG_CHART_PATH || join(import.meta.dir, "../businesses/iffar/org-chart.yaml");
const ROUTING_PATH =
  process.env.IFFAR_ROUTING_PATH || join(import.meta.dir, "../businesses/iffar/routing.yaml");
const COMPETENCIAS_PATH =
  process.env.IFFAR_COMPETENCIAS_PATH || join(import.meta.dir, "../businesses/iffar/competencias.yaml");

if (!problem) {
  console.error("[real-engine] Nenhum briefing informado — nada a fazer.");
  process.exit(1);
}
if (!ticketId || !ticketsDir) {
  console.error("[real-engine] IFFAR_TICKET_ID/IFFAR_TICKETS_DIR ausentes; nada será escrito.");
  process.exit(1);
}

const ticketDir = join(ticketsDir, ticketId);
const chaptersDir = join(ticketDir, "chapters");
mkdirSync(chaptersDir, { recursive: true });

// ---------------------------------------------------------------------------
// CHAMADA AO MODELO — usa a CLI `claude` local (não uma API key própria):
// reaproveita a autenticação já configurada nesta máquina. `--safe-mode`
// evita que CLAUDE.md/hooks/plugins do repositório interfiram na geração de
// conteúdo; `--system-prompt` custom mantém o overhead de tokens (e custo)
// baixo em vez do prompt de sistema completo do Claude Code. `--permission-
// mode dontAsk` é necessário porque a sessão roda como root (bypassPermissions
// é recusado nesse caso) — WebSearch continua sendo o único tipo de tool
// habilitado, então o risco de uma ação indevida é mínimo.
// ---------------------------------------------------------------------------

const WRITER_SYSTEM_PROMPT =
  "Você é um redator técnico institucional do Instituto Federal Farroupilha (IFFar), " +
  "especializado em documentos de planejamento e pareceres administrativos em português " +
  "formal. Responda SOMENTE com o texto pedido, em Markdown simples (títulos com #, " +
  "parágrafos, listas com -, negrito com **), sem comentários sobre o que você vai fazer, " +
  "sem introduções do tipo 'aqui está' e sem repetir estas instruções.";

interface ClaudeCallOptions {
  model?: "sonnet" | "haiku";
  allowSearch?: boolean;
  maxBudgetUsd?: number;
  timeoutMs?: number;
}

function runClaude(prompt: string, opts: ClaudeCallOptions = {}): string {
  const {
    model = "sonnet",
    allowSearch = false,
    maxBudgetUsd = 0.8,
    timeoutMs = 5 * 60 * 1000,
  } = opts;

  const args = [
    "-p",
    prompt,
    "--output-format",
    "text",
    "--permission-mode",
    "dontAsk",
    "--safe-mode",
    "--model",
    model,
    "--system-prompt",
    WRITER_SYSTEM_PROMPT,
    "--max-budget-usd",
    String(maxBudgetUsd),
  ];
  if (allowSearch) {
    args.push("--allowedTools", "WebSearch");
  } else {
    args.push("--allowedTools", "");
  }

  const result = spawnSync("claude", args, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`claude -p falhou ao iniciar/rodar: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "erro desconhecido").trim();
    throw new Error(`claude -p falhou (status ${result.status}): ${err.slice(0, 500)}`);
  }
  return result.stdout.trim();
}

// Chapters já escritos (por causa de uma execução anterior com o mesmo
// ticket) não são refeitos — poupa tempo e custo de API numa retomada.
function writeChapterOnce(slug: string, generate: () => string): string {
  const path = join(chaptersDir, `${slug}.md`);
  if (existsSync(path)) {
    console.log(`[real-engine] Capítulo "${slug}" já existe — reaproveitando.`);
    return readFileSync(path, "utf8");
  }
  console.log(`[real-engine] Gerando capítulo "${slug}"...`);
  const content = generate();
  writeFileSync(path, content);
  return content;
}

function competenciaFor(unit: OrgUnit, competencias: Competencia[] | null): string {
  if (!competencias) return "";
  const hit = competencias.find(
    (c) => normalizeLoose(c.unidade_titulo).includes(normalizeLoose(unit.nome)) ||
      normalizeLoose(unit.nome).includes(normalizeLoose(c.unidade_titulo)),
  );
  return hit ? `Competência de referência (Anexo I, Art. ${hit.artigo}): ${hit.resumo}` : "";
}

function normalizeLoose(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// MODO 1 — PARECER CURTO: a maioria dos playbooks (fiscalização de contrato,
// minuta de PPC, relatório de extensão etc.), que envolvem no máximo um
// campus e uma cadeia sistêmica curta. Uma única chamada real, com pesquisa
// na web quando fizer sentido, produz um parecer completo e citável.
// ---------------------------------------------------------------------------

function generateShortParecer(plan: ContributionPlan, competencias: Competencia[] | null): string {
  const executingUnit =
    plan.campusChains[0]?.chain.at(-1) ?? plan.systemicUnits.at(-1) ?? plan.reitoria;
  const chainNames = [
    plan.reitoria.nome,
    ...plan.systemicUnits.map((u) => u.nome),
    ...(plan.campusChains[0]?.chain.map((u) => u.nome) ?? []),
  ];
  const competenciaNote = competenciaFor(executingUnit, competencias);

  const prompt = `Redija um parecer/resposta institucional REAL e completo do Instituto Federal
Farroupilha (IFFar) para a seguinte demanda, como se fosse emitido pela unidade
"${executingUnit.nome}" (${executingUnit.cargo ?? "responsável técnico"}), após
tramitar pela cadeia: ${chainNames.join(" → ")}.

Demanda recebida: "${problem}"

${competenciaNote}
Base legal do trâmite: ${plan.baseLegal.join("; ") || "regimento interno do IFFar"}.

Estruture como um parecer/documento técnico real (não uma simulação): contexto,
análise técnica fundamentada, e conclusão/encaminhamento objetivo. Se a demanda
pedir um dado externo verificável (legislação, norma técnica, prazo legal),
faça uma pesquisa rápida antes de responder. Cite a base legal do IFFar listada
acima. Produza entre 500 e 1200 palavras.`;

  const body = runClaude(prompt, { model: "sonnet", allowSearch: true, maxBudgetUsd: 1.5 });

  return [
    `# ${executingUnit.nome} — Parecer`,
    "",
    `**Ticket:** ${ticketId}`,
    `**Trâmite:** ${chainNames.join(" → ")}`,
    `**Base legal:** ${plan.baseLegal.join("; ") || "—"}`,
    "",
    "---",
    "",
    "## Demanda recebida",
    "",
    problem,
    "",
    "---",
    "",
    body,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// MODO 2 — DOCUMENTO INSTITUCIONAL LONGO (broadcast a todos os campi, ex.:
// o novo PDI): um capítulo por eixo temático + um por campus, cada um
// gerado por uma chamada real (com pesquisa na web nos eixos, que se
// beneficiam de referências externas), escritos incrementalmente em
// chapters/ para que uma execução longa possa ser retomada sem regerar o
// que já ficou pronto.
// ---------------------------------------------------------------------------

const PDI_EIXOS = [
  {
    slug: "eixo-ensino",
    titulo: "Eixo 1 — Ensino, Currículo e Formação Integral",
    foco: "expansão e qualidade dos cursos técnicos e superiores, currículos integrados, avaliação pedagógica, permanência e êxito estudantil",
  },
  {
    slug: "eixo-pesquisa-inovacao",
    titulo: "Eixo 2 — Pesquisa, Pós-Graduação e Inovação",
    foco: "iniciação científica, programas de pós-graduação, núcleos de inovação tecnológica, patentes e transferência de tecnologia",
  },
  {
    slug: "eixo-extensao",
    titulo: "Eixo 3 — Extensão e Relação com a Comunidade",
    foco: "programas de extensão, arranjos produtivos locais, estágios, parcerias com o setor produtivo e a sociedade civil",
  },
  {
    slug: "eixo-gestao",
    titulo: "Eixo 4 — Gestão, Governança e Pessoas",
    foco: "governança institucional, gestão de riscos, gestão de pessoas, capacitação de servidores, tecnologia da informação",
  },
  {
    slug: "eixo-infraestrutura",
    titulo: "Eixo 5 — Infraestrutura e Sustentabilidade",
    foco: "infraestrutura física, obras, acessibilidade, sustentabilidade ambiental, gestão de resíduos e uso racional de recursos",
  },
  {
    slug: "eixo-assistencia-estudantil",
    titulo: "Eixo 6 — Assistência Estudantil e Inclusão",
    foco: "permanência estudantil, auxílios, ações afirmativas, inclusão de pessoas com deficiência, apoio psicopedagógico",
  },
  {
    slug: "eixo-internacionalizacao",
    titulo: "Eixo 7 — Internacionalização e Educação a Distância",
    foco: "mobilidade acadêmica internacional, parcerias externas, expansão da educação a distância e dos polos de apoio presencial",
  },
] as const;

function generateLongPdi(plan: ContributionPlan): string {
  const totalCampi = plan.campusChains.length;
  console.log(`[real-engine] Documento longo: ${PDI_EIXOS.length} eixos + ${totalCampi} campi.`);

  const capa = writeChapterOnce("00-capa", () =>
    [
      "# Plano de Desenvolvimento Institucional",
      "## Instituto Federal Farroupilha",
      "",
      `**Documento gerado a partir da demanda:** "${problem}"`,
      "",
      `**Ticket:** ${ticketId}`,
      `**Data de geração:** ${new Date().toLocaleDateString("pt-BR")}`,
      `**Unidades envolvidas na elaboração:** Reitoria, ${plan.systemicUnits.map((u) => u.nome).join(", ")}, e os ${totalCampi} campi do IFFar.`,
      "",
      "> Documento gerado automaticamente pelo motor real do IFFar 3D Town " +
        "(protótipo demonstrativo) a partir do organograma oficial da Portaria " +
        "Eletrônica nº 876/2026 - GRE. O conteúdo é sintetizado por IA a partir de " +
        "diretrizes públicas (MEC/ForPDI) e da estrutura institucional real — não " +
        "substitui a coleta de dados junto à comunidade acadêmica de cada campus, " +
        "etapa que um PDI real exige e que nenhum sistema automatizado pode substituir.",
    ].join("\n"),
  );

  const introducao = writeChapterOnce("01-introducao", () => {
    const body = runClaude(
      `Escreva o capítulo de INTRODUÇÃO E MARCO LEGAL de um Plano de Desenvolvimento
Institucional (PDI) do Instituto Federal Farroupilha (IFFar), motivado pela
demanda: "${problem}".

Use estes fatos institucionais reais como base (não invente outros números):
- Missão: "Promover a educação profissional, científica e tecnológica, pública
  e gratuita, por meio do ensino, pesquisa e extensão, com foco na formação
  integral do cidadão e no desenvolvimento sustentável."
- Visão: "Ser excelência na formação de técnicos de nível médio, professores
  para a educação básica e demais profissionais de nível superior, por meio da
  pesquisa, da extensão e da inovação."
- Valores: Ética, Solidariedade, Responsabilidade Social/Ambiental/Econômica,
  Comprometimento, Transparência, Respeito, Gestão Democrática, Inovação.
- A estrutura administrativa vigente é a Portaria Eletrônica nº 876/2026 - GRE
  (03/07/2026), que reorganiza a Reitoria e os 13 campi do IFFar.
- Base legal do trâmite desta demanda: ${plan.baseLegal.join("; ")}.

Estruture com: contextualização do PDI como instrumento de gestão, marco legal
(cite a Lei nº 11.892/2008 de criação dos Institutos Federais, e o papel do
PDI perante o MEC), e a relação entre este documento e a missão/visão acima.
Produza entre 900 e 1400 palavras, em Markdown com subtítulos (##).`,
      { model: "sonnet", allowSearch: true, maxBudgetUsd: 1.0 },
    );
    return `# ${"Introdução e Marco Legal"}\n\n${body}`;
  });

  const metodologia = writeChapterOnce("02-metodologia", () => {
    const body = runClaude(
      `Escreva o capítulo de METODOLOGIA de um PDI do Instituto Federal Farroupilha,
explicando como o documento foi elaborado: cadeia de elaboração institucional
(Reitoria → ${plan.systemicUnits.map((u) => u.nome).join(" → ")} → contribuição de
cada um dos ${totalCampi} campi → consolidação final pela Reitoria), alinhamento
com diretrizes do MEC para PDI de Institutos Federais (pesquise rapidamente as
diretrizes atuais — ex.: plataforma ForPDI, Plano Nacional de Educação — e cite
o que encontrar de forma geral, sem inventar números específicos que não
encontrar). Produza entre 500 e 900 palavras em Markdown.`,
      { model: "sonnet", allowSearch: true, maxBudgetUsd: 1.0 },
    );
    return `# Metodologia\n\n${body}`;
  });

  const diagnostico = writeChapterOnce("03-diagnostico", () => {
    const campusNames = plan.campusChains.map((c) => c.campus.nome).join(", ");
    const body = runClaude(
      `Escreva o capítulo de DIAGNÓSTICO INSTITUCIONAL de um PDI do Instituto Federal
Farroupilha. A instituição tem uma Reitoria (Santa Maria/RS) e ${totalCampi}
campi: ${campusNames}. Descreva, em termos gerais e plausíveis (sem inventar
números específicos de matrícula/orçamento que você não tenha certeza), o
panorama de uma rede federal de educação profissional desse porte no Rio
Grande do Sul: diversidade regional dos campi, papel de cada um no
desenvolvimento local, desafios comuns (evasão, infraestrutura, expansão) e
oportunidades (arranjos produtivos locais, parcerias). Produza entre 900 e
1400 palavras em Markdown com subtítulos.`,
      { model: "sonnet", allowSearch: false, maxBudgetUsd: 0.8 },
    );
    return `# Diagnóstico Institucional\n\n${body}`;
  });

  const eixosContent = PDI_EIXOS.map((eixo) =>
    writeChapterOnce(eixo.slug, () => {
      const body = runClaude(
        `Escreva um capítulo completo de PDI sobre "${eixo.titulo}" para o Instituto
Federal Farroupilha, com foco em: ${eixo.foco}. O capítulo deve conter:
diagnóstico do eixo, objetivos estratégicos, metas (com horizonte 2026-2030,
plausíveis para uma rede federal de 13 campi), indicadores de acompanhamento
e ações prioritárias. Pesquise rapidamente por referências/boas práticas
atuais do MEC ou de outros Institutos Federais para este eixo, e cite-as de
forma geral. Produza entre 1800 e 2600 palavras em Markdown com subtítulos
(##) e ao menos uma lista de metas.`,
        { model: "sonnet", allowSearch: true, maxBudgetUsd: 1.3 },
      );
      return `# ${eixo.titulo}\n\n${body}`;
    }),
  );

  const campiContent = plan.campusChains.map(({ campus, chain }) => {
    const slug = `campus-${campus.slug}`;
    return writeChapterOnce(slug, () => {
      const unidades = chain.map((u) => u.nome).join(", ") || "estrutura reduzida (Arts. 114-120)";
      const body = runClaude(
        `Escreva a subseção de contribuição do "${campus.nome}" para o PDI do Instituto
Federal Farroupilha. Este campus participa da elaboração através das unidades:
${unidades}. Descreva a realidade local plausível desse campus (perfil da
região do Rio Grande do Sul onde ele está, cursos que campi desse porte
costumam oferecer, prioridades de curto/médio prazo para os eixos de ensino,
pesquisa, extensão e infraestrutura) e proponha 4 a 6 metas locais alinhadas
ao PDI institucional. Produza entre 700 e 1100 palavras em Markdown.`,
        { model: "sonnet", allowSearch: false, maxBudgetUsd: 0.7 },
      );
      return `## Contribuição — ${campus.nome}\n\n${body}`;
    });
  });

  const fechamento = writeChapterOnce("99-fechamento", () => {
    const body = runClaude(
      `Escreva o capítulo final de um PDI do Instituto Federal Farroupilha, com:
CRONOGRAMA DE IMPLEMENTAÇÃO (2026-2030, por fase), SISTEMA DE ACOMPANHAMENTO
E AVALIAÇÃO (papel da Comissão Própria de Avaliação e da Coordenação de
Avaliação Institucional, periodicidade de revisão) e CONSIDERAÇÕES FINAIS.
Produza entre 900 e 1300 palavras em Markdown com subtítulos.`,
      { model: "sonnet", allowSearch: false, maxBudgetUsd: 0.8 },
    );
    return `# Cronograma, Acompanhamento e Considerações Finais\n\n${body}`;
  });

  return [
    capa,
    "\n\n---\n\n",
    "# Sumário",
    "",
    "1. Introdução e Marco Legal",
    "2. Metodologia",
    "3. Diagnóstico Institucional",
    ...PDI_EIXOS.map((e, i) => `${4 + i}. ${e.titulo}`),
    `${4 + PDI_EIXOS.length}. Contribuições dos Campi`,
    `${5 + PDI_EIXOS.length}. Cronograma, Acompanhamento e Considerações Finais`,
    "\n\n---\n\n",
    introducao,
    "\n\n---\n\n",
    metodologia,
    "\n\n---\n\n",
    diagnostico,
    "\n\n---\n\n",
    eixosContent.join("\n\n---\n\n"),
    "\n\n---\n\n",
    "# Contribuições dos Campi",
    "",
    campiContent.join("\n\n"),
    "\n\n---\n\n",
    fechamento,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// CONVERSÃO PARA PDF — via Chromium (Playwright), quando disponível no
// ambiente; se não estiver, o resultado em Markdown já é um artefato
// funcional por si só (o leitor da UI também sabe exibi-lo).
// ---------------------------------------------------------------------------

async function markdownToPdf(markdown: string, outPath: string): Promise<boolean> {
  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    console.warn("[real-engine] playwright-core não instalado — pulando geração de PDF.");
    return false;
  }

  const candidatePaths = [process.env.PLAYWRIGHT_CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(
    (p): p is string => Boolean(p),
  );
  const executablePath = candidatePaths.find((p) => existsSync(p));

  let browser;
  try {
    browser = await chromium.launch(executablePath ? { executablePath } : {});
  } catch (err) {
    console.warn(`[real-engine] Chromium indisponível — pulando geração de PDF (${(err as Error).message}).`);
    return false;
  }

  try {
    const page = await browser.newPage();
    await page.setContent(renderHtml(markdown), { waitUntil: "load" });
    await page.pdf({
      path: outPath,
      format: "A4",
      margin: { top: "2.2cm", bottom: "2cm", left: "2cm", right: "2cm" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;text-align:center;color:#888;font-family:Georgia,serif;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    return true;
  } finally {
    await browser.close();
  }
}

// Conversor Markdown -> HTML mínimo, feito sob medida para o subconjunto de
// Markdown pedido aos prompts acima (títulos, parágrafos, listas, negrito,
// citações e "---" como quebra de página) — não é um parser genérico.
function renderHtml(markdown: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  const blocks = markdown.split(/\n{2,}/);
  const html: string[] = [];
  let listBuffer: string[] = [];
  const flushList = () => {
    if (listBuffer.length > 0) {
      html.push(`<ul>${listBuffer.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
      listBuffer = [];
    }
  };

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed === "---") {
      flushList();
      html.push('<div class="page-break"></div>');
      continue;
    }
    if (/^#{1,3}\s/.test(trimmed)) {
      flushList();
      const level = trimmed.match(/^#{1,3}/)![0].length;
      html.push(`<h${level}>${inline(trimmed.replace(/^#{1,3}\s*/, ""))}</h${level}>`);
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      flushList();
      html.push(`<blockquote>${inline(trimmed.replace(/^>\s?/gm, ""))}</blockquote>`);
      continue;
    }
    const lines = trimmed.split("\n");
    if (lines.every((l) => /^[-*]\s/.test(l.trim()))) {
      for (const l of lines) listBuffer.push(l.trim().replace(/^[-*]\s/, ""));
      continue;
    }
    flushList();
    html.push(`<p>${inline(trimmed).replace(/\n/g, "<br/>")}</p>`);
  }
  flushList();

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.55; font-size: 12px; }
  h1 { font-size: 22px; margin-top: 0; }
  h2 { font-size: 17px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 28px; }
  h3 { font-size: 14px; margin-top: 20px; }
  p { text-align: justify; margin: 10px 0; }
  blockquote { border-left: 3px solid #999; margin: 12px 0; padding: 4px 14px; color: #444; font-style: italic; }
  ul { margin: 8px 0; padding-left: 22px; }
  li { margin: 4px 0; }
  .page-break { page-break-after: always; }
  strong { color: #000; }
</style>
</head>
<body>${html.join("\n")}</body>
</html>`;
}

// ---------------------------------------------------------------------------
// PONTO DE ENTRADA
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[real-engine] ticket ${ticketId}: "${problem}"`);

  const org = loadOrgChart(ORG_CHART_PATH);
  const routing = loadRouting(ROUTING_PATH);
  const competencias = loadCompetencias(COMPETENCIAS_PATH);
  const plan = buildContributionPlan(problem, org, routing);

  const isLongDocument = plan.campusChains.length > 3;
  const markdown = isLongDocument
    ? generateLongPdi(plan)
    : generateShortParecer(plan, competencias);

  const resultMdPath = join(ticketDir, "result.md");
  writeFileSync(resultMdPath, markdown);
  console.log(`[real-engine] Markdown final escrito em ${resultMdPath} (${markdown.length} caracteres).`);

  const resultPdfPath = join(ticketDir, "result.pdf");
  const pdfOk = await markdownToPdf(markdown, resultPdfPath);
  if (pdfOk) console.log(`[real-engine] PDF gerado em ${resultPdfPath}.`);

  if (outputsDir) {
    mkdirSync(outputsDir, { recursive: true });
    writeFileSync(join(outputsDir, "latest_result.md"), markdown);
    if (pdfOk) {
      const { copyFileSync } = await import("node:fs");
      copyFileSync(resultPdfPath, join(outputsDir, "latest_result.pdf"));
    }
  }
}

main().catch((err) => {
  console.error(`[real-engine] Falha: ${err.message}`);
  process.exit(1);
});
