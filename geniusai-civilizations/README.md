# GeniusAI Civilizations — Watchable AI

Simulação onde civilizações (Roma, Egito, Grécia, Mali) são governadas por **agentes autônomos** acionados por um **CLI de agente** (Claude Code / Codex / opencode) em modo headless, ou pelo **Ollama** direto. O usuário **assiste** — não comanda. Tudo roda localmente e a UI é servida em `localhost`.

> Especificação completa: [`docs/PRD-watchable-ai-civilizations.md`](docs/PRD-watchable-ai-civilizations.md).

## Estado atual: Fase 11 concluída (dev único, tipos compartilhados e CI)

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

~~**Limitação conhecida:** o histórico de raciocínio dos painéis vive só na memória do cliente...~~ — **resolvido na Fase 5** (mensagem `history` abaixo).

**Fase 5 — Persistência/replay, save/load e narrador (`apps/backend/src/orchestrator/`):**
- **Retomada automática:** `createGameLoop()` tenta `loadWorld(gameId)` antes de criar um mundo novo — reiniciar o backend continua a mesma partida de onde parou (tick, mapa, civilizações), sem qualquer ação do usuário.
- **Reconexão com histórico:** ao conectar, o cliente recebe `world_init` (estado atual) **e** `history` (`{timeline, civs}`, lido do trace em disco) — resolve a limitação da Fase 4: reabrir a UI (ou reconectar) repõe a timeline inteira e o último raciocínio de cada civilização, não só o estado presente.
- **Save/load pela UI:** comandos WS `list_saves` (lista partidas salvas com tick/seed/data), `new_game` (opcional `seed`) e `load_game` (`gameId`) — trocam o `GameLoop` ativo em tempo real, sem reiniciar o servidor; `load_game` para um `gameId` inexistente devolve `{type:"error"}` em vez de criar um mundo silenciosamente. Componente `SavesPanel` no frontend.
- **Narrador de eventos** (`narrator.ts`, opcional via `NARRATOR=true`): reaproveita o mesmo `AgentRunner`/schema dos agentes — o campo `reasoning` vira a manchete do tick, `actions` é ignorado. Decorativo: qualquer falha é engolida (nunca derruba um tick). A manchete é injetada como um evento sintético `{type:"narration"}` **na mesma lista de eventos do tick** — assim streaming ao vivo e replay do trace usam exatamente o mesmo caminho.
- **24 novos testes:** `trace.test.ts` (round-trip de save/trace/summarizeTrace, sem LLM), `narrator.test.ts` (runner falso — sucesso, lista vazia, só `tick_started`, reasoning vazio, exceção engolida) e `server.test.ts` (WebSocket ponta a ponta contra um runner falso: conexão/history, `step`, `list_saves`, `load_game` inexistente, `new_game`→`load_game`, reconexão com histórico).

Rodar os testes: `npm run test --workspace apps/backend` (**70 no total**).

**Verificado com o runner `claude` real** (narrador ligado): um tick completo com as 4 civilizações gerou a manchete *"Egito, Roma, Grécia e Mali selam paz e comércio enquanto o Egito firma acordo comercial com Mali no amanhecer das civilizações."* — coerente com os eventos de diplomacia do tick. `list_saves` refletiu a partida corretamente, e uma segunda conexão (simulando reload da página) recebeu a `history` completa (25 eventos, incluindo a narração) e o raciocínio de Roma, sem precisar reprocessar nada.

Isso fecha o roadmap do MVP (§11 do PRD).

**Fase 6 — Redesign da UI: navegação real, tema duplo e mapa reintegrado:**
- **Três modos de visualização funcionais** (as abas do topo agora navegam de verdade):
  - **Evolução** — trilho de civilizações, canvas de evolução e inspector da civilização selecionada.
  - **Mundo & Diplomacia** — o **mapa canvas do motor** (terreno, território, cidades, exércitos) voltou à UI: renderização nítida em qualquer DPI (`devicePixelRatio`), responsivo via `ResizeObserver`, paleta por tema, contorno do território da civilização selecionada e legenda. Ao lado: rede diplomática, árvore tecnológica e sistema de crises.
  - **Crônicas** — linha das eras, crônica narrativa, "pergunte à civilização" e Museu Vivo.
- **Tema claro e escuro** ("atlas de pergaminho" / "observatório"): design system com tokens CSS, toggle no topo, persistido em `localStorage` e respeitando `prefers-color-scheme`.
- **Reconexão automática do WebSocket** com backoff exponencial — se o backend reiniciar, a UI reconecta sozinha e o servidor repõe `world_init` + `history` (nada se perde).
- **Atalhos de teclado**: `espaço` = play/pause, `S` = step.
- Limpeza: componentes mortos removidos, filtro de eventos por civilização corrigido (não usa mais `JSON.stringify().includes()`), textos residuais eliminados, `prefers-reduced-motion` respeitado.

