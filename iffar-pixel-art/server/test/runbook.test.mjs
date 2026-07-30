import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const appRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))

test('runbook de agente registra handoff observado com argumento --event-file', async () => {
  const catalog = JSON.parse(await readFile(resolve(appRoot, 'data/agent-catalog.json'), 'utf8'))
  const root = await mkdtemp(resolve(tmpdir(), 'iffar-runbook-test-'))
  const brief = resolve(root, 'brief.md')
  const events = resolve(root, 'observed-events.jsonl')
  await writeFile(brief, 'Preparar evidências institucionais para um processo de teste.')
  const { stdout } = await execFileAsync(process.execPath, [resolve(appRoot, 'scripts/execute-agent-runbook.mjs'), '--agent', catalog.agents[0].id, '--event-file', events, '--brief', brief], { cwd: appRoot })
  const event = JSON.parse((await readFile(events, 'utf8')).trim())
  const result = JSON.parse(stdout)
  assert.equal(event.type, 'agent.runbook_completed')
  assert.equal(event.actorId, catalog.agents[0].id)
  assert.equal(event.runbookId, catalog.agents[0].runbook.id)
  assert.match(result.handoffFile, /\.handoff\.md$/)
  assert.ok((await readFile(result.handoffFile, 'utf8')).includes('Handoff operacional'))
})
