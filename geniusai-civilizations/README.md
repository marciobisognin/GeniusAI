# GeniusAI Civilizations — Watchable AI

Simulação onde civilizações (Roma, Egito, Grécia, Mali) são governadas por **agentes autônomos** acionados por um **CLI de agente** (Claude Code / Codex / opencode) em modo headless, ou pelo **Ollama** direto. O usuário **assiste** — não comanda. Tudo roda localmente e a UI é servida em `localhost`.

> Especificação completa: [`docs/PRD-watchable-ai-civilizations.md`](docs/PRD-watchable-ai-civilizations.md).

## Estado atual: Fase 18 concluída (guerra/ocupação, balanceamento e acessibilidade)

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

**Fase 12 — Teatro de Decisões (nova vista, inspirada em "Decision Theatre"):**
- Quarta aba **"Teatro"**: uma apresentação cênica da simulação, 100% derivada do estado real do motor.
  - **Trilho de civilizações** com arte própria (SVGs autorais em `src/assets/civs/`), líder, verbo de status ao vivo ("deliberando…", "executou · propose_trade") e turno; seção "Além da névoa" com civilizações futuras claramente marcadas como sem telemetria.
  - **O mundo conhecido**: árvore de decisões ao vivo — cartão de foco central com checklist real (ex.: pesquisa com progresso `ciência 5/20` riscando etapas), recompensas vindas dos efeitos reais do catálogo, nós concluídos (✓ tecnologias e obras) ligados por linhas, e nós futuros tracejados ("ao alcance" quando os pré-requisitos reais foram atendidos).
  - **Eventos-mundo** em banner cênico: batalhas/guerras = presságio (vermelho), comércio/alianças = fortuna (verde), tecnologia/vitória = marco (azul) — sempre eventos reais da timeline.
  - **Cartão-herói** com a arte da civilização, contadores (eventos/obras/eras), tesouraria com barras reais, conselho de guerra (foco atual + raciocínio literal do agente) e anais.
  - **Giro automático do holofote** a cada 8s entre as civilizações (pausável; clicar numa civ fixa o holofote).
- O catálogo de tecnologias migrou para `@geniusai/shared` (custos, pré-requisitos, descrições, efeitos e ramos) — motor e UI consomem a MESMA fonte, e a árvore tecnológica da vista Mundo agora mostra só tecnologias que existem de verdade (RF-024 integral).
- E2E atualizado (passo do Teatro); screenshots em `docs/screenshots/theatre-*.png`.

**Fase 13 — Agente Construtor (`CivilizationAgentFactory` + `AgentOrchestrator`, PRD §7):**
- **`CivilizationDefinition`** (`@geniusai/shared`): a "receita" de uma civilização — nome, adjetivo, cor, líder, traços de personalidade, prioridades, tolerância a risco, estilo diplomático, tecnologias/recursos iniciais e **modelo de LLM próprio** (`model?`). `DEFAULT_CIVILIZATIONS` é o catálogo de produção (Roma/Egito/Grécia/Mali) — única fonte de verdade, consumida por `createWorld` (persona/recursos/tecnologias iniciais), pelos agentes e pela UI (nomes, cores e líder do Teatro de Decisões deixaram de estar duplicados em 3 arquivos).
- **`CivilizationAgentFactory`** (`agent/CivilizationAgentFactory.ts`): valida a definição (zod — id, atributos, limites, e que `startingTechnologies` só referencia tecnologias reais do catálogo) e monta um `CivilizationAgent` com `decide()`, `answerQuestion()` (RF-032) e `summarizeTurn()` (síntese local, sem chamar o runner).
- **`AgentOrchestrator`** (`orchestrator/AgentOrchestrator.ts`): registra um agente por civilização e expõe `decide`/`answerQuestion` por `CivId`. O `GameLoop` o recria a cada `createGameLoop` (nova partida OU carregada de save) — isso *é* a "restauração do agente ao carregar uma partida" (§7.2): os agentes não têm estado próprio além de runner/definição, a memória de longo prazo já vive em `World.civilizations[*].memory`.
- **Modelo por civilização**: `CivilizationDefinition.model` sobrepõe o modelo do runner só para aquela civilização — honrado hoje pelo `OllamaRunner` (limitação declarada: CLIs claude/codex/opencode ignoram, cada um seleciona modelo de um jeito diferente, fora do escopo desta fase).
- **Segurança reforçada (§7.6)**: nova defesa em profundidade — `clampPublicReasoning` trunca a justificativa pública em 480 caracteres (nunca cadeia de pensamento longa na UI/trace); novo teste de regressão prova que `snapshotForCiv` **nunca** vaza a memória de uma civilização para outra. As garantias já existentes (agente não recebe caminhos, não escolhe `gameId`, só emite ações registradas, falha vira fallback seguro) foram revisadas e continuam de pé.
- `server.ts` simplificado: o comando `ask` agora delega a `GameLoop.ask()` → `AgentOrchestrator` → agente, eliminando a lógica de prompt duplicada que vivia solta no servidor.
- **+21 testes** (validação da definição, factory, orquestrador, isolamento de memória, `createWorld` com definições customizadas, override de modelo, `GameLoop.ask()`): **118 no total**.
- Verificado em Chromium: partida nova → 3 ticks → Teatro com nomes/cores/líderes **pixel-idênticos** a antes da refatoração → `ask` respondido via o novo orquestrador → logs estruturados `[agent] {...}` no console do backend, um por decisão.