| Evolução (claro) | Mundo & Diplomacia (escuro) | Tick real com LLM (escuro) |
|---|---|---|
| ![Evolução, tema claro](docs/screenshots/evolution-light.png) | ![Mundo & Diplomacia, tema escuro](docs/screenshots/world-dark.png) | ![Tick 1 com agentes reais](docs/screenshots/evolution-tick1-dark.png) |

**Verificado com um navegador real** (Playwright/Chromium) contra o runner `claude` de verdade: conexão, troca de abas, troca de tema, e um tick completo — os 4 agentes decidiram, o raciocínio de Roma apareceu em streaming no inspector e os eventos viraram toasts, timeline e crônica.

**Fase 7 — Correções estruturais (PRD complementar de correção e agentes):**
- **`.env` carregado de verdade** (`process.loadEnvFile`, raiz do projeto ou `apps/backend`); configuração inválida (RUNNER/PORT) impede a inicialização com mensagem clara.
- **Runner `mock`** (`RUNNER=mock`): decisões determinísticas sem LLM — desenvolvimento da UI, testes e smoke tests de ponta a ponta sem custo.
- **Segurança:** `gameId` restrito a `^[a-zA-Z0-9_-]{1,64}$` com verificação de caminho (anti path traversal em save/trace/memória), comandos WebSocket validados com zod (`INVALID_COMMAND` com código), `maxPayload` de 64 KiB, validação de `Origin` (localhost + `ALLOWED_ORIGINS`), bind padrão em `127.0.0.1` (`HOST`).
- **Economia blindada:** quantias de comércio precisam ser inteiras, finitas e não-negativas — no schema (zod) e revalidadas no motor (oferta negativa invertia a transferência).
- **Concorrência:** ticks nunca executam em paralelo — mutex no `GameLoop.step()` + `GAME_BUSY` no servidor para step/new_game/load_game concorrentes.
- **Persistência segura:** saves com envelope versionado (`schemaVersion`), escrita atômica (tmp + rename) e validação de schema em runtime; formato legado migra de forma transparente; save corrompido → `SAVE_CORRUPTED`, versão futura → `SAVE_VERSION_UNSUPPORTED` (falha visível, nunca silenciosa).
- **Memória isolada por partida:** `data/memory/<gameId>/<civ>.md` — partidas não se contaminam, e carregar um save não sobrescreve mais a memória salva com uma memória global.
- **"Pergunte à civilização" real:** novo comando WS `ask {civ, question}` consulta o **agente real** em modo somente leitura (não avança turno, não altera memória); a UI mostra loading, resposta com o runner de origem, e em caso de falha um erro visível + estimativa local claramente rotulada.
- **+13 testes** (segurança, concorrência, versionamento, ask): **83 no total**.

Rodar sem nenhum LLM: `RUNNER=mock npm run dev:backend` + `npm run dev:frontend`.

**Fase 8 — Mecânicas bilaterais (comércio e aliança exigem aceite):**
- **Comércio em duas etapas** (RF-022): `propose_trade` cria uma proposta pendente — **nada é transferido antes do aceite**. `respond_proposal {proposalId, accept}` aceita (revalidando as condições **no momento do aceite**: quem gastou a oferta não paga mais) ou recusa. Propostas não respondidas **expiram em 3 ticks** (`proposal_expired`).
- **Aliança bilateral** (RF-023): `set_diplomacy(alliance)` unilateral agora é rejeitado; aliança só via `propose_alliance` + aceite. Declarar guerra invalida as propostas pendentes entre o par.
- **Estado no motor:** `world.pendingProposals` (ids determinísticos, `createdTick`/`expiresTick`) — serializado nos saves (com migração: saves antigos ganham `[]`), visível no snapshot dos agentes (`proposals.incoming/outgoing`) e no prompt.
- **Novos eventos:** `trade_proposed`, `alliance_proposed`, `proposal_accepted`, `proposal_rejected`, `proposal_expired` — narrados na timeline e na crônica.
- **UI:** painel **"Negociações em aberto"** na vista Mundo & Diplomacia — quem propôs o quê a quem, termos e tick de expiração, direto do estado do motor.
- **MockRunner bilateral:** responde propostas recebidas (aceitando) e, com ouro sobrando, propõe comércios modestos — o fluxo inteiro é observável sem nenhum LLM.
- **+7 testes** (proposta sem transferência, aceite exato, recusa, expiração, resposta por terceiros, revalidação no aceite, aliança bilateral, guerra invalidando propostas): **90 no total**.

