import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import {
  buildPrompt,
  ensureContainedWorkDirectory,
  evaluateArtifactProfile,
  isWithin,
  loadInstitutionalData,
  makeRun,
  resolveRoute,
  verifyArtifacts,
  writeRunFile,
} from './core.mjs'

const APP_ROOT = resolve(process.cwd())
const PORT = Number(process.env.IFFAR_PIXEL_ART_PORT ?? 4310)
const HOST = process.env.IFFAR_PIXEL_ART_HOST ?? '127.0.0.1'
const DATA_ROOT = resolve(APP_ROOT, '.data/runs')
const DEFAULT_WORK_ROOT = resolve(APP_ROOT, 'workspace')
const APPROVAL_TOKEN = process.env.IFFAR_APPROVAL_TOKEN ?? ''
const ALLOWED_WORK_ROOTS = (process.env.IFFAR_ALLOWED_WORK_ROOTS ?? DEFAULT_WORK_ROOT)
  .split(process.platform === 'win32' ? ';' : ':')
  .filter(Boolean)
  .map((item) => resolve(item))

const runs = new Map()
const subscribers = new Map()
const institutional = await loadInstitutionalData(APP_ROOT)
const executorPath = process.env.IFFAR_EXECUTORS_PATH ?? resolve(APP_ROOT, 'config/executors.json')
const fallbackExecutorPath = resolve(APP_ROOT, 'config/executors.example.json')
const executorConfig = JSON.parse(await readFile(existsSync(executorPath) ? executorPath : fallbackExecutorPath, 'utf8'))
const executors = new Map(executorConfig.executors.map((executor) => [executor.id, executor]))

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}

function error(res, status, message) {
  send(res, status, { error: message })
}

async function body(req) {
  const parts = []
  for await (const chunk of req) {
    parts.push(chunk)
    if (Buffer.concat(parts).length > 1_000_000) throw new Error('Corpo de requisição excede 1 MB.')
  }
  if (!parts.length) return {}
  return JSON.parse(Buffer.concat(parts).toString('utf8'))
}

function eventPath(run) {
  return resolve(run.runDir, 'events.jsonl')
}

async function emit(run, type, message, patch = {}) {
  Object.assign(run, patch, { updatedAt: new Date().toISOString() })
  const event = { id: randomUUID(), runId: run.id, type, message, ts: run.updatedAt, state: run.state, ...patch }
  await appendFile(eventPath(run), `${JSON.stringify(event)}\n`, 'utf8')
  await writeRunFile(run.runDir, run)
  for (const res of subscribers.get(run.id) ?? []) {
    res.write(`event: run\ndata: ${JSON.stringify(event)}\n\n`)
  }
  return event
}

async function historicalEvents(run) {
  try {
    const text = await readFile(eventPath(run), 'utf8')
    return text.split('\n').filter(Boolean).map((line) => JSON.parse(line))
  } catch {
    return []
  }
}

async function ingestObservedAgentEvents(run) {
  const sourcePath = resolve(run.outputDir, 'observed-events.jsonl')
  let text = ''
  try { text = await readFile(sourcePath, 'utf8') } catch { return 0 }
  const routeAgents = run.route.actors.flatMap((actor) => actor.agents)
  const allowedActors = new Set(routeAgents.map((agent) => agent.id))
  const expectedRunbookByAgent = new Map(routeAgents.map((agent) => [agent.id, agent.runbook?.id ?? null]))
  const seen = new Set(run.observedEventKeys ?? [])
  let accepted = 0
  for (const line of text.split('\n').filter(Boolean)) {
    const key = createHash('sha256').update(line).digest('hex')
    if (seen.has(key)) continue
    let raw
    try { raw = JSON.parse(line) } catch { continue }
    const typeAllowed = raw.type === 'agent.work_completed' || raw.type === 'agent.handoff_observed' || raw.type === 'agent.runbook_completed'
    const actorAllowed = typeof raw.actorId === 'string' && allowedActors.has(raw.actorId)
    const targetAllowed = !raw.targetActorId || allowedActors.has(raw.targetActorId)
    const runbookAllowed = actorAllowed && typeof raw.runbookId === 'string' && raw.runbookId === expectedRunbookByAgent.get(raw.actorId)
    if (!typeAllowed || !actorAllowed || !targetAllowed || !runbookAllowed || typeof raw.message !== 'string') continue
    seen.add(key)
    accepted += 1
    await emit(run, raw.type, raw.message.slice(0, 1_000), {
      observedEventKeys: [...seen],
      currentAgentId: raw.targetActorId ?? raw.actorId,
      lastObservedAgentEvent: { actorId: raw.actorId, targetActorId: raw.targetActorId ?? null, type: raw.type, sourceTs: raw.ts ?? null },
    })
  }
  return accepted
}

