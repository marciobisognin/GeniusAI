import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  artifactProfileForTask,
  displayPosition,
  ensureContainedWorkDirectory,
  evaluateArtifactProfile,
  isWithin,
  resolveRoute,
  verifyArtifacts,
} from '../core.mjs'

const fixture = {
  structure: {
    source: { title: 'Portaria', date: '2026-07-03' },
    roots: [{ code: '1.1', name: 'Reitoria' }, { code: '1.9', name: 'Campus Frederico Westphalen' }],
    units: [
      { node_id: 'n-rei', code: '1.1.4.3', name: 'Chefia de Gabinete', root_code: '1.1', positions: [] },
      { node_id: 'n-proad', code: '1.1.15', name: 'Pró-Reitoria de Administração', root_code: '1.1', positions: [{ title: '-', commission: 'CD-01' }] },
      { node_id: 'n-proen', code: '1.1.16', name: 'Pró-Reitoria de Ensino', root_code: '1.1', positions: [{ title: 'Pró-Reitor(a)', commission: 'CD-02' }] },
      { node_id: 'n-campus', code: '1.9.3', name: 'Diretoria de Administração', root_code: '1.9', positions: [] },
      { node_id: 'n-course', code: '1.9.3.5', name: 'Coordenação de Curso Técnico', root_code: '1.9', positions: [{ title: 'Coordenador(a)', commission: 'FCC' }] },
    ],
  },
  routing: {
    default_route: { nome: 'triagem', cadeia_sistemica: ['1.1.4.3'], base_legal: ['Art. 15'] },
    rules: [
      { tema: 'contratos', keywords: ['contrato'], prioridade: 10, cadeia_sistemica: ['1.1.15'], cadeia_campus: ['Diretoria de Administração'], base_legal: ['Art. 57'] },
      { tema: 'ppc', keywords: ['ppc'], prioridade: 10, cadeia_sistemica: ['1.1.16'], cadeia_campus: ['Coordenações de Curso'], base_legal: ['Art. 64'] },
    ],
  },
  catalog: { counts: { agents: 3 }, agents: [
    { id: 'agent:n-proad:1', displayName: 'Cargo não especificado na fonte', roleType: 'CD', unit: { nodeId: 'n-proad' }, skills: [], runbook: { id: 'runbook:agent:n-proad:1' }, normativeSource: {} },
    { id: 'agent:n-proen:1', displayName: 'Pró-Reitor(a)', roleType: 'CD', unit: { nodeId: 'n-proen' }, skills: [], runbook: { id: 'runbook:agent:n-proen:1' }, normativeSource: {} },
    { id: 'agent:n-course:1', displayName: 'Coordenador(a)', roleType: 'FCC', unit: { nodeId: 'n-course' }, skills: [], runbook: { id: 'runbook:agent:n-course:1' }, normativeSource: {} },
  ] },
}

const validArtifacts = [
  { name: 'PPC.pdf', format: { valid: true } },
  { name: 'relatorio-auditoria.md', format: { valid: true } },
  { name: 'matriz-curricular.xlsx', format: { valid: true } },
]

test('rota demanda contratual para PROAD, campus e agente catalogado', () => {
  const route = resolveRoute(fixture, 'Elaborar nota sobre contrato no Campus Frederico Westphalen')
  assert.equal(route.theme, 'contratos')
  assert.equal(route.campus.code, '1.9')
  assert.equal(route.requiresHumanApproval, true)
  assert.deepEqual(route.actors.map((actor) => actor.nodeId), ['n-proad', 'n-campus'])
  assert.equal(route.actors[0].positions[0].title, 'Cargo não especificado na fonte')
  assert.equal(route.actors[0].agents[0].id, 'agent:n-proad:1')
})

test('qualquer solicitação sem regra recebe triagem e entrega padrão', () => {
  const route = resolveRoute(fixture, 'Organizar uma oficina interdisciplinar com a comunidade')
  assert.equal(route.theme, 'triagem')
  assert.equal(route.artifactProfile.id, 'standard-delivery')
  assert.equal(route.requiresHumanApproval, false)
})

