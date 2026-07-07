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

**Fase 3 — Orquestrador (`apps/backend/src/orchestrator/`):**
- `GameLoop` — coordena os turnos: a cada tick, todas as civilizações vivas decidem sobre o mesmo snapshot (sequencial), o motor aplica via `tick()`, e o progresso é emitido por eventos (`turn_start`/`turn_token`/`turn_end`/`tick_end`/`loop_state`) — base do streaming para a UI.
- Controles: `play` / `pause` / `stop` / `step` (1 tick) / `setSpeed`; timeout por turno; auto-stop quando resta ≤1 civilização.
- `trace.ts` — persistência em `./data/`: trace por tick (`traces/<id>.jsonl`), save do mundo (`saves/<id>.json`), memórias (`memory/<civ>.md`).
- **5 testes** (runner falso) cobrindo tick/eventos, persistência, skip de civ morta, play→stop e auto-stop.

Rodar os testes: `npm run test --workspace apps/backend` (46 no total).

Demo do orquestrador (N ticks reais com LLM):
```bash
RUNNER=claude TICKS=1 npm run loop:demo --workspace apps/backend
```

**Fase 4 — UI de observação em localhost:**
- Backend: o WebSocket agora expõe **um `GameLoop` compartilhado** por servidor. Ao conectar, o cliente recebe `hello`/`health`/`world_init`; depois disso, todo `LoopEvent` do loop é retransmitido (broadcast) em tempo real. O cliente controla a reprodução via comandos `{type:"command", action:"play"|"pause"|"stop"|"step"|"set_speed"}` — **não** existe comando para agir por uma civilização.
- Frontend: `WorldMap` (mapa em Canvas — terreno, território, cidades, exércitos), `CivPanel` ×4 (stats + raciocínio **em streaming** + ações do turno + erros de validação), `EventTimeline` (eventos narrados) e `Controls` (play/pause/step/velocidade).
- Log de progresso também no terminal do backend (`[loop] tick N · civ: ...`) — "watchable" vale para o terminal, não só o browser.

Rodar (2 terminais):
```bash
RUNNER=claude npm run dev:backend    # :8787
npm run dev:frontend                 # http://localhost:5173
```

**Verificado com um navegador real** (Playwright/Chromium) contra o backend com o runner `claude` de verdade: conexão WebSocket, clique em "Step", e o tick avançou na UI (1→2) refletindo as decisões reais dos 4 agentes — incluindo uma proposta de comércio de Mali no tick 1 se concretizando (`trade_executed`) no tick 2.

**Limitação conhecida:** o histórico de raciocínio dos painéis vive só na memória do cliente enquanto a aba está aberta — reconectar (ou abrir nova aba) traz o estado atual do mundo (`world_init`) mas não repõe o raciocínio de turnos passados nem a timeline. Repor isso a partir do trace em disco (`./data/traces/<id>.jsonl`) fica para a Fase 5.

Próximo: **Fase 5** — Persistência/replay: carregar a timeline e o raciocínio a partir do trace ao reconectar, salvar/carregar partidas pela UI, e narrador de eventos (modelo pequeno).

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