async function restoreRuns() {
  let entries = []
  try { entries = await readdir(DATA_ROOT, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const runDir = resolve(DATA_ROOT, entry.name)
      const run = JSON.parse(await readFile(resolve(runDir, 'run.json'), 'utf8'))
      if (run.state === 'running' || run.state === 'dispatched') {
        Object.assign(run, {
          state: 'verification_pending', phase: 'recover', liveness: 'offline',
          gate: 'indeterminate', completion: 'verification_pending', delivery: 'unknown', integrity: 'unverified',
          recoveryNotice: 'O bridge reiniciou durante a execução. A conclusão precisa de verificação humana dos logs e artefatos.',
          updatedAt: new Date().toISOString(),
        })
        await writeRunFile(runDir, run)
      }
      runs.set(run.id, run)
    } catch { /* run corrompido é ignorado, sem apagar evidência */ }
  }
}

function commandProbe(command, args) {
  return new Promise((resolveProbe) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const output = []
    const timer = setTimeout(() => child.kill('SIGKILL'), 5_000)
    child.stdout.on('data', (chunk) => output.push(chunk))
    child.stderr.on('data', (chunk) => output.push(chunk))
    child.on('error', () => {
      clearTimeout(timer)
      resolveProbe({ ok: false, output: '' })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolveProbe({ ok: code === 0, output: Buffer.concat(output).toString('utf8').trim() })
    })
  })
}

function validAuthenticationProbe(result) {
  if (!result.ok) return false
  return !/not logged in|not authenticated|unauthenticated|login required/i.test(result.output)
}

async function probeExecutor(executor) {
  const availability = await commandProbe(executor.command, executor.availabilityArgs ?? ['--version'])
  if (!availability.ok) {
    return { id: executor.id, label: executor.label, available: false, authenticated: false, ready: false, reason: 'comando não encontrado ou indisponível' }
  }
  if (executor.authenticationArgs) {
    const authentication = await commandProbe(executor.command, executor.authenticationArgs)
    return {
      id: executor.id, label: executor.label, available: true, authenticated: validAuthenticationProbe(authentication), ready: validAuthenticationProbe(authentication),
      reason: validAuthenticationProbe(authentication) ? null : 'CLI instalada, mas sem autenticação válida.',
    }
  }
  if (executor.requiresAuthentication) {
    return { id: executor.id, label: executor.label, available: true, authenticated: false, ready: false, reason: 'Configure uma verificação de autenticação explícita para este executor.' }
  }
  return { id: executor.id, label: executor.label, available: true, authenticated: null, ready: true, reason: null }
}

function executorArgs(executor, prompt, outputDir, workDirectory) {
  return executor.args.map((arg) => arg
    .replaceAll('{prompt}', prompt)
    .replaceAll('{outputDir}', outputDir)
    .replaceAll('{workDirectory}', workDirectory))
}

