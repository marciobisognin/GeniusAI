import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, relative, resolve, sep } from 'node:path'

export const RUN_STATES = new Set(['prepared', 'awaiting_human_approval', 'dispatched', 'running', 'verification_pending', 'completed_verified', 'failed', 'cancelled'])
const SENSITIVE_TERMS = ['licita', 'contrat', 'orçamento', 'orcamento', 'pagamento', 'financeir', 'publicação', 'publicacao', 'comunicação institucional', 'comunicacao institucional', 'decisão administrativa', 'decisao administrativa', 'enviar e-mail', 'enviar email']
const ALLOWED_ARTIFACT_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json', '.html', '.pdf', '.docx', '.xlsx', '.zip', '.png', '.jpg', '.jpeg'])

export function normalize(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function displayPosition(title) {
  return !title || title.trim() === '-' ? 'Cargo não especificado na fonte' : title
}

export async function loadInstitutionalData(appRoot) {
  const [structureText, routingText, catalogText] = await Promise.all([
    readFile(resolve(appRoot, 'data/institutional-structure.json'), 'utf8'),
    readFile(resolve(appRoot, 'data/routing.json'), 'utf8'),
    readFile(resolve(appRoot, 'data/agent-catalog.json'), 'utf8'),
  ])
  return { structure: JSON.parse(structureText), routing: JSON.parse(routingText), catalog: JSON.parse(catalogText) }
}

function firstUnitByCode(units, code) { return units.find((unit) => unit.code === code) ?? null }

function campusFromTask(roots, task) {
  const text = normalize(task)
  return roots.find((root) => {
    if (root.code === '1.1') return false
    const name = normalize(root.name.replace(/^campus\s+/i, ''))
    return name.length > 2 && text.includes(name)
  }) ?? null
}

function selectRule(routing, task) {
  const text = normalize(task)
  let best = null
  let score = 0
  for (const rule of routing.rules ?? []) {
    const matches = (rule.keywords ?? []).filter((keyword) => text.includes(normalize(keyword))).length
    const candidate = matches * Number(rule.prioridade ?? 1)
    if (candidate > score) { best = rule; score = candidate }
  }
  return best
}

function localCampusUnits(units, campus, names) {
  if (!campus || !names?.length) return []
  const descendants = units.filter((unit) => unit.root_code === campus.code)
  return names.flatMap((name) => {
    const requested = normalize(name)
    const singular = requested.replace(/coes\b/g, 'cao').replace(/s\b/g, '')
    const exact = descendants.filter((unit) => normalize(unit.name) === requested)
    return exact.length ? exact : descendants.filter((unit) => normalize(unit.name).includes(requested) || normalize(unit.name).includes(singular))
  })
}

function compactAgent(agent) {
  return { id: agent.id, displayName: agent.displayName, roleType: agent.roleType, skills: agent.skills, runbook: agent.runbook, normativeSource: agent.normativeSource }
}

function agentsForUnit(catalog, nodeId) { return (catalog?.agents ?? []).filter((agent) => agent.unit.nodeId === nodeId).map(compactAgent) }

export function artifactProfileForTask(task, course = '') {
  const text = normalize(task)
  const courseName = typeof course === 'string' ? course.trim().replace(/\s+/g, ' ') : ''
  if (['ppc', 'projeto pedagogico', 'projeto pedagógico', 'curriculo', 'currículo'].some((term) => text.includes(normalize(term)))) {
    return {
      id: 'ppc-complete', label: 'PPC completo', course: courseName || null, requiresCourseIdentification: !courseName,
      requiredGroups: [
        { id: 'ppc-pdf', label: 'Documento de PPC em PDF', extensions: ['.pdf'], format: 'pdf' },
        { id: 'audit-report', label: 'Relatório de consistência/auditoria', extensions: ['.md', '.html', '.pdf'], nameTerms: ['relatorio', 'relatório', 'auditoria', 'consistencia', 'consistência'], format: 'report' },
        { id: 'curricular-sheet', label: 'Planilha curricular', extensions: ['.xlsx', '.csv'], nameTerms: ['matriz', 'curricular', 'planilha', 'componentes'], format: 'spreadsheet' },
      ],
    }
  }
  return { id: 'standard-delivery', label: 'Entrega documentada', course: null, requiresCourseIdentification: false, requiredGroups: [{ id: 'result-index', label: 'Índice de resultado', extensions: ['.md'], nameTerms: ['result'], format: 'report' }] }
}

export function resolveRoute({ structure, routing, catalog = null }, task, { course = '' } = {}) {
  const campus = campusFromTask(structure.roots, task)
  const rule = selectRule(routing, task)
  const systemic = (rule?.cadeia_sistemica ?? routing.default_route?.cadeia_sistemica ?? []).map((code) => firstUnitByCode(structure.units, code)).filter(Boolean)
  const local = localCampusUnits(structure.units, campus, rule?.cadeia_campus)
  const unique = new Map([...systemic, ...local].map((unit) => [unit.node_id, unit]))
  const actors = [...unique.values()].map((unit) => ({
    nodeId: unit.node_id, code: unit.code, name: unit.name, rootCode: unit.root_code,
    positions: (unit.positions ?? []).map((position) => ({ title: displayPosition(position.title), commission: position.commission })),
    agents: agentsForUnit(catalog, unit.node_id), evidence: { page: unit.page, tableRow: unit.table_row },
  }))
  const handoffs = actors.slice(1).map((actor, index) => ({ id: `handoff:${index + 1}`, fromUnitNodeId: actors[index].nodeId, toUnitNodeId: actor.nodeId, fromAgentId: actors[index].agents[0]?.id ?? null, toAgentId: actor.agents[0]?.id ?? null, state: 'planned' }))
  const sensitive = SENSITIVE_TERMS.some((term) => normalize(task).includes(normalize(term)))
  return {
    theme: rule?.tema ?? routing.default_route?.nome ?? 'triagem institucional', campus: campus ? { code: campus.code, name: campus.name } : null,
    baseLegal: rule?.base_legal ?? routing.default_route?.base_legal ?? [], requiresHumanApproval: sensitive,
    approvalReason: sensitive ? 'A demanda contém efeito administrativo, financeiro, contratual, externo ou de comunicação.' : null,
    actors, handoffs, artifactProfile: artifactProfileForTask(task, course),
    source: { title: structure.source.title, date: structure.source.date, roots: structure.roots.length, units: structure.units.length, positions: structure.units.reduce((total, unit) => total + (unit.positions?.length ?? 0), 0), agents: catalog?.counts?.agents ?? 0 },
  }
}

export function buildPrompt({ task, route, runId, outputDir, workDirectory }) {
  const actors = route.actors.map((actor) => `- ${actor.name} (${actor.code})\n  Agentes: ${actor.agents.map((agent) => `${agent.displayName} [${agent.id}; runbook=${agent.runbook?.id ?? 'não catalogado'}]`).join('; ') || 'sem posição catalogada'}`).join('\n')
  const evidence = route.baseLegal.length ? route.baseLegal.join('; ') : 'Triagem institucional sem regra específica.'
  const required = route.artifactProfile.requiredGroups.map((group) => `- ${group.label}: ${group.extensions.join(', ')}`).join('\n')
  return `# Execução real — IFFar Pixel Art\n\n## Demanda\n${task}\n\n## Rota institucional\nTema: ${route.theme}\nCampus: ${route.campus?.name ?? 'não identificado'}\nCurso explicitamente identificado: ${route.artifactProfile.course ?? 'NÃO INFORMADO'}\nBase normativa: ${evidence}\nUnidades e agentes institucionais:\n${actors}\n\n## Contrato de execução\n- Trabalhe em: ${workDirectory}\n- Produza arquivos reais em: ${outputDir}\n- Não alegue conclusão sem criar os arquivos e rodar validações adequadas.\n- Registre um índice em ${outputDir}/result.md com arquivos produzidos, comandos de validação, limitações e hashes quando disponíveis.\n- Para evento de agente, acrescente JSON por linha em ${outputDir}/observed-events.jsonl com actorId, runbookId idêntico ao catálogo, mensagem objetiva e ts ISO-8601. Tipos aceitos: agent.work_completed, agent.handoff_observed e agent.runbook_completed.\n- Não registre evento de trabalho apenas por planejamento ou intenção. Eventos enviados pelo executor são rastros do processo local, não substituem revisão humana.\n- Não envie comunicações, publique, realize ato administrativo, financeiro, contratual ou externo sem aprovação humana explícita.\n- Não use nomes de pessoas como dados institucionais.\n\n## Perfil de artefatos: ${route.artifactProfile.label}\n${required}\n${route.artifactProfile.requiresCourseIdentification ? '\nBLOQUEIO DE CONCLUSÃO: informe o nome oficial do curso no campo específico antes de um PPC poder ser concluído.\n' : ''}\n## Correlação\nRun ID: ${runId}\n`
}

export function isWithin(candidate, root) {
  const rel = relative(resolve(root), resolve(candidate))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.includes(`..${sep}`))
}