**Fase 15 — Observabilidade, lint e cobertura de testes (RNF-003):**
- **Logger estruturado** (`src/logger.ts`): toda linha carrega os campos do RNF-003 — `requestId`, `gameId`, `tick`, `civilizationId`, `operation`, `durationMs`, `errorCode`. Dois formatos, escolhidos por `LOG_FORMAT` (padrão `pretty`): **pretty** — uma linha legível no terminal, preservando o "watchable" do produto (`[info] rome decidindo… (operation=turn_start gameId=game-42 tick=1 civilizationId=rome)`); **json** — uma linha JSON por evento, para pipelines de observabilidade (`LOG_FORMAT=json`).
- **Cada conexão WebSocket ganha um `requestId`** (gerado na conexão, não por comando) — toda a sequência de comandos de um cliente fica correlacionável no log, do `connect` ao `disconnect`. Todo comando processado gera uma linha (`operation` = a ação, `durationMs`); toda falha (`sendError`) também loga com o `errorCode` correspondente.
- O `AgentLogger` da Fase 13 (`CivilizationAgentFactory`) passou a delegar ao mesmo logger central — um único formato/pipeline para todo o backend, não dois.
- **ESLint** (`eslint.config.mjs`, flat config, cobre os 3 workspaces com um único arquivo na raiz): `npm run lint`. Achou 3 problemas reais na primeira execução — todos corrigidos: um ternário usado só pelo efeito colateral (`App.tsx`), um `setState` síncrono dentro de `useEffect` no modal de nova partida (corrigido adotando o padrão idiomático do React: o modal só monta enquanto está aberto, então os campos já nascem em branco sem precisar de um efeito resetando estado) e um import não utilizado.
- **Cobertura de testes** via `node --experimental-test-coverage` (`npm run test:coverage`): **98,7% de linhas** no backend.
- **+5 testes** do logger (pretty/json, erro sempre em `console.error`, ids únicos): **123 no total**.
- CI atualizado: **lint** roda antes do typecheck; os testes agora rodam com `--experimental-test-coverage` (relatório de cobertura visível em todo PR).