**Fase 9 — Tecnologia com efeitos reais, recrutamento e condições de vitória:**
- **Tecnologias com efeito real** (RF-024): o catálogo agora tem descrição e efeitos aplicados pelo motor — `agriculture` +2 alimento/cidade, `writing` +1 ciência/cidade, `currency` +2 ouro/cidade, `mathematics` +2 ciência/cidade e +2 de força ao recrutar, `bronze_working` habilita recrutamento e +1 de força. Descrição e efeitos vão no snapshot dos agentes.
- **Recrutamento** (RF-020): ação `recruit {cityId}` — exige `bronze_working` **e** um quartel (`barracks`) na cidade; custa 30 de ouro; a força soma os bônus tecnológicos. Evento `army_recruited`.
- **Condições de vitória** (RF-026): avaliadas ao fim de cada tick, em ordem determinística — **dominação** (restou uma civ), **científica** (catálogo completo), **prosperidade** (reservas ≥ 400) e **limite de turnos** (tick 80, vence a maior pontuação). `world.victory` é definitivo (partida encerrada é imutável no motor), o `GameLoop` para sozinho, e a UI mostra **banner de vitória** + evento 🏆 na timeline. Saves antigos migram com `victory: null`.
- **+6 testes** (efeito de tecnologia isolado, recruit com/sem requisitos, vitória científica/dominação/prosperidade/limite de turnos, imutabilidade pós-vitória): **96 no total**.
- **Verificado em partida real**: com `RUNNER=mock` em play contínuo, Roma venceu por prosperidade no tick 38 — o loop parou sozinho e o banner apareceu (screenshot em `docs/screenshots/victory-dark.png`).

**Fase 10 — Tela de criação de partida (RF-010):**
- Modal **"Nova partida"** (botão na dock de partidas): nome da partida, seed opcional e velocidade inicial; o botão fica desabilitado enquanto os dados forem inválidos; o runner ativo é informado (configurado no backend).
- Backend: `new_game` aceita `name`/`seed`/`speedMs` validados por schema; o nome vira a parte legível do `gameId` (slug sem acentos, ex.: "Ascensão do Mediterrâneo!" → `ascensao-do-mediterraneo-<timestamp>`), sempre dentro da allowlist de segurança.
- **97 testes**; verificado em Chromium: criar a partida pelo modal, avançar um tick e vê-la em "partidas salvas" com o gameId slugificado (`docs/screenshots/newgame-design.png` mostra o design nos dois temas).

**Fase 11 — Comando único, tipos compartilhados e CI (RF-002 + §6.1 + §13.6):**
- **`npm run dev` único**: sobe backend e frontend juntos (`scripts/dev.mjs`, zero dependências); Ctrl+C encerra os dois. Também: `npm test`, `npm run build`, `npm run typecheck` (3 workspaces) e `npm run e2e` na raiz.
- **`packages/shared` (`@geniusai/shared`)**: única fonte de verdade para os tipos que cruzam a fronteira backend ⇄ frontend — estado do jogo (World/Civilization/Proposal/Victory/GameEvent/Action), eventos do orquestrador (LoopEvent/DisplayEvent) e o protocolo WebSocket (ServerMessage/ClientCommand). Backend e frontend importam o mesmo contrato; os arquivos antigos viraram re-exports, então um campo novo agora é adicionado em UM lugar. A timeline do frontend passou a usar a união discriminada real do motor (fim do `{type:string} & Record<string,unknown>`).
- **E2E versionado** (`e2e/smoke.mjs`): sobe backend mock + frontend buildado, abre Chromium e percorre conectar → criar partida pelo modal → 2 ticks → mapa/propostas → pergunta ao agente. Sai com código ≠ 0 em falha.
- **CI no GitHub Actions** (`.github/workflows/ci.yml`): a cada push/PR roda typecheck (shared+backend+frontend), os 97 testes, o build e o E2E smoke com Chromium real — o PRD §16 ("nenhuma regressão") vira verificação automática.

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
- WebSocket `ws://localhost:8787`:
  - servidor → cliente: `hello`, `health`, `world_init` (`{world, loopState, gameId}`), `history` (`{timeline, civs}`), `loop_state`, `turn_start`, `turn_token`, `turn_end`, `tick_end`, `saves`, `error`.
  - cliente → servidor: `{type:"command", action:"play"|"pause"|"stop"|"step"}`, `{action:"set_speed", speedMs}`, `{action:"list_saves"}`, `{action:"new_game", seed?}`, `{action:"load_game", gameId}`.

## Configuração (env)

| Variável | Padrão | Descrição |
|---|---|---|
| `RUNNER` | `claude` | `claude` \| `codex` \| `opencode` \| `ollama` |
| `AGENT_CMD` | — | Override do binário do CLI |
| `MODEL` | `qwen2.5:14b` | Modelo (runner ollama / CLIs que aceitem) |
| `OLLAMA_HOST` | `http://localhost:11434` | Endpoint do Ollama |
| `PORT` | `8787` | Porta do backend |
| `NARRATOR` | `false` | `true` liga o narrador de eventos (1 chamada extra de LLM por tick) |
| `SEED` | `42` | Seed do mundo (define o `gameId` padrão: `game-<seed>`) |
| `TICK_SPEED_MS` | `2000` | Atraso entre ticks no modo play |
| `TURN_TIMEOUT_MS` | `60000` | Timeout por turno de agente |

## Estrutura

```
apps/
  backend/   Node + ws — AgentRunner, health check, servidor HTTP/WS
  frontend/  React + Vite — UI de observação (localhost)
docs/        PRD
data/        estado/memória/traces (gitignored)
logs/        logs (gitignored)
```
