#!/usr/bin/env node
/**
 * Gera as skills do Hermes (padrão agentskills.io) a partir dos manifestos
 * institucionais em `agent-manifests/`.
 *
 * Por que não uma skill por agente: os 453 manifestos descrevem 453 posições
 * normativas, mas apenas **8 competências operacionais distintas** e 3
 * limitações — a repetição está na estrutura organizacional, não no
 * procedimento. Uma skill por agente produziria 453 arquivos quase idênticos
 * e inutilizáveis no contexto de um agente. Agrupamos por competência: cada
 * skill diz o que sabe fazer, quais unidades a exercem e com que base na
 * Portaria.
 *
 * Uso: node scripts/generate-hermes-skills.mjs [--out hermes-skills] [--check]
 *
 * `--check` não escreve nada e sai com código 1 se o conteúdo em disco estiver
 * defasado — é o que o teste usa para impedir que as skills se descolem dos
 * manifestos.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFESTS = join(ROOT, "agent-manifests");

/** Contrato de execução do produto — precisa sobreviver à virada para skill. */
const EXECUTION_CONTRACT = "execucao-institucional";

export function loadManifests(directory = MANIFESTS) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(directory, name), "utf8")));
}

/** Agrupa os manifestos por competência operacional. */
export function groupBySkill(manifests) {
  const groups = new Map();
  for (const manifest of manifests) {
    for (const skill of manifest.skills) {
      if (!groups.has(skill.id)) {
        groups.set(skill.id, {
          id: skill.id,
          label: skill.label,
          basis: new Set(),
          units: new Map(),
          articles: new Map(),
          agents: 0,
        });
      }
      const group = groups.get(skill.id);
      group.agents += 1;
      group.basis.add(skill.basis);
      group.units.set(manifest.unit.code, manifest.unit.name);
      for (const reference of manifest.normativeSource.articleReferences ?? []) {
        group.articles.set(reference.article, reference.title);
      }
    }
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function frontMatter(fields) {
  const lines = Object.entries(fields).map(([key, value]) =>
    typeof value === "string" && value.includes("\n")
      ? `${key}: >-\n  ${value.trim().split("\n").join("\n  ")}`
      : `${key}: ${value}`,
  );
  return ["---", ...lines, "---"].join("\n");
}

function unitTable(units, limit = 12) {
  const rows = [...units.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const shown = rows.slice(0, limit);
  const table = [
    "| Código | Unidade |",
    "|---|---|",
    ...shown.map(([code, name]) => `| \`${code}\` | ${name} |`),
  ].join("\n");
  const rest = rows.length - shown.length;
  return rest > 0 ? `${table}\n\n…e mais ${rest} unidades com a mesma competência.` : table;
}

export function renderSkill(group, source) {
  const articles = [...group.articles.entries()].sort(([a], [b]) => a - b);
  return `${frontMatter({
    name: `iffar-${group.id}`,
    description: `${group.label} no Instituto Federal Farroupilha, com base na ${source.title}. Use quando a demanda envolver uma unidade que exerça esta competência.`,
    license: "MIT",
  })}

# ${group.label}

Competência operacional exercida por **${group.units.size} unidades** do IFFar
(${group.agents} posições normativas), derivada da
**${source.title}** de ${source.date}.

## Quando usar

Quando a demanda institucional cair sobre uma das unidades abaixo e exigir
esta competência. Se a unidade responsável **não** estiver nesta lista, esta
skill não se aplica — procure a competência certa em vez de forçar esta.

${unitTable(group.units)}

## Base normativa

${articles.length ? articles.map(([article, title]) => `- **Art. ${article}** — ${title}`).join("\n") : "- Sem artigo específico: competência derivada do contrato de execução."}

Fundamento declarado nos manifestos: ${[...group.basis].map((item) => `*${item}*`).join("; ")}.

## Como executar

O trabalho roda pelo runbook do agente da unidade:

\`\`\`bash
node scripts/execute-agent-runbook.mjs \\
  --agent <agentId> --event-file <eventFile> --brief <briefFile>
\`\`\`

Cada execução produz um evento observado e um registro de handoff. Os tipos de
evento aceitos são \`agent.work_completed\`, \`agent.handoff_observed\` e
\`agent.runbook_completed\` — e **só** quando houve trabalho real: planejar ou
declarar intenção não gera evento.

## Limites (não negociáveis)

${source.limitations.map((item) => `- ${item}`).join("\n")}

Ver a skill **\`iffar-${EXECUTION_CONTRACT}\`** para o contrato de entrega —
checkpoint humano e verificação de artefatos — que vale para toda execução.
`;
}

export function renderExecutionContract(manifests, source) {
  const units = new Set(manifests.map((manifest) => manifest.unit.rootCode));
  return `${frontMatter({
    name: `iffar-${EXECUTION_CONTRACT}`,
    description:
      "Contrato de execução institucional do IFFar: rota normativa, checkpoint humano e verificação de artefatos antes de declarar entrega. Use SEMPRE que executar qualquer demanda institucional do IFFar.",
    license: "MIT",
  })}

# Contrato de execução institucional do IFFar

Vale para **toda** demanda executada sobre a rede institucional do IFFar —
${manifests.length} posições normativas em ${units.size} unidades raiz, derivadas da
**${source.title}** de ${source.date}.

## A regra que ordena tudo

**Nada existe fora do organograma.** A rota de uma demanda sai da estrutura
normativa: se nenhuma unidade da Portaria detém a competência pedida, a
demanda entra em **triagem institucional** e recebe entrega documentada
padrão — não se inventa uma unidade para acomodá-la.

## Fluxo

\`\`\`
Solicitação → rota normativa → checkpoint humano? → despacho CLI
                                      ↓ sim
                              aprovação explícita
                                      ↓
        eventos persistidos (JSONL/SSE) → verificação de artefatos → entrega
\`\`\`

## Os quatro portões, em ordem

1. **Rota normativa.** A demanda é mapeada para unidades reais e seus agentes.
   Sem regra conhecida, é triagem — não improviso.
2. **Checkpoint humano.** Quando a rota exige, a execução fica em
   \`awaiting_human_approval\` e **não avança** sem aprovação explícita.
3. **Execução com evidência.** Cada run persiste eventos e trabalha num
   diretório próprio. Evento só se houve trabalho real.
4. **Verificação antes da entrega.** A entrega **não** é declarada por alegação
   do executor: cada arquivo é registrado com **SHA-256** e conferido contra o
   perfil de artefatos da demanda. Enquanto a integridade for \`unverified\`,
   não há entrega.

## O que nunca fazer

${source.limitations.map((item) => `- ${item}`).join("\n")}
- Não declarar conclusão sem criar os arquivos e rodar as validações.
- Não usar nomes de pessoas como dados institucionais.
- Não enviar comunicação, publicar ou praticar ato administrativo, financeiro,
  contratual ou externo sem aprovação humana explícita.

## Índice obrigatório

Toda execução registra em \`result.md\`: arquivos produzidos, comandos de
validação usados, limitações e hashes quando disponíveis. Sem esse índice, a
execução está incompleta, mesmo que os arquivos existam.
`;
}

export function buildSkills(manifests) {
  const first = manifests[0];
  const source = {
    title: first.normativeSource.title,
    date: first.normativeSource.date,
    limitations: [...new Set(manifests.flatMap((manifest) => manifest.limitations))],
  };
  const skills = groupBySkill(manifests).map((group) => ({
    name: `iffar-${group.id}`,
    content: renderSkill(group, source),
  }));
  skills.push({
    name: `iffar-${EXECUTION_CONTRACT}`,
    content: renderExecutionContract(manifests, source),
  });
  return skills;
}

function main(argv) {
  const outIndex = argv.indexOf("--out");
  const outDir = resolve(ROOT, outIndex === -1 ? "hermes-skills" : argv[outIndex + 1]);
  const check = argv.includes("--check");

  const skills = buildSkills(loadManifests());

  if (check) {
    const stale = skills.filter((skill) => {
      const path = join(outDir, skill.name, "SKILL.md");
      return !existsSync(path) || readFileSync(path, "utf8") !== skill.content;
    });
    if (stale.length) {
      console.error(`skills defasadas (${stale.length}): ${stale.map((s) => s.name).join(", ")}`);
      console.error("rode: npm run generate:skills");
      return 1;
    }
    console.log(`skills em dia (${skills.length})`);
    return 0;
  }

  if (existsSync(outDir)) rmSync(outDir, { recursive: true });
  for (const skill of skills) {
    const directory = join(outDir, skill.name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "SKILL.md"), skill.content, "utf8");
  }
  console.log(`${skills.length} skills geradas em ${outDir}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