test('rota PPC inclui coordenação e bloqueia conclusão sem curso explícito', () => {
  const unqualified = resolveRoute(fixture, 'Criar PPC no Campus Frederico Westphalen')
  assert.equal(unqualified.actors.at(-1).nodeId, 'n-course')
  assert.equal(unqualified.artifactProfile.requiresCourseIdentification, true)
  assert.equal(evaluateArtifactProfile(validArtifacts, unqualified.artifactProfile).passed, false)
  const qualified = resolveRoute(fixture, 'Criar PPC no Campus Frederico Westphalen', { course: 'Curso Técnico em Informática' })
  assert.equal(qualified.artifactProfile.requiresCourseIdentification, false)
  assert.equal(evaluateArtifactProfile(validArtifacts, qualified.artifactProfile).passed, true)
})

test('PPC rejeita texto renomeado como PDF e XLSX', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'iffar-ppc-invalid-'))
  await writeFile(resolve(root, 'PPC.pdf'), 'isto não é um PDF')
  await writeFile(resolve(root, 'relatorio-auditoria.md'), '# Relatório\n\n' + 'conteúdo material '.repeat(8))
  await writeFile(resolve(root, 'matriz-curricular.xlsx'), 'isto não é uma planilha')
  const artifacts = await verifyArtifacts(root)
  const profile = artifactProfileForTask('PPC', 'Curso Técnico em Informática')
  assert.equal(evaluateArtifactProfile(artifacts, profile).passed, false)
})

test('PPC reconhece assinaturas estruturais mínimas de PDF e XLSX', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'iffar-ppc-valid-'))
  await writeFile(resolve(root, 'PPC.pdf'), Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1200, 'A'), Buffer.from('\n%%EOF')]))
  await writeFile(resolve(root, 'relatorio-auditoria.md'), '# Relatório\n\n' + 'conteúdo material '.repeat(8))
  await writeFile(resolve(root, 'matriz-curricular.xlsx'), Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.alloc(600), Buffer.from('xl/workbook.xml xl/worksheets/sheet1.xml')]))
  const artifacts = await verifyArtifacts(root)
  const profile = artifactProfileForTask('PPC', 'Curso Técnico em Informática')
  assert.equal(evaluateArtifactProfile(artifacts, profile).passed, true)
})

test('contenção rejeita caminho externo e symlink que escapa da raiz', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'iffar-root-'))
  const outside = await mkdtemp(resolve(tmpdir(), 'iffar-outside-'))
  await symlink(outside, resolve(root, 'escape'))
  assert.equal(isWithin(resolve(root, 'nested'), root), true)
  assert.equal(isWithin(resolve(root, '..', 'outside'), root), false)
  await assert.rejects(() => ensureContainedWorkDirectory(resolve(root, '..', 'outside'), [root], root))
  await assert.rejects(() => ensureContainedWorkDirectory(resolve(root, 'escape', 'child'), [root], root))
})

test('artefatos vazios e extensões não permitidas não passam pela verificação', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'iffar-artifacts-'))
  await mkdir(resolve(root, 'nested'))
  await writeFile(resolve(root, 'empty.md'), '')
  await writeFile(resolve(root, 'nested', 'result.md'), '# Resultado\n\n' + 'Evidência documentada '.repeat(8))
  await writeFile(resolve(root, 'nested', 'executor.bin'), 'not deliverable')
  const artifacts = await verifyArtifacts(root)
  assert.equal(artifacts.length, 1)
  assert.equal(artifacts[0].format.valid, true)
})

test('rótulo de cargo não inventa dado ausente', () => {
  assert.equal(displayPosition('-'), 'Cargo não especificado na fonte')
  assert.equal(displayPosition('Coordenador'), 'Coordenador')
})
