#!/usr/bin/env bun
/**
 * Motor real de geração de conteúdo do IFFar 3D Town — substitui o
 * `stub-engine.ts` como padrão de `NIRVANA_ENGINE_PATH`. Diferente do stub
 * (que só escreve um `result.md` de exemplo), este motor de fato gera o
 * artefato: usa a CLI `claude` local, já autenticada nesta máquina, em modo
 * não-interativo (`claude -p`) para produzir o documento pedido.
 *
 * Antes de escrever qualquer conteúdo, o motor faz uma PESQUISA REAL (busca
 * na web) para descobrir como aquele tipo de demanda é, de fato, executado
 * na prática — primeiro no próprio IFFar, depois em outros Institutos
 * Federais e, na ausência de precedente, em outros órgãos públicos — e usa
 * o que encontrar (extensão em páginas, seções que costumam existir) para
 * dimensionar a geração. Isso é genérico: não há lista fixa de "eixos do
 * PDI" nem tamanho fixo de parecer — a mesma pesquisa que decide que um PDI
 * tem ~200 páginas e 10 seções decide, para outra demanda qualquer, que um
 * parecer de fiscalização de contrato tem 2-4 páginas e 3 seções.
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
// é recusado nesse caso) — WebSearch/WebFetch continuam sendo os únicos
// tipos de tool habilitados, então o risco de uma ação indevida é mínimo.
// ---------------------------------------------------------------------------

const WRITER_SYSTEM_PROMPT =
  "Você é um redator técnico institucional do Instituto Federal Farroupilha (IFFar), " +
  "especializado em documentos de planejamento e pareceres administrativos em português " +
  "formal. Responda SOMENTE com o texto pedido, em Markdown simples (títulos com #, " +
  "parágrafos, listas com -, negrito com **), sem comentários sobre o que você vai fazer, " +
  "sem introduções do tipo 'aqui está' e sem repetir estas instruções.";

const RESEARCH_SYSTEM_PROMPT =
  "Você pesquisa, na web, como documentos institucionais reais são de fato produzidos — " +
  "sua tarefa é descobrir precedentes concretos (não estimar de memória) e reportar dados " +
  "estruturados e realistas a partir do que encontrar.";

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
    // Seções pesquisadas podem pedir bem mais que um parecer curto (um PDI
    // real, por exemplo, pode ter seções de 5000+ palavras) — o timeout de
    // uma chamada de conteúdo precisa acompanhar isso, não ficar fixo em 5
    // minutos independente do tamanho pedido.
    timeoutMs = 10 * 60 * 1000,
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
    "--allowedTools",
    allowSearch ? "WebSearch,WebFetch" : "",
  ];

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

// Variante que devolve dados estruturados (JSON Schema), usada só pela
// pesquisa de extensão/estrutura — muito mais confiável que pedir um bloco
// de código JSON em texto livre e torcer para o parsing dar certo.
function runClaudeStructured<T>(prompt: string, schema: object, opts: ClaudeCallOptions = {}): T {
  const {
    model = "sonnet",
    allowSearch = true,
    maxBudgetUsd = 0.7,
    timeoutMs = 4 * 60 * 1000,
  } = opts;

  const args = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
    "--permission-mode",
    "dontAsk",
    "--safe-mode",
    "--model",
    model,
    "--system-prompt",
    RESEARCH_SYSTEM_PROMPT,
    "--max-budget-usd",
    String(maxBudgetUsd),
    "--allowedTools",
    allowSearch ? "WebSearch,WebFetch" : "",
  ];

  const result = spawnSync("claude", args, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) throw new Error(`pesquisa estruturada falhou ao rodar: ${result.error.message}`);
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "erro desconhecido").trim();
    throw new Error(`pesquisa estruturada falhou (status ${result.status}): ${err.slice(0, 500)}`);
  }
  const envelope = JSON.parse(result.stdout);
  if (!envelope.structured_output) {
    throw new Error("pesquisa estruturada não devolveu structured_output.");
  }
  return envelope.structured_output as T;
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

// Uma seção falhar (timeout, orçamento, instabilidade de rede) não deve
// derrubar um documento que já levou dezenas de minutos e chamadas reais
// para chegar até ali — vira uma nota pendente no artefato desta execução,
// sem gravar nada em disco, então uma nova tentativa do mesmo ticket
// regenera só o que faltou, nunca o que já deu certo.
function safeChapter(slug: string, generate: () => string): string {
  try {
    return writeChapterOnce(slug, generate);
  } catch (err) {
    console.warn(
      `[real-engine] Seção "${slug}" falhou (${(err as Error).message}); será retomada em nova execução deste ticket.`,
    );
    return `_[Esta seção ainda não pôde ser gerada — execute novamente este ticket para completá-la.]_`;
  }
}

// Chamadas de conteúdo escalam com o tamanho pedido: uma seção de 5000+
// palavras (comum quando a pesquisa aponta um documento de verdade longo)
// leva bem mais que os 5-10 minutos de um parecer curto, e o orçamento por
// chamada precisa acompanhar isso também.
function timeoutForWords(words: number): number {
  return Math.min(20 * 60 * 1000, Math.max(8 * 60 * 1000, words * 200));
}

function budgetForWords(words: number): number {
  return Math.min(4, Math.max(0.4, words / 1000));
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

function slugify(titulo: string, index: number): string {
  const base = normalizeLoose(titulo)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${String(index + 1).padStart(2, "0")}-${base || "secao"}`;
}

// ---------------------------------------------------------------------------
// PESQUISA REAL DE EXTENSÃO E ESTRUTURA — antes de gerar qualquer conteúdo,
// pergunta (com busca na web de verdade) como esse TIPO de demanda é
// executado na prática: primeiro procura um precedente real do próprio
// IFFar; sem isso, em outros Institutos Federais; sem isso, em outros
// órgãos públicos equivalentes. O resultado dimensiona a geração — nada de
// tamanho de documento hardcoded no código.
// ---------------------------------------------------------------------------

interface DocumentSection {
  titulo: string;
  palavras_alvo: number;
}

interface DocumentPlan {
  tipo_documento: string;
  paginas_alvo: number;
  estrutura: DocumentSection[];
  inclui_secao_por_campus: boolean;
  palavras_por_campus: number;
  fontes: string[];
  justificativa: string;
}

const DOCUMENT_PLAN_SCHEMA = {
  type: "object",
  properties: {
    tipo_documento: {
      type: "string",
      description: "Nome do tipo de documento/artefato que esta demanda produz (ex.: 'Parecer de Fiscalização Contratual', 'Plano de Desenvolvimento Institucional').",
    },
    paginas_alvo: {
      type: "number",
      description: "Número de páginas típico/real para este tipo de documento, baseado no precedente encontrado.",
    },
    estrutura: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          palavras_alvo: { type: "number" },
        },
        required: ["titulo", "palavras_alvo"],
      },
      description: "Seções gerais do documento (sem contar eventuais subseções por campus), na ordem em que devem aparecer.",
    },
    inclui_secao_por_campus: {
      type: "boolean",
      description: "true se este tipo de documento, pelo precedente encontrado, costuma ter uma subseção dedicada a cada campus/unidade regional envolvida.",
    },
    palavras_por_campus: {
      type: "number",
      description: "Se inclui_secao_por_campus, quantas palavras cada subseção de campus deve ter. 0 caso contrário.",
    },
    fontes: {
      type: "array",
      items: { type: "string" },
      description: "URLs ou referências concretas encontradas na pesquisa que embasaram esta estimativa.",
    },
    justificativa: {
      type: "string",
      description: "1-2 frases explicando de onde veio a estimativa (ex.: 'baseado no PDI 2024-2028 do IFC, 210 páginas').",
    },
  },
  required: ["tipo_documento", "paginas_alvo", "estrutura", "inclui_secao_por_campus", "palavras_por_campus", "fontes", "justificativa"],
};

const WORDS_PER_PAGE = 450; // densidade média da formatação usada em renderHtml()

function researchDocumentPlan(plan: ContributionPlan): DocumentPlan {
  const numCampi = plan.campusChains.length;
  const chainNames = [plan.reitoria.nome, ...plan.systemicUnits.map((u) => u.nome)];

  const prompt = `Uma demanda institucional real do Instituto Federal Farroupilha (IFFar) precisa
virar um documento/artefato. Antes de escrever qualquer conteúdo, descubra
como esse TIPO de demanda é executado NA PRÁTICA:

Demanda: "${problem}"
Tema classificado: ${plan.nomeRota}
Cadeia institucional até aqui: ${chainNames.join(" → ")}
Base legal do trâmite: ${plan.baseLegal.join("; ") || "regimento interno do IFFar"}
${numCampi > 1 ? `Esta demanda envolve ${numCampi} campi simultaneamente (é de alcance institucional).` : numCampi === 1 ? "Esta demanda envolve um único campus." : "Esta demanda não envolve diretamente nenhum campus (fica no âmbito sistêmico/Reitoria)."}

PESQUISE NA WEB (nessa ordem de prioridade, pare assim que achar um precedente
usável — não precisa exaurir todas as fontes):
1. Se o IFFar (iffarroupilha.edu.br) já tem publicamente um documento real
   deste mesmo tipo (ex.: um PDI vigente, um regimento, um manual, um
   relatório de gestão) — use-o como referência principal de extensão e
   estrutura.
2. Se não achar no IFFar, procure o mesmo tipo de documento em outros
   Institutos Federais (IFRS, IFC, IFSul, IFPA, IFES, IFMS, IFAL etc.) —
   documentos da Rede Federal seguem padrões muito parecidos entre si.
3. Se não for um documento típico de Instituto Federal, procure em outros
   órgãos públicos brasileiros que produzam algo equivalente (ex.: um
   parecer de auditoria, um manual de fiscalização de contratos, um
   relatório de ouvidoria).
4. Se a demanda for pequena/rotineira (ex.: um parecer técnico pontual, uma
   resposta a uma solicitação simples) e não existir um "tipo de documento"
   formal e longo associado a ela, é válido concluir que a extensão real e
   esperada é curta (poucas páginas) — não infle artificialmente.

Com base no que encontrar, reporte:
- o tipo de documento e uma estimativa REAL de página (não um chute
  redondo arbitrário — baseie-se no precedente encontrado, citando a fonte);
- a estrutura de seções que esse tipo de documento costuma ter, com uma
  estimativa de palavras por seção que, somadas${numCampi > 1 ? " (mais as subseções de campus, se aplicável)" : ""},
  cheguem a aproximadamente ${WORDS_PER_PAGE} palavras por página × o total de
  páginas estimado. IMPORTANTE: cada seção listada será escrita em UMA ÚNICA
  chamada, então nenhuma pode pedir mais de ~2500 palavras — se o documento
  real tiver um capítulo naturalmente maior que isso (comum em documentos de
  100+ páginas, como um PDI), QUEBRE esse capítulo em várias seções na lista
  (ex.: "Planejamento Estratégico — Parte 1: Ensino", "Planejamento
  Estratégico — Parte 2: Pesquisa e Extensão"), cada uma com até ~2500
  palavras, em vez de uma seção única enorme;
${numCampi > 1 ? `- se esse tipo de documento costuma ter uma subseção por campus/unidade regional (esta demanda tem ${numCampi} campi envolvidos) e, se sim, quantas palavras cada uma deve ter (também até ~2500), de modo que a soma total (seções gerais + palavras_por_campus × ${numCampi}) corresponda à extensão real estimada;` : "- inclui_secao_por_campus deve ser false e palavras_por_campus deve ser 0, já que esta demanda não envolve múltiplos campi;"}
- as fontes concretas que encontrou.`;

  try {
    const plan_ = runClaudeStructured<DocumentPlan>(prompt, DOCUMENT_PLAN_SCHEMA, {
      model: "sonnet",
      allowSearch: true,
      maxBudgetUsd: 0.8,
      timeoutMs: 4 * 60 * 1000,
    });

    // Rede de segurança: se a aritmética do modelo não bater com o total de
    // páginas que ele mesmo estimou, escala as seções proporcionalmente em
    // vez de confiar cegamente — a extensão final ainda vem da pesquisa
    // (paginas_alvo), só a distribuição por seção é corrigida.
    const targetWords = plan_.paginas_alvo * WORDS_PER_PAGE;
    const estruturaWords = plan_.estrutura.reduce((sum, s) => sum + s.palavras_alvo, 0);
    const campusWords = plan_.inclui_secao_por_campus ? plan_.palavras_por_campus * numCampi : 0;
    const impliedTotal = estruturaWords + campusWords;
    if (impliedTotal > 0 && targetWords > 0) {
      const ratio = targetWords / impliedTotal;
      if (ratio < 0.6 || ratio > 1.7) {
        console.log(
          `[real-engine] Ajustando distribuição de palavras (implícito ${impliedTotal} vs. alvo ${Math.round(targetWords)}, fator ${ratio.toFixed(2)}).`,
        );
        plan_.estrutura = plan_.estrutura.map((s) => ({
          ...s,
          palavras_alvo: Math.max(200, Math.round(s.palavras_alvo * ratio)),
        }));
        if (plan_.inclui_secao_por_campus) {
          plan_.palavras_por_campus = Math.max(300, Math.round(plan_.palavras_por_campus * ratio));
        }
      }
    }

    // Rede de segurança 2: mesmo pedindo no prompt para não passar de
    // ~2500 palavras por seção, o modelo pode ocasionalmente devolver uma
    // seção maior — quebra em partes aqui em vez de arriscar uma chamada de
    // conteúdo única e muito longa (mais lenta e mais fácil de falhar).
    const MAX_WORDS_PER_SECTION = 2800;
    plan_.estrutura = plan_.estrutura.flatMap((s) => {
      if (s.palavras_alvo <= MAX_WORDS_PER_SECTION) return [s];
      const parts = Math.ceil(s.palavras_alvo / MAX_WORDS_PER_SECTION);
      const wordsPerPart = Math.round(s.palavras_alvo / parts);
      console.log(
        `[real-engine] Seção "${s.titulo}" (${s.palavras_alvo}p) dividida em ${parts} partes de ~${wordsPerPart}p.`,
      );
      return Array.from({ length: parts }, (_, i) => ({
        titulo: `${s.titulo} — Parte ${i + 1} de ${parts}`,
        palavras_alvo: wordsPerPart,
      }));
    });
    if (plan_.inclui_secao_por_campus && plan_.palavras_por_campus > MAX_WORDS_PER_SECTION) {
      plan_.palavras_por_campus = MAX_WORDS_PER_SECTION;
    }

    return plan_;
  } catch (err) {
    console.warn(
      `[real-engine] Pesquisa de extensão/estrutura falhou (${(err as Error).message}); usando plano padrão de parecer curto.`,
    );
    return {
      tipo_documento: plan.nomeRota,
      paginas_alvo: 2,
      estrutura: [
        { titulo: "Contexto", palavras_alvo: 250 },
        { titulo: "Análise Técnica", palavras_alvo: 350 },
        { titulo: "Conclusão e Encaminhamento", palavras_alvo: 200 },
      ],
      inclui_secao_por_campus: false,
      palavras_por_campus: 0,
      fontes: [],
      justificativa: "Pesquisa indisponível — usado um parecer curto padrão como fallback seguro.",
    };
  }
}

// ---------------------------------------------------------------------------
// GERAÇÃO DO DOCUMENTO — genérica: itera a estrutura que a pesquisa
// determinou (não uma lista fixa de "eixos do PDI"), e opcionalmente uma
// subseção por campus, cada uma gerada por uma chamada real (com pesquisa
// na web quando a seção se beneficiar de referência externa). Escrita
// incremental em chapters/ para que uma execução longa seja retomável.
// ---------------------------------------------------------------------------

function generateDocument(
  plan: ContributionPlan,
  docPlan: DocumentPlan,
  competencias: Competencia[] | null,
): string {
  const executingUnit =
    plan.campusChains[0]?.chain.at(-1) ?? plan.systemicUnits.at(-1) ?? plan.reitoria;
  const chainNames = [
    plan.reitoria.nome,
    ...plan.systemicUnits.map((u) => u.nome),
    ...(plan.campusChains.length === 1 ? plan.campusChains[0]!.chain.map((u) => u.nome) : []),
  ];
  const competenciaNote = competenciaFor(executingUnit, competencias);

  console.log(
    `[real-engine] Plano documental: "${docPlan.tipo_documento}" (~${docPlan.paginas_alvo}pg) — ` +
      `${docPlan.estrutura.length} seções${docPlan.inclui_secao_por_campus ? ` + ${plan.campusChains.length} campi` : ""}. ${docPlan.justificativa}`,
  );

  const capa = writeChapterOnce("00-capa", () =>
    [
      `# ${docPlan.tipo_documento}`,
      "## Instituto Federal Farroupilha",
      "",
      `**Demanda:** "${problem}"`,
      `**Ticket:** ${ticketId}`,
      `**Trâmite:** ${chainNames.join(" → ")}${plan.campusChains.length > 1 ? ` → contribuição de ${plan.campusChains.length} campi` : ""}`,
      `**Base legal:** ${plan.baseLegal.join("; ") || "—"}`,
      `**Data de geração:** ${new Date().toLocaleDateString("pt-BR")}`,
      "",
      `> Documento gerado automaticamente pelo motor real do IFFar 3D Town (protótipo ` +
        `demonstrativo). A extensão e a estrutura deste documento (~${docPlan.paginas_alvo} ` +
        `páginas) foram definidas a partir de pesquisa real de precedentes — ${docPlan.justificativa} ` +
        (docPlan.fontes.length > 0 ? `Fontes consultadas: ${docPlan.fontes.slice(0, 5).join(", ")}. ` : "") +
        `O conteúdo em si é sintetizado por IA a partir da estrutura institucional real e de ` +
        `diretrizes públicas — não substitui a coleta de dados/consulta às pessoas e unidades ` +
        `de fato responsáveis, etapa que nenhum sistema automatizado pode substituir.`,
    ].join("\n"),
  );

  const sumario =
    docPlan.estrutura.length > 1 || docPlan.inclui_secao_por_campus
      ? [
          "# Sumário",
          "",
          ...docPlan.estrutura.map((s, i) => `${i + 1}. ${s.titulo}`),
          ...(docPlan.inclui_secao_por_campus ? [`${docPlan.estrutura.length + 1}. Contribuições dos Campi`] : []),
        ].join("\n")
      : "";

  const secoes = docPlan.estrutura.map((secao, i) =>
    safeChapter(slugify(secao.titulo, i), () => {
      const body = runClaude(
        `Escreva a seção "${secao.titulo}" de um documento do tipo "${docPlan.tipo_documento}" do
Instituto Federal Farroupilha (IFFar), motivado pela demanda: "${problem}".

Contexto institucional: tramitou pela cadeia ${chainNames.join(" → ")}, com base legal
${plan.baseLegal.join("; ") || "o regimento interno do IFFar"}. ${competenciaNote}

Esta seção deve ter aproximadamente ${secao.palavras_alvo} palavras. Se a seção se
beneficiar de dados/normas/referências externas verificáveis, pesquise rapidamente
antes de escrever e cite o que encontrar; não invente números específicos que não
consiga confirmar. Produza em Markdown, com subtítulos (##) quando fizer sentido
para uma seção deste tamanho.`,
        {
          model: "sonnet",
          allowSearch: true,
          maxBudgetUsd: budgetForWords(secao.palavras_alvo),
          timeoutMs: timeoutForWords(secao.palavras_alvo),
        },
      );
      return `# ${secao.titulo}\n\n${body}`;
    }),
  );

  const campiContent = docPlan.inclui_secao_por_campus
    ? plan.campusChains.map(({ campus, chain }) => {
        const slug = `campus-${campus.slug}`;
        return safeChapter(slug, () => {
          const unidades = chain.map((u) => u.nome).join(", ") || "estrutura reduzida (Arts. 114-120)";
          const body = runClaude(
            `Escreva a subseção de contribuição do "${campus.nome}" para o documento
"${docPlan.tipo_documento}" do Instituto Federal Farroupilha, motivado pela demanda:
"${problem}". Este campus participa através das unidades: ${unidades}. Descreva a
realidade local plausível desse campus (perfil da região do Rio Grande do Sul onde
ele está, cursos que campi desse porte costumam oferecer, prioridades locais
relevantes ao tema do documento) e proponha contribuições/metas locais concretas.
Produza aproximadamente ${docPlan.palavras_por_campus} palavras em Markdown.`,
            {
              model: "sonnet",
              allowSearch: false,
              maxBudgetUsd: budgetForWords(docPlan.palavras_por_campus),
              timeoutMs: timeoutForWords(docPlan.palavras_por_campus),
            },
          );
          return `## Contribuição — ${campus.nome}\n\n${body}`;
        });
      })
    : [];

  return [
    capa,
    sumario ? `\n\n---\n\n${sumario}` : "",
    "\n\n---\n\n",
    secoes.join("\n\n---\n\n"),
    campiContent.length > 0 ? "\n\n---\n\n# Contribuições dos Campi\n\n" + campiContent.join("\n\n") : "",
  ]
    .filter(Boolean)
    .join("\n");
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

  // Garante que todo título (# / ## / ###) vire seu próprio bloco, mesmo
  // quando o texto gerado (ou a capa montada à mão) não deixa uma linha em
  // branco entre dois títulos consecutivos — sem isso, "# Título\n##
  // Subtítulo" colapsava num h1 só, com o "##" sobrando como texto literal.
  const withIsolatedHeadings = markdown.replace(/^(#{1,3}\s.*)$/gm, "\n$1\n");
  const blocks = withIsolatedHeadings.split(/\n{2,}/);
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

  const docPlanPath = join(ticketDir, "document-plan.json");
  let docPlan: DocumentPlan;
  if (existsSync(docPlanPath)) {
    console.log("[real-engine] Plano documental já pesquisado nesta execução — reaproveitando.");
    docPlan = JSON.parse(readFileSync(docPlanPath, "utf8"));
  } else {
    console.log("[real-engine] Pesquisando extensão/estrutura reais para este tipo de demanda...");
    docPlan = researchDocumentPlan(plan);
    writeFileSync(docPlanPath, JSON.stringify(docPlan, null, 2));
  }

  const markdown = generateDocument(plan, docPlan, competencias);

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
