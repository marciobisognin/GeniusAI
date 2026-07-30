import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const outputDir = process.env.IFFAR_OUTPUT_DIR
const promptFile = process.env.IFFAR_AGENT_BRIEF
if (!outputDir || !promptFile) throw new Error('Ambiente do bridge ausente.')
const brief = await readFile(promptFile, 'utf8')
const match = brief.match(/\[(agent:[^;\]]+); runbook=([^\]]+)\]/)
if (!match) throw new Error('Agente ou runbook de rota não encontrado no brief.')
const [, actorId, runbookId] = match
const ts = new Date().toISOString()
await mkdir(outputDir, { recursive: true })
await writeFile(resolve(outputDir, 'result.md'), '# Resultado de fixture\n\nEste artefato testa o protocolo do bridge com conteúdo material suficiente para a validação estrutural. Não representa execução externa real.\n')
await writeFile(resolve(outputDir, 'observed-events.jsonl'), [
  { type: 'agent.runbook_completed', actorId, runbookId, message: 'Runbook individual validado pela fixture de integração.', ts },
  { type: 'agent.work_completed', actorId, runbookId, message: 'Executor-fixture concluiu atividade técnica de teste.', ts },
].map((event) => JSON.stringify(event)).join('\n') + '\n')
