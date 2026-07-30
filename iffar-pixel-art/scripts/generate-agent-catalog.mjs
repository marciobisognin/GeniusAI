import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dataRoot = resolve(appRoot, 'data')
const manifestRoot = resolve(appRoot, 'agent-manifests')
const structure = JSON.parse(await readFile(resolve(dataRoot, 'institutional-structure.json'), 'utf8'))

const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const slugify = (value = '') => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cargo-nao-especificado'
const displayTitle = (title) => !title || title.trim() === '-' ? 'Cargo não especificado na fonte' : title

function operationalSkills(unit, title) {
  const reference = `${normalize(unit.name)} ${normalize(title)}`
  const skills = [
    { id: 'evidencia-rastreavel', label: 'Registrar evidências e handoffs rastreáveis', provenance: 'operational-derived', basis: 'Contrato de execução do IFFar Pixel Art' },
    { id: 'revisao-normativa', label: 'Conferir a aderência à fonte normativa disponível', provenance: 'operational-derived', basis: 'Portaria nº 876/2026-GRE' },
  ]
  const domains = [
    [['ensino', 'curso', 'pedagog', 'registro academ'], ['ensino-e-ppc', 'Preparar insumos acadêmicos e de PPC']],
    [['pesquisa', 'inovacao', 'pós-graduação', 'pos-graduacao'], ['pesquisa-e-inovacao', 'Organizar evidências de pesquisa, inovação e pós-graduação']],
    [['extensao', 'estagio', 'produção', 'producao'], ['extensao-e-producao', 'Organizar evidências de extensão, estágio e produção']],
    [['administra', 'licita', 'contrato', 'orçamento', 'orcamento', 'financeir', 'patrim'], ['administracao-publica', 'Organizar instrução administrativa e controles de processo']],
    [['tecnologia', 'informação', 'informacao', 'sistema', 'comunica'], ['informacao-e-sistemas', 'Documentar requisitos e evidências de informação e sistemas']],
    [['planejamento', 'avaliacao', 'avaliação', 'documental', 'gestão de pessoas', 'gestao de pessoas'], ['planejamento-e-governanca', 'Organizar evidências de planejamento, avaliação e governança']],
  ]
  for (const [keywords, [id, label]] of domains) {
    if (keywords.some((keyword) => reference.includes(keyword))) skills.push({ id, label, provenance: 'operational-derived', basis: `Termos da Uorg/cargo: ${unit.name}` })
  }
  return skills
}

function articleReferences(unit) {
  const tokens = normalize(unit.name).split(/[^a-z0-9]+/).filter((token) => token.length >= 7).slice(0, 3)
  const matches = structure.articles
    .filter((article) => tokens.some((token) => normalize(`${article.title} ${article.text}`).includes(token)))
    .slice(0, 3)
    .map((article) => ({ article: article.article, title: article.title }))
  return matches
}

const agents = []
for (const unit of structure.units) {
  for (const [positionIndex, position] of (unit.positions ?? []).entries()) {
    const title = displayTitle(position.title)
    const id = `agent:${unit.node_id}:${positionIndex + 1}:${slugify(title)}`
    const agent = {
      id,
      schema: 'iffar-pixel-art-agent/1.0',
      displayName: title,
      roleType: position.commission?.startsWith('CD') ? 'CD' : position.commission?.startsWith('FG') ? 'FG' : position.commission?.startsWith('FCC') ? 'FCC' : title === 'PRESIDENTE' ? 'Presidente' : 'Membro',
      unit: { nodeId: unit.node_id, code: unit.code, name: unit.name, rootCode: unit.root_code, parentNodeId: unit.parent_node_id ?? null },
      normativeSource: {
        title: structure.source.title,
        date: structure.source.date,
        unitPage: unit.page,
        unitTableRow: unit.table_row,
        articleReferences: articleReferences(unit),
        titleFromSource: position.title,
      },
      skills: operationalSkills(unit, title),
      runbook: {
        id: `runbook:${slugify(id)}`,
        command: 'node scripts/execute-agent-runbook.mjs --agent {agentId} --event-file {eventFile} --brief {briefFile}',
        inputs: ['briefFile', 'eventFile'],
        outputs: ['observed agent event', 'handoff record'],
        source: 'operational-derived',
      },
      limitations: [
        'Não representa pessoa física nem ocupante de cargo.',
        'Não produz ato administrativo, publicação ou comunicação externa sem aprovação humana.',
        'Competências operacionais são derivadas para orquestração e não substituem atribuições legais específicas.',
      ],
    }
    agents.push(agent)
  }
}

await rm(manifestRoot, { recursive: true, force: true })
await mkdir(manifestRoot, { recursive: true })
for (const agent of agents) {
  const name = `${String(agent.unit.nodeId).replaceAll('.', '_')}--${slugify(agent.displayName)}.json`
  await writeFile(resolve(manifestRoot, name), `${JSON.stringify(agent, null, 2)}\n`, 'utf8')
}

const catalog = {
  contract: 'iffar-pixel-art-agent-catalog/1.0',
  generatedAt: new Date().toISOString(),
  source: structure.source,
  counts: {
    roots: structure.roots.length,
    units: structure.units.length,
    positions: structure.units.reduce((count, unit) => count + (unit.positions?.length ?? 0), 0),
    agents: agents.length,
  },
  roots: structure.roots,
  agents,
}
await writeFile(resolve(dataRoot, 'agent-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ generated: catalog.counts, manifests: manifestRoot }))
