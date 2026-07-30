import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const port = 4391

function waitForHealth(url, timeout = 10_000) {
  return new Promise((resolveHealth, reject) => {
    const started = Date.now()
    const check = async () => {
      try {
        const response = await fetch(url)
        if (response.ok) return resolveHealth()
      } catch { /* servidor ainda não iniciou */ }
      if (Date.now() - started > timeout) return reject(new Error('Bridge de integração não iniciou.'))
      setTimeout(check, 100)
    }
    void check()
  })
}

async function waitForRun(url, timeout = 10_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const response = await fetch(url)
    const run = await response.json()
    if (['completed_verified', 'failed', 'verification_pending'].includes(run.state)) return run
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 100))
  }
  throw new Error('Run de integração não chegou a estado terminal.')
}

test('bridge integra executor registrado, evento observado e entrega verificada', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'iffar-bridge-test-'))
  const configPath = resolve(root, 'executors.json')
  const workRoot = resolve(root, 'workspace')
  await mkdir(workRoot)
  await writeFile(configPath, JSON.stringify({ executors: [{ id: 'fixture', label: 'Executor fixture', command: process.execPath, args: [resolve(appRoot, 'server/test/fixture-executor.mjs')], availabilityArgs: ['--version'], input: 'none', requiresAuthentication: false }] }))
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: appRoot,
    env: { ...process.env, IFFAR_PIXEL_ART_PORT: String(port), IFFAR_EXECUTORS_PATH: configPath, IFFAR_ALLOWED_WORK_ROOTS: workRoot },
    stdio: 'ignore',
  })
  try {
    await waitForHealth(`http://127.0.0.1:${port}/health`)
    const create = await fetch(`http://127.0.0.1:${port}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: 'Preparar relatório de ensino no Campus Frederico Westphalen', executorId: 'fixture', workDirectory: workRoot }) })
    assert.equal(create.status, 202)
    const initial = await create.json()
    const run = await waitForRun(`http://127.0.0.1:${port}/api/runs/${initial.id}`)
    assert.equal(run.state, 'completed_verified')
    assert.equal(run.artifactCheck.passed, true)
    assert.equal(run.artifacts.length, 1)
    const eventResponse = await fetch(`http://127.0.0.1:${port}/api/runs/${initial.id}/events`)
    const reader = eventResponse.body.getReader()
    const decoder = new TextDecoder()
    let eventText = ''
    for (let index = 0; index < 12 && !/agent\.work_completed/.test(eventText); index += 1) {
      const chunk = await reader.read()
      if (chunk.done) break
      eventText += decoder.decode(chunk.value, { stream: true })
    }
    await reader.cancel()
    assert.match(eventText, /agent\.runbook_completed/)
    assert.match(eventText, /agent\.work_completed/)
    const artifact = await fetch(`http://127.0.0.1:${port}/api/runs/${initial.id}/artifacts/${run.artifacts[0].id}`)
    assert.equal(artifact.status, 200)
  } finally {
    child.kill('SIGTERM')
  }
})
