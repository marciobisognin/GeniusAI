import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), values[index + 1]])
  return pairs
}, []))

if (!args.agent || !args['event-file'] || !args.brief) {
  throw new Error('Uso: node scripts/execute-agent-runbook.mjs --agent <agentId> --event-file <jsonl> --brief <arquivo>')
}

const catalog = JSON.parse(await readFile(resolve(appRoot, 'data/agent-catalog.json'), 'utf8'))
const agent = catalog.agents.find((item) => item.id === args.agent)
if (!agent) throw new Error('Agente não encontrado no catálogo normativo.')
const brief = await readFile(resolve(args.brief), 'utf8')
if (brief.trim().length < 8) throw new Error('Brief insuficiente para registrar um handoff.')

const eventFile = resolve(args['event-file'])
const handoffFile = resolve(dirname(eventFile), `${agent.unit.nodeId.replaceAll('.', '_')}--${agent.displayName.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.handoff.md`)
const timestamp = new Date().toISOString()
const event = {
  contract: 'iffar-pixel-art-observed-event/1.0',
  id: randomUUID(),
  ts: timestamp,
  type: 'agent.runbook_completed',
  actorId: agent.id,
  runbookId: agent.runbook.id,
  unitNodeId: agent.unit.nodeId,
  source: 'execute-agent-runbook.mjs',
  message: `${agent.displayName} registrou um handoff operacional para ${agent.unit.name}.`,
}

await mkdir(dirname(eventFile), { recursive: true })
await writeFile(handoffFile, `# Handoff operacional\n\n- **Agente institucional:** ${agent.displayName}\n- **Uorg:** ${agent.unit.name} (${agent.unit.code})\n- **Fonte:** ${agent.normativeSource.title}, p. ${agent.normativeSource.unitPage}\n- **Registro:** ${timestamp}\n\n## Entrada recebida\n\n${brief}\n\n## Limite\n\nEste registro comprova apenas a execução deste runbook local. Não comprova ato administrativo, revisão humana ou entrega final.\n`, 'utf8')
await appendFile(eventFile, `${JSON.stringify({ ...event, handoffArtifact: handoffFile })}\n`, 'utf8')
console.log(JSON.stringify({ event, handoffFile }))
