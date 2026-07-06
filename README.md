# GeniusAI Civilizations — Watchable AI

Simulação onde civilizações (Roma, Egito, Grécia, Mali) são governadas por **agentes autônomos** acionados por um **CLI de agente** (Claude Code / Codex / opencode) em modo headless, ou pelo **Ollama** direto. O usuário **assiste** — não comanda. Tudo roda localmente e a UI é servida em `localhost`.

> Especificação completa: [`docs/PRD-watchable-ai-civilizations.md`](docs/PRD-watchable-ai-civilizations.md).

## Estado atual: Fase 1 concluída

**Fase 0 — scaffold e execução por runner:**
- Monorepo TypeScript (npm workspaces): `apps/backend` (Node + WebSocket) e `apps/frontend` (React/Vite).
- Interface `AgentRunner` com implementações plugáveis:
  - `ClaudeCodeRunner` → `claude -p --output-format json`
  - `CodexRunner` → `codex exec`
  - `OpencodeRunner` → `opencode run`
  - `OllamaRunner` → HTTP `localhost:11434/api/chat` (com `format` = JSON schema)
- Seleção por env `RUNNER`; **health check** (HTTP `/health`, WebSocket e CLI).

**Fase 1 — World Engine determinístico (`apps/backend/src/engine/`), sem LLM:**
- Estado do mundo (mapa de tiles, civilizações, cidades, exércitos, tecnologia, diplomacia).
- PRNG determinístico (`Rng`) com estado serializável → simulação reproduzível (replay).
- `createWorld(seed)` determinístico e `tick(world, decisions)` puro (não muta a entrada).
- Ações validadas pelo motor: `build`, `research`, `move_army`, `attack`, `set_diplomacy`, `trade`, `set_strategy` — ações inválidas viram evento `action_rejected` (feedback p/ o agente).
- Economia (rendimentos, crescimento, pesquisa) e combate determinístico.
- **25 testes** cobrindo determinismo, validação, combate, comércio e economia.

**Fase 2 — Camada de agentes (`apps/backend/src/agent/`), liga o LLM ao motor:**
- `actions.ts` — schema de ações em JSON (para `format`/prompt) + validação `zod` (`coerceActions`): ações inválidas são descartadas com erro, sem derrubar o turno.
- `prompt.ts` — `buildSystemPrompt` (regras + persona) e `buildTurnPrompt` (snapshot compacto do mundo + resultados do último turno).
- `runTurn.ts` — `runCivilizationTurn(world, civId, runner)`: monta prompts → chama o runner → valida → devolve ações. **Fallback:** se o runner falha (exceção/saída não-JSON/timeout), re-pergunta 1×; se falhar de novo, "passa o turno".
- `memory.ts` — memória por civilização em `./data/memory/<civ>.md` (`readMemory`/`writeMemory`/`hydrateMemory`/`persistMemory`).
- **16 testes** com runners falsos (sem LLM) cobrindo validação, fallback e integração com o motor.

Rodar os testes: `npm run test --workspace apps/backend` (41 no total).

Demo de um turno real com LLM:
```bash
RUNNER=claude npm run turn:demo --workspace apps/backend -- rome
# ou:  RUNNER=ollama MODEL=qwen2.5:14b npm run turn:demo --workspace apps/backend -- egypt
```

Próximo: **Fase 3** — Orquestrador: rodar os 4 agentes por tick, aplicar no motor, persistir memória/trace e fazer streaming do progresso.

## Pré-requisitos

- Node.js 20+.
- Ao menos um runner disponível no `PATH`:
  - um CLI de agente: `claude`, `codex` ou `opencode`; **ou**
  - Ollama: `ollama serve` + `ollama pull qwen2.5:14b`.

## Como rodar

```bash
npm install
cp .env.example .env        # ajuste RUNNER, MODEL, etc.

# Terminal 1 — backend (HTTP + WebSocket)
npm run dev:backend

# Terminal 2 — frontend (UI em http://localhost:5173)
npm run dev:frontend
```

Verificar a saúde do runner sem subir o servidor:

```bash
RUNNER=claude npm run health
# ou
RUNNER=ollama npm run health
```

Endpoints do backend (porta `PORT`, padrão 8787):
- `GET /health` → `{ ok, runner }`
- WebSocket `ws://localhost:8787` → mensagens `hello` e `health`.

## Configuração (env)

| Variável | Padrão | Descrição |
|---|---|---|
| `RUNNER` | `claude` | `claude` \| `codex` \| `opencode` \| `ollama` |
| `AGENT_CMD` | — | Override do binário do CLI |
| `MODEL` | `qwen2.5:14b` | Modelo (runner ollama / CLIs que aceitem) |
| `OLLAMA_HOST` | `http://localhost:11434` | Endpoint do Ollama |
| `PORT` | `8787` | Porta do backend |

## Estrutura

```
apps/
  backend/   Node + ws — AgentRunner, health check, servidor HTTP/WS
  frontend/  React + Vite — UI de observação (localhost)
docs/        PRD
data/        estado/memória/traces (gitignored)
logs/        logs (gitignored)
```