**Fase 16 — Empacotamento Docker e diagnóstico de ambiente (PRD §14):**
- **`npm run doctor`** (`scripts/doctor.mjs`, zero dependências): checa Node ≥ 20, se o runner escolhido (`RUNNER`) está disponível (CLI no `PATH`, ou Ollama respondendo em `OLLAMA_HOST`, ou `mock` que sempre funciona), se a porta `PORT` está livre e se `DATA_DIR` é gravável — imprime um resumo com ✓/⚠/✗ e sai com código 1 se houver bloqueio. Testado manualmente em 6 cenários (mock ok, CLI ok, runner inválido falha, porta ocupada avisa, Ollama inacessível falha, `DATA_DIR` sem permissão de escrita).
- **`Dockerfile`** multi-stage (`deps` → `build` → `backend`/`frontend`, um único arquivo, cache de `npm ci` em camada própria) e **`docker-compose.yml`** (dois serviços, `RUNNER=mock` por padrão, volume nomeado para `DATA_DIR`, `host.docker.internal` liberado para apontar para um Ollama rodando no host). Limitação assumida: `RUNNER=claude|codex|opencode` exige o CLI instalado dentro da imagem, fora do escopo desta fase — nessa imagem use `RUNNER=mock` ou `RUNNER=ollama` (host).
- **Verificação:** `docker compose config` validou a composição offline; o comportamento em runtime de cada alvo (`CMD` do backend e do frontend) foi validado rodando os mesmos comandos em containers `node:22-slim` com o `node_modules`/`dist` já resolvidos no host montados por bind mount, incluindo um fluxo E2E completo via Playwright/Chromium contra os dois containers reais (conectar → criar partida → avançar tick). O passo `docker compose build` (`npm ci` de dentro do container) não pôde ser exercitado de ponta a ponta *neste ambiente sandboxed* de verificação, por uma limitação de rede do proxy de saída específica deste sandbox (documentada em `/root/.ccr/README.md`) — não é uma limitação do `Dockerfile` em si, que segue o padrão multi-stage usual do Node; em uma máquina com acesso normal à internet o `docker compose up --build` funciona sem ajustes.

**Fase 14 — Conselheiros especialistas, opcional e ativável por civilização (§16 do PRD):**
- Cada `CivilizationDefinition` pode declarar `advisors: AdvisorRole[]` (`economic` | `diplomatic` | `military` | `scientific` | `historian`). Ausente/vazio = comportamento idêntico ao de antes desta fase — estritamente aditivo. **Prova de conceito:** só **Roma** vem com `["military", "economic"]` no catálogo padrão (`DEFAULT_CIVILIZATIONS`) — permite comparar, na mesma partida, uma civilização "com corte" e as demais sem (RF-10).
- Cada conselheiro ativo roda **1 chamada curta ao MESMO runner/modelo da civilização** (`apps/backend/src/agent/advisors.ts`), recebendo apenas o recorte do snapshot relevante à sua especialidade (ex.: o conselheiro militar não recebe o catálogo de tecnologias; o científico não recebe posições de exército). A confiança (`low`/`medium`/`high`) vem de um prefixo convencionado na resposta (`"[high]: recrute mais um exército…"`); se o runner não seguir o formato, cai para `medium` em vez de falhar — mesmo espírito de robustez do RF-3 (o `AgentRunner` continua com o mesmo contrato `{reasoning, actions}` de sempre, nenhuma mudança de interface).
- As recomendações da corte entram no prompt do agente principal como uma seção "Conselho da corte" **antes** da decisão (`buildTurnPrompt`) — o agente decide livremente se segue ou não. Falha de um conselheiro (timeout/JSON inválido) nunca derruba o turno; é só descartada.
- **UI:** as recomendações do turno aparecem tanto no Teatro de Decisões ("Conselho de guerra") quanto na Vista Evolução (EraInspector), com o papel do conselheiro e uma bolinha de confiança — reforça a transparência de raciocínio (RF-4).
- **+18 testes** cobrindo `advisors.ts` (parsing de confiança, truncamento, recorte por papel, falha isolada não derruba os demais), integração em `runTurn`/`prompt`/`CivilizationAgentFactory` e o fluxo com/sem conselheiros: **141 no total**. Verificado também via Playwright/Chromium contra o app real (Roma mostra o conselho, Egito — sem `advisors` — não mostra nada).

**Fase 17 — UI de auditoria: timeline paginada, painel em abas e "localizar no mapa" (§17 do PRD):**
- **`EventTimeline` paginada e filtrável** (RF-11): filtros por categoria (economia/construção/ciência/diplomacia/guerra/agentes/sistema — classificação puramente de apresentação sobre os `GameEvent.type` que já existem no motor, nenhuma categoria nova nele) com contagem por categoria, e paginação (20 eventos/página). O buffer de histórico mantido no cliente subiu de 60 para 200 eventos, já que agora dá para navegar por ele em vez de só rolar uma lista.
- **Painel de civilização em abas** (RF-12, `EraInspector`): Visão geral · Economia · Tecnologia · Diplomacia · Militar · Memória · Conversa. As abas Tecnologia/Diplomacia/Conversa reaproveitam os componentes já existentes (`TechTreePanel`/`DiplomacyGraph`/`AskCivilizationPanel`) em vez de duplicar UI; Economia/Militar/Memória são novas (cidades, exércitos e a memória estratégica bruta da civilização, nunca exibida antes). A aba ativa é lembrada por civilização.
- **"Localizar no mapa"** (RF-13): eventos com coordenadas (batalha, construção, movimento de exército) e itens do painel (cidades, exércitos) ganharam um link que troca para a Vista Mundo e desenha um anel tracejado no tile — o motor não tem câmera (o mapa inteiro sempre cabe na tela), então "localizar" chama a atenção do observador em vez de rolar/dar zoom.
- Verificado via Playwright/Chromium: filtros reduzem a lista corretamente, paginação aparece com 8 ticks de jogo, as 7 abas renderizam sem erro e a aba ativa persiste ao trocar de civilização, e "localizar no mapa" troca de vista e destaca o tile certo.