async function nearestExistingAncestor(candidate) {
  let current = candidate
  while (true) {
    try { await stat(current); return current } catch (cause) {
      if (current === dirname(current)) throw cause
      current = dirname(current)
    }
  }
}

export async function ensureContainedWorkDirectory(requested, allowedRoots, defaultDirectory) {
  const candidate = resolve(requested || defaultDirectory)
  const canonicalRoots = await Promise.all(allowedRoots.map(async (root) => realpath(resolve(root))))
  const ancestor = await nearestExistingAncestor(candidate)
  const canonicalAncestor = await realpath(ancestor)
  if (!canonicalRoots.some((root) => isWithin(canonicalAncestor, root))) throw new Error('Diretório de trabalho fora das raízes autorizadas pelo servidor.')
  await mkdir(candidate, { recursive: true })
  const canonicalCandidate = await realpath(candidate)
  if (!canonicalRoots.some((root) => isWithin(canonicalCandidate, root))) throw new Error('Diretório de trabalho resolve fora das raízes autorizadas pelo servidor.')
  return canonicalCandidate
}

export async function writeRunFile(runDir, run) {
  await mkdir(runDir, { recursive: true })
  await writeFile(resolve(runDir, 'run.json'), JSON.stringify(run, null, 2), 'utf8')
}