async function execute(run, executor) {
  const executorStatus = await probeExecutor(executor)
  if (!executorStatus.ready) {
    await emit(run, 'run.execution_blocked', `Despacho não iniciado: ${executorStatus.reason}`, {
      state: 'prepared', phase: 'blocked', liveness: 'offline', gate: 'blocked', completion: 'not_ready', delivery: 'none', integrity: 'unverified', executionBlocker: executorStatus.reason,
    })
    return
  }
  const prompt = buildPrompt({ task: run.task, route: run.route, runId: run.id, outputDir: run.outputDir, workDirectory: run.workDirectory })
  await mkdir(run.outputDir, { recursive: true })
  const promptFile = resolve(run.runDir, 'AGENT_BRIEF.md')
  await writeFile(promptFile, prompt, 'utf8')
  await emit(run, 'run.dispatched', `Executor ${executor.label} despachado.`, {
    state: 'dispatched', phase: 'execute_declared', liveness: 'waiting', gate: 'pending', completion: 'verification_pending', delivery: 'none', integrity: 'unverified',
  })
  const args = executorArgs(executor, prompt, run.outputDir, run.workDirectory)
  const stdoutPath = resolve(run.runDir, 'stdout.log')
  const stderrPath = resolve(run.runDir, 'stderr.log')
  const child = spawn(executor.command, args, {
    cwd: run.workDirectory,
    env: { ...process.env, IFFAR_RUN_ID: run.id, IFFAR_OUTPUT_DIR: run.outputDir, IFFAR_AGENT_BRIEF: promptFile },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (executor.input === 'stdin') child.stdin.end(prompt)
  else child.stdin.end()
  child.stdout.on('data', (chunk) => appendFile(stdoutPath, chunk))
  child.stderr.on('data', (chunk) => appendFile(stderrPath, chunk))
  await emit(run, 'run.started', `Executor ${executor.label} em execução.`, {
    state: 'running', phase: 'execute_declared', liveness: 'running', gate: 'pending', completion: 'verification_pending',
  })
  const observedEventPoller = setInterval(() => { void ingestObservedAgentEvents(run) }, 1_500)
  child.on('error', async (cause) => {
    clearInterval(observedEventPoller)
    await emit(run, 'run.failed', `Falha ao iniciar executor: ${cause.message}`, {
      state: 'failed', phase: 'failed', liveness: 'offline', gate: 'indeterminate', completion: 'invalid', delivery: 'none', integrity: 'invalid',
    })
  })
  child.on('close', async (code) => {
    clearInterval(observedEventPoller)
    await ingestObservedAgentEvents(run)
    if (code !== 0) {
      await emit(run, 'run.failed', `Executor encerrou com código ${code}. Consulte stderr.log.`, {
        state: 'failed', phase: 'failed', liveness: 'idle', gate: 'failed', completion: 'invalid', delivery: 'none', integrity: 'unverified',
      })
      return
    }
    const artifacts = await verifyArtifacts(run.outputDir)
    const artifactCheck = evaluateArtifactProfile(artifacts, run.artifactProfile)
    if (!artifactCheck.passed) {
      const missing = artifactCheck.groups.filter((group) => !group.present).map((group) => group.label).join('; ')
      await emit(run, 'run.verification_pending', `Executor encerrou, mas faltam artefatos exigidos pelo perfil: ${missing}.`, {
        state: 'verification_pending', phase: 'verify', liveness: 'idle', gate: 'indeterminate', completion: 'verification_pending', delivery: artifacts.length ? 'present' : 'missing', integrity: 'unverified', artifacts, artifactCheck,
      })
      return
    }
    await emit(run, 'run.completed_verified', `${artifacts.length} artefato(s) verificado(s) e perfil de entrega atendido.`, {
      state: 'completed_verified', phase: 'complete_claimed', liveness: 'idle', gate: 'passed', completion: 'completed_verified', delivery: 'verified', integrity: 'verified', artifacts, artifactCheck,
    })
  })
}

async function createRun(payload, approved = false) {
  if (!payload.task || typeof payload.task !== 'string' || payload.task.trim().length < 8) {
    throw new Error('Informe uma tarefa com pelo menos 8 caracteres.')
  }
  const executor = executors.get(payload.executorId)
  if (!executor) throw new Error('Executor não registrado.')
  const id = randomUUID()
  const runDir = resolve(DATA_ROOT, id)
  const workDirectory = await ensureContainedWorkDirectory(payload.workDirectory, ALLOWED_WORK_ROOTS, DEFAULT_WORK_ROOT)
  const route = resolveRoute(institutional, payload.task.trim(), { course: payload.course ?? '' })
  const run = makeRun({ id, task: payload.task.trim(), executorId: executor.id, route, runDir, workDirectory })
  await mkdir(runDir, { recursive: true })
  runs.set(id, run)
  await writeRunFile(runDir, run)
  await emit(run, 'run.prepared', 'Rota institucional preparada com fonte normativa.', {})
  if (route.requiresHumanApproval && !approved) {
    await emit(run, 'run.awaiting_human_approval', route.approvalReason, {})
  } else {
    void execute(run, executor)
  }
  return run
}

async function approveRun(run, payload = {}) {
  if (run.state !== 'awaiting_human_approval') throw new Error('Esta execução não está aguardando aprovação.')
  if (!APPROVAL_TOKEN) throw new Error('Aprovação humana indisponível: configure IFFAR_APPROVAL_TOKEN no servidor.')
  const supplied = typeof payload.approvalToken === 'string' ? payload.approvalToken : ''
  const validToken = Buffer.byteLength(supplied) === Buffer.byteLength(APPROVAL_TOKEN) && timingSafeEqual(Buffer.from(supplied), Buffer.from(APPROVAL_TOKEN))
  if (!validToken) throw new Error('Token de aprovação inválido.')
  const approver = typeof payload.approver === 'string' ? payload.approver.trim() : ''
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : ''
  if (approver.length < 3 || reason.length < 8) throw new Error('Informe identificador do aprovador e motivo com pelo menos 8 caracteres.')
  const executor = executors.get(run.executorId)
  await emit(run, 'run.approved', `Aprovação humana autenticada por ${approver}.`, {
    state: 'prepared', phase: 'plan', liveness: 'waiting', gate: 'passed', completion: 'not_ready',
    approval: { approver, reason, approvedAt: new Date().toISOString(), method: 'server-token' },
  })
  void execute(run, executor)
  return run
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? HOST}`)
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const probes = await Promise.all([...executors.values()].map(probeExecutor))
      return send(res, 200, { status: 'ok', mode: 'loopback-only', executors: probes })
    }
    if (req.method === 'GET' && url.pathname === '/api/snapshot') {
      return send(res, 200, {
        contract: 'iffar-pixel-art/1.0',
        generatedAt: new Date().toISOString(),
        roots: institutional.structure.roots,
        source: { title: institutional.structure.source.title, date: institutional.structure.source.date },
        catalog: { contract: institutional.catalog.contract, counts: institutional.catalog.counts },
        runs: [...runs.values()].map((run) => ({ ...run, runDir: undefined, outputDir: undefined, workDirectory: undefined })),
      })
    }
    if (req.method === 'GET' && url.pathname === '/api/agents') {
      const rootCode = url.searchParams.get('root')
      const agents = institutional.catalog.agents
        .filter((agent) => !rootCode || agent.unit.rootCode === rootCode)
        .map((agent) => ({ id: agent.id, displayName: agent.displayName, roleType: agent.roleType, unit: agent.unit, skills: agent.skills, normativeSource: agent.normativeSource }))
      return send(res, 200, { contract: institutional.catalog.contract, rootCode, agents })
    }
    if (req.method === 'POST' && url.pathname === '/api/route') {
      const payload = await body(req)
      return send(res, 200, resolveRoute(institutional, payload.task ?? '', { course: payload.course ?? '' }))
    }
    if (req.method === 'POST' && url.pathname === '/api/runs') {
      const run = await createRun(await body(req))
      return send(res, 202, run)
    }
    const eventMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/events$/)
    if (req.method === 'GET' && eventMatch) {
      const run = runs.get(eventMatch[1])
      if (!run) return error(res, 404, 'Execução não encontrada.')
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
      for (const event of await historicalEvents(run)) res.write(`event: run\ndata: ${JSON.stringify(event)}\n\n`)
      const set = subscribers.get(run.id) ?? new Set()
      set.add(res)
      subscribers.set(run.id, set)
      req.on('close', () => set.delete(res))
      return
    }
    const artifactMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/artifacts\/([^/]+)$/)
    if (req.method === 'GET' && artifactMatch) {
      const run = runs.get(artifactMatch[1])
      if (!run) return error(res, 404, 'Execução não encontrada.')
      const artifact = run.artifacts.find((item) => item.id === artifactMatch[2])
      if (!artifact) return error(res, 404, 'Artefato não encontrado.')
      const artifactPath = resolve(run.outputDir, artifact.relativePath)
      if (!isWithin(artifactPath, run.outputDir)) return error(res, 403, 'Caminho de artefato inválido.')
      const content = await readFile(artifactPath)
      const hash = createHash('sha256').update(content).digest('hex')
      if (hash !== artifact.sha256) return error(res, 409, 'A integridade do artefato mudou após a verificação.')
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${artifact.name.replaceAll('"', '')}"`, 'cache-control': 'no-store' })
      return res.end(content)
    }
    const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/)
    if (req.method === 'GET' && runMatch) {
      const run = runs.get(runMatch[1])
      return run ? send(res, 200, run) : error(res, 404, 'Execução não encontrada.')
    }
    const approveMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/approve$/)
    if (req.method === 'POST' && approveMatch) {
      const run = runs.get(approveMatch[1])
      if (!run) return error(res, 404, 'Execução não encontrada.')
      return send(res, 202, await approveRun(run, await body(req)))
    }
    return error(res, 404, 'Rota não encontrada.')
  } catch (cause) {
    return error(res, 400, cause instanceof Error ? cause.message : 'Erro não identificado.')
  }
})

await mkdir(DATA_ROOT, { recursive: true })
await mkdir(DEFAULT_WORK_ROOT, { recursive: true })
await restoreRuns()
server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({ service: 'iffar-pixel-art-bridge', host: HOST, port: PORT, roots: institutional.structure.roots.length, units: institutional.structure.units.length }))
})