**Fase 18 — Guerra/ocupação ricas, balanceamento e acessibilidade (§18 do PRD):**
- **Ações militares diferenciadas** (RF-14): `move_army` para um tile de um inimigo em guerra (sem combate — ataque continua sendo uma ação à parte) emite `hostile_territory_entered`, distinto do `army_moved` simples; uma cidade capturada em batalha ganha `occupied: true` (produz para o ocupante desde já — resistência/revolta ficam fora do escopo desta fase); nova ação **`retreat_army`** recua um exército instantaneamente para a cidade própria mais próxima, sem combate.
- **Manutenção de exércitos** (RF-15): cada exército ativo custa 1 de ouro/tick (`ARMY_UPKEEP_GOLD`). Sem ouro suficiente, TODOS os exércitos da civilização perdem 1 de força naquele tick (evento `army_upkeep_shortfall`) em vez de travar a economia; um exército que chega a força 0 é desfeito (`army_disbanded`).
- **Balanceamento** (RF-16): a manutenção de exércitos É a passada de balanceamento desta fase — desestimula empilhar exércitos ociosos (que antes não tinham custo nenhum) sem precisar retunar toda a economia.
- **Acessibilidade** (RF-17/RNF-004): foco visível consistente nos dois temas (`:focus-visible` global, 3px, cor de destaque — a navegação por teclado já funcionava via `<button>` semânticos em todo o app, faltava só o indicador visual); `aria-live="polite"` na timeline (anuncia só o evento mais recente, não a lista inteira) e nos painéis de decisão/raciocínio; auditoria programática de contraste (WCAG AA, ≥4.5:1) contra `--panel-strong` nos dois temas — `--muted`/`--eyebrow`/`--faint` (claro) e `--faint` (escuro) estavam abaixo do limiar e foram ajustados, mantendo a paleta original.
- **+11 testes** de motor (entrada em território hostil, ocupação, `retreat_army`, manutenção com/sem ouro suficiente, desfazimento por falta de manutenção) e **+2** de validação de `retreat_army`: **153 no total**. `e2e/smoke.mjs` ganhou uma checagem permanente de acessibilidade (atalho de teclado sem mouse, foco visível, região `aria-live`). Verificado também via Playwright um fluxo completo de criação de partida **somente por teclado** (Tab/Enter, sem mouse).

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

Diagnóstico rápido do ambiente (Node, runner, porta, `DATA_DIR`) antes de rodar:

```bash
npm run doctor
```

### Docker (opcional)

Roda o projeto sem precisar de Node instalado no host — `RUNNER=mock` por padrão (sem LLM, sempre funciona):

```bash
docker compose up --build
# backend em http://localhost:8787, UI em http://localhost:5173
```

Para usar Ollama rodando no host (fora do container):

```bash
RUNNER=ollama OLLAMA_HOST=http://host.docker.internal:11434 docker compose up --build
```

`RUNNER=claude|codex|opencode` não funciona nesta imagem (o CLI não está instalado no container) — para esses runners use `npm run dev` local.

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
| `LOG_FORMAT` | `pretty` | `pretty` (legível no terminal) \| `json` (uma linha JSON por evento, RNF-003) |

## Estrutura

```
apps/
  backend/   Node + ws — AgentRunner, health check, servidor HTTP/WS
  frontend/  React + Vite — UI de observação (localhost)
docs/        PRD
data/        estado/memória/traces (gitignored)
logs/        logs (gitignored)
```