async function collectFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    const path = resolve(current, entry.name)
    if (entry.isDirectory()) results.push(...await collectFiles(root, path))
    else if (entry.isFile()) results.push(path)
  }
  return results
}

function validateFormat(extension, content) {
  const utf8 = content.toString('utf8')
  if (extension === '.pdf') return { valid: content.length >= 1024 && content.subarray(0, 5).toString('ascii') === '%PDF-' && content.subarray(Math.max(0, content.length - 2048)).includes(Buffer.from('%%EOF')), reason: 'PDF deve conter cabeçalho, EOF e conteúdo mínimo.' }
  if (extension === '.xlsx') return { valid: content.length >= 512 && content.subarray(0, 4).equals(Buffer.from('PK\x03\x04')) && content.includes(Buffer.from('xl/workbook.xml')), reason: 'XLSX deve ser pacote OOXML com workbook.' }
  if (extension === '.docx') return { valid: content.length >= 512 && content.subarray(0, 4).equals(Buffer.from('PK\x03\x04')) && content.includes(Buffer.from('word/document.xml')), reason: 'DOCX deve ser pacote OOXML com documento.' }
  if (extension === '.csv') return { valid: utf8.length >= 80 && /[,;]/.test(utf8) && utf8.trim().split('\n').length >= 2, reason: 'CSV deve ter cabeçalho, linhas e delimitador.' }
  if (extension === '.json') { try { JSON.parse(utf8); return { valid: true, reason: null } } catch { return { valid: false, reason: 'JSON inválido.' } } }
  if (['.md', '.txt', '.html'].includes(extension)) return { valid: utf8.trim().length >= 80 && /[\p{L}]{8}/u.test(utf8), reason: 'Documento textual deve conter conteúdo material mínimo.' }
  return { valid: true, reason: null }
}

export async function verifyArtifacts(outputDir) {
  const files = await collectFiles(outputDir)
  const artifacts = []
  for (const path of files) {
    const info = await stat(path)
    const extension = extname(path).toLowerCase()
    if (info.size === 0 || !ALLOWED_ARTIFACT_EXTENSIONS.has(extension) || basename(path) === 'observed-events.jsonl') continue
    const content = await readFile(path)
    artifacts.push({ id: createHash('sha256').update(content).digest('hex').slice(0, 16), name: basename(path), relativePath: relative(outputDir, path), bytes: info.size, sha256: createHash('sha256').update(content).digest('hex'), format: validateFormat(extension, content) })
  }
  return artifacts
}

function formatMatches(group, artifact) {
  if (!artifact.format?.valid) return false
  if (group.format === 'pdf') return extname(artifact.name).toLowerCase() === '.pdf'
  if (group.format === 'spreadsheet') return ['.xlsx', '.csv'].includes(extname(artifact.name).toLowerCase())
  if (group.format === 'report') return ['.md', '.html', '.pdf'].includes(extname(artifact.name).toLowerCase())
  return true
}

export function evaluateArtifactProfile(artifacts, profile) {
  const groups = profile.requiredGroups.map((group) => {
    const present = artifacts.some((artifact) => {
      const extensionOk = group.extensions.includes(extname(artifact.name).toLowerCase())
      const termsOk = !group.nameTerms || group.nameTerms.some((term) => normalize(artifact.name).includes(normalize(term)))
      return extensionOk && termsOk && formatMatches(group, artifact)
    })
    return { ...group, present }
  })
  const courseIdentified = !profile.requiresCourseIdentification
  return { profileId: profile.id, courseIdentified, passed: courseIdentified && groups.every((group) => group.present), groups }
}

export function makeRun({ id, task, executorId, route, runDir, workDirectory }) {
  const now = new Date().toISOString()
  return { id, task, executorId, createdAt: now, updatedAt: now, state: route.requiresHumanApproval ? 'awaiting_human_approval' : 'prepared', phase: 'plan', liveness: 'waiting', gate: route.requiresHumanApproval ? 'pending' : 'indeterminate', completion: 'not_ready', delivery: 'none', integrity: 'unverified', route, artifactProfile: route.artifactProfile, handoffs: route.handoffs, runDir, workDirectory, outputDir: resolve(runDir, 'output'), artifacts: [] }
}
