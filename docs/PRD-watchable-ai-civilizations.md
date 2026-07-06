# PRD — "Watchable AI": Simulação de Civilizações com Agentes Autônomos

> **Documento de Requisitos de Produto (PRD)**
> Como replicar, usando **Claude Code**, a experiência mostrada na publicação analisada.
> Versão 1.0 · Data: 2026-07-06 · Status: Proposta

---

## 0. Fonte / Publicação analisada

- **Autor:** @0xMarioNawfal (via @RoundtableSpace) — publicação de 05/07/2026 no X.
- **Texto original (verbatim):**
  > *"Someone built a UI where AI agents play as entire civilizations, each one making its own decisions in real time. Rome, Egypt, Greece, Mali, all running their own decision trees. Is watchable AI the next interface, not chat windows?"*
- **Mídia:** vídeo (~46s) demonstrando uma interface de simulação onde múltiplas civilizações (Roma, Egito, Grécia, Mali) tomam decisões autônomas simultaneamente, em tempo real.
- **Ideia-chave / tese:** o paradigma de interface deixa de ser a **janela de chat** (o usuário comanda) e passa a ser a **IA observável** ("watchable AI"): o usuário **assiste** agentes autônomos raciocinando e agindo dentro de um sistema complexo.

O que precisamos replicar não é um jogo de estratégia clássico, e sim: **N agentes de IA autônomos, cada um com sua própria "árvore de decisão" (personalidade + estratégia + memória), agindo em tempo real sobre um mundo compartilhado, com o raciocínio de cada agente exposto para o observador.**

---

## 1. Resumo Executivo

Vamos construir **GeniusAI Civilizations** — uma simulação onde cada civilização é controlada por um **agente Claude autônomo**. Os agentes tomam decisões de construção, pesquisa, diplomacia, comércio e guerra a cada "turno" (tick), sobre um mapa/estado de mundo compartilhado. A tela principal **não é um chat**: é um painel onde o usuário observa, em tempo real, o mundo evoluindo e o raciocínio (streaming de "thinking") de cada civilização.

O diferencial em relação a um jogo tradicional é que **as decisões não são scripts nem heurísticas fixas** — são geradas por um LLM que recebe o estado do mundo, a personalidade da civilização e seu histórico, e responde com ações estruturadas (tool calls). Isso produz comportamento emergente, imprevisível e "assistível".

**Meta do MVP:** 4 civilizações autônomas (Roma, Egito, Grécia, Mali), um mundo simples de recursos/território, loop de simulação com raciocínio transparente, e uma UI de observação em tempo real.

---

## 2. Objetivos e Não-Objetivos

### 2.1 Objetivos
1. Rodar **≥4 agentes de IA** simultâneos, cada um governando uma civilização de forma autônoma.
2. Expor o **raciocínio** de cada agente ("por que estou fazendo isso") em streaming — a essência do "watchable AI".
3. Loop de simulação **determinístico no motor, não-determinístico nas decisões** (o motor aplica regras; o agente escolhe ações).
4. UI de **observação em tempo real** (não de comando): mapa/estado + painel de raciocínio por civilização + linha do tempo de eventos.
5. Custo de API controlado e previsível (via prompt caching e escolha de modelo por tarefa).

### 2.2 Não-Objetivos (fora do MVP)
- Multiplayer humano / o humano jogando contra a IA.
- Gráficos 3D / engine de jogo pesada (Unity, Unreal).
- Balanceamento profundo de game design / árvore tecnológica completa.
- Persistência de longo prazo entre sessões (além de salvar/carregar uma partida).

---

## 3. Personas / Público-alvo

| Persona | Necessidade | Como o produto atende |
|---|---|---|
| **Espectador curioso** | Ver IA "pensando" e agindo sozinha, sem operar nada | Modo observação puro; play/pause/velocidade |
| **Pesquisador de IA / dev** | Estudar comportamento emergente multiagente | Logs de raciocínio, export de traces, ajuste de personalidades |
| **Criador de conteúdo** | Gerar clipes curtos e narrativos (como o post original) | Câmera/replay, eventos narrados, timelapse |

---

## 4. Visão do Produto / Experiência ("Watchable AI")

A tela principal tem três zonas:

1. **Mundo (centro):** mapa/grid mostrando territórios, cidades, recursos e unidades de cada civilização (cores distintas). Atualiza a cada tick.
2. **Painéis das civilizações (laterais):** um card por civilização com: bandeira/nome, métricas (população, ouro, tecnologia, território, relações), e o **fluxo de raciocínio em streaming** do agente ("Estou expandindo para o sul porque o Egito enfraqueceu na fronteira leste…").
3. **Linha do tempo / feed de eventos (rodapé):** eventos globais narrados ("Roma declarou guerra à Grécia", "Mali descobriu Escrita", "Aliança Egito–Grécia formada").

Controles do observador: **play / pause / velocidade (0.5×–4×) / step (1 tick) / focar civilização / replay**. Não há botão para "comandar" uma civilização — o usuário observa.

---

## 5. Requisitos Funcionais

### RF-1 — Motor de Simulação (World Engine)
- Mantém o **estado do mundo** autoritativo: mapa (grid de tiles), recursos, civilizações, unidades, tecnologias, relações diplomáticas.
- Avança em **ticks discretos** (ex.: 1 tick = 1 "ano/estação"). Cada tick: coleta ações dos agentes → valida → aplica → resolve conflitos → emite eventos → publica novo estado.
- Regras determinísticas (crescimento populacional, produção, combate) implementadas em código — **não** delegadas ao LLM.

### RF-2 — Agentes de Civilização
- Cada civilização é um **agente Claude autônomo** com:
  - **System prompt de personalidade/estratégia** (ex.: Roma = expansionista militarista; Egito = defensiva e comercial; Grécia = científica/cultural; Mali = mercantil/diplomática).
  - **Ferramentas (tools)** que representam as ações possíveis (ver RF-3).
  - **Contexto por turno:** visão do estado do mundo (parcial ou total, ver RF-6), estado próprio, histórico recente, resultados das últimas ações.
  - **Memória:** um "diário/estratégia" persistente que o agente lê e atualiza (ex.: arquivo/registro de memória por civilização).
- O agente decide **1..N ações por turno** e produz raciocínio explicável.

### RF-3 — Ferramentas de Ação (tool use)
Conjunto mínimo de tools estruturadas (JSON schema, `strict: true`):
- `build(structure, tile)` — construir cidade/estrutura.
- `research(technology)` — investir em tecnologia.
- `move_army(from, to)` / `attack(target_tile)` — militar.
- `set_diplomacy(civ, stance)` — aliança/paz/guerra/comércio.
- `trade(civ, offer, request)` — proposta comercial.
- `set_strategy(note)` — atualizar a memória/estratégia de longo prazo.
O **motor valida** cada ação (recursos suficientes? tile adjacente? etc.) e retorna resultado como `tool_result` (inclusive erros, com `is_error: true`) para o agente aprender no próximo turno.

### RF-4 — Transparência de Raciocínio (streaming)
- O `thinking` (adaptativo, `display: "summarized"`) e/ou uma justificativa curta de cada ação são **transmitidos em streaming** para a UI, por civilização.
- Cada ação registrada carrega um "porquê" legível para humanos.

### RF-5 — Orquestração / Loop
- Um **Orquestrador** coordena os turnos: pode rodar agentes **em paralelo** (todos decidem sobre o mesmo snapshot) e depois resolver simultaneamente, ou em ordem (round-robin). MVP: paralelo por tick.
- Controla velocidade, pausa, e limita gasto (nº máximo de tokens/turno via *task budget*).

### RF-6 — Informação / "Fog of War" (opcional no MVP)
- Config: agentes veem o **estado global** (mais simples, MVP) ou apenas o que sua civilização "descobriu" (mais rico, fase 2).

### RF-7 — UI de Observação
- Render do mundo, painéis por civilização com raciocínio em streaming, feed de eventos, controles de reprodução, foco/replay.

### RF-8 — Persistência
- Salvar/carregar estado do mundo + memórias dos agentes (JSON). Export de "trace" da partida (para clipes/análise).

---

## 6. Requisitos Não-Funcionais

- **Tempo real percebido:** um tick completo (4 agentes) deve resolver em poucos segundos na velocidade padrão; UI atualiza incrementalmente via streaming.
- **Custo previsível:** gasto por tick monitorado e limitado; uso agressivo de **prompt caching** para o estado compartilhado e regras (ver §8).
- **Robustez:** falha/timeout de um agente não trava a simulação (fallback: "civilização passa o turno").
- **Determinismo do motor:** dado o mesmo conjunto de ações + seed, o motor produz o mesmo resultado (importante para replay).
- **Observabilidade:** logs estruturados de cada request (model, tokens, cache hits, ação escolhida).

---

## 7. Arquitetura Técnica (proposta)

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React + TS)                  │
│   Mapa/Estado · Painéis de raciocínio (stream) · Timeline     │
│              controles: play/pause/velocidade                 │
└───────────────▲──────────────────────────┬───────────────────┘
                │ WebSocket / SSE (estado + │ streaming de thinking)
                │                           ▼
┌───────────────┴──────────────────────────────────────────────┐
│                    Backend (Node.js + TypeScript)             │
│                                                               │
│   ┌────────────────┐   snapshot   ┌────────────────────────┐  │
│   │  World Engine  │─────────────▶│      Orquestrador      │  │
│   │ (regras/estado │◀─── ações ───│ (loop de ticks, budget)│  │
│   │  determinístico│              └───────────┬────────────┘  │
│   └────────────────┘                          │ 1 agente/civ  │
│                                               ▼               │
│                         ┌───────────────────────────────────┐ │
│                         │  Agentes (Anthropic SDK)          │ │
│                         │  system prompt + tools + memória  │ │
│                         │  Roma · Egito · Grécia · Mali     │ │
│                         └───────────────────────────────────┘ │
└──────────────────────────────────┬───────────────────────────┘
                                    ▼
                        Claude API (api.anthropic.com)
```

### 7.1 Stack recomendada
- **Backend:** Node.js + TypeScript, `@anthropic-ai/sdk`. (Motivo: mesmo tipo em front e back, streaming/tool-runner de primeira classe, WebSocket trivial.)
- **Frontend:** React + TypeScript + Vite. Render do mapa com Canvas/SVG (ou PixiJS se quiser mais unidades animadas). Tailwind para UI. Estado via WebSocket/SSE.
- **Transporte tempo real:** WebSocket (bidirecional: controles → back; estado + thinking → front).
- **Persistência:** JSON em disco no MVP (SQLite/Postgres na fase 2).

### 7.2 Camada de Agentes — decisões de LLM

Cada turno, para cada civilização, o backend chama a Claude API com **tool use**:

- **`system`** (estável, cacheado): regras do jogo + descrição das tools + personalidade da civilização.
- **`messages`** (volátil): snapshot do estado do mundo (JSON), estado próprio, resultados do último turno, e a memória/estratégia atual.
- **Tools:** as ações do RF-3, com `strict: true` para garantir JSON válido.
- **Thinking:** `thinking: {type: "adaptive", display: "summarized"}` para expor o raciocínio.
- **Task budget** (beta): teto de tokens por turno para pacing e custo.

Modelo default recomendado: **`claude-opus-4-8`** para decisões (mais capaz e coerente em horizonte longo). Para reduzir custo em alta frequência de ticks, ver §8 (estratégia por camada).

> Exemplo (TypeScript, esqueleto de um turno de agente):
> ```ts
> import Anthropic from "@anthropic-ai/sdk";
> const client = new Anthropic();
>
> const tools /* : civilization action tools, strict:true */ = [...];
>
> const res = await client.beta.messages.create({
>   model: "claude-opus-4-8",
>   max_tokens: 4000,
>   thinking: { type: "adaptive", display: "summarized" },
>   betas: ["task-budgets-2026-03-13"],
>   output_config: { effort: "medium", task_budget: { type: "tokens", total: 8000 } },
>   system: [
>     { type: "text", text: GAME_RULES_AND_TOOLS },              // estável
>     { type: "text", text: CIV_PERSONA[civId],
>       cache_control: { type: "ephemeral" } },                  // estável por civ → cacheado
>   ],
>   messages: [
>     { role: "user", content: [
>       { type: "text", text: worldSnapshotJson },               // volátil (muda por tick)
>       { type: "text", text: ownStateAndMemory },
>       { type: "text", text: lastTurnResults },
>     ]},
>   ],
>   tools,
> });
> // parse tool_use blocks → validar no World Engine → aplicar → devolver tool_result no próximo turno
> ```
> Observação: `budget_tokens` NÃO existe mais nesses modelos — usar `thinking: {type:"adaptive"}` + `effort`. Sempre fazer `JSON.parse` das inputs de tool (nunca casar string crua).

---

## 8. Estratégia de Custo e Modelos

Multiagente + muitos ticks = muitas chamadas de LLM. Três alavancas:

1. **Prompt caching (crítico).** As **regras do jogo + descrição das tools + persona da civilização** são estáveis → colocá-las no início do `system` com `cache_control: {type:"ephemeral"}`. O que muda por tick (snapshot do mundo) vai **depois** do breakpoint. Leituras de cache custam ~10% do preço de input → economia enorme em simulações longas. Validar via `usage.cache_read_input_tokens`.
2. **Modelo por camada (tiered):**
   - **Decisões das civilizações:** `claude-opus-4-8` (default; melhor coerência de longo prazo) — ou `claude-sonnet-5` para reduzir custo em alto volume mantendo boa qualidade.
   - **Turnos "de rotina"/baixo risco:** `claude-haiku-4-5` (mais barato e rápido) quando a civilização não está em situação crítica.
   - **Narrador/Diretor de eventos** (gera as manchetes do feed): `claude-haiku-4-5`.
3. **Task budgets + effort:** teto de tokens por turno (`task_budget`) e `effort: "low"|"medium"` para turnos triviais, reservando `high` para decisões críticas (guerra iminente, etc.).

> Preços de referência (por 1M tokens, input/output): Opus 4.8 $5/$25 · Sonnet 5 $3/$15 (intro $2/$10 até 31/08/2026) · Haiku 4.5 $1/$5. Com caching, a maior parte do input por turno é cache-read (~0,1×).

**Orçamento estimado (ilustrativo):** 4 civs × 100 ticks × ~1 chamada/civ = 400 chamadas. Com system cacheado (~2–4k tokens de cache-read) e ~1–2k tokens voláteis + saída curta, o custo por partida fica na faixa de **poucos dólares** em Sonnet/Haiku e mais alto em Opus — medir com `count_tokens` e ajustar o mix.

---

## 9. Modelo de Dados (esboço)

```ts
type World = {
  tick: number;
  seed: number;
  map: Tile[][];                 // terreno, recurso, dono
  civilizations: Record<CivId, Civilization>;
  diplomacy: Record<`${CivId}:${CivId}`, Stance>; // peace|war|alliance|trade
  events: GameEvent[];
};

type Civilization = {
  id: CivId;                     // "rome" | "egypt" | "greece" | "mali"
  persona: string;              // system prompt de personalidade
  resources: { gold: number; food: number; science: number };
  tech: string[];
  cities: City[]; armies: Army[];
  memory: string;               // "diário/estratégia" que o agente lê e atualiza
};

type AgentDecision = {
  civ: CivId; tick: number;
  reasoning: string;            // resumo do thinking (para a UI)
  actions: ToolCall[];          // ações escolhidas
};
```

---

## 10. Plano de Implementação **com Claude Code**

O objetivo é usar o Claude Code (CLI/IDE) como ferramenta de construção. Sugestão de fases e de como delegar:

### Fase 0 — Bootstrap (0,5 dia)
- `Scaffold` do monorepo: `apps/backend` (Node/TS + Anthropic SDK) e `apps/frontend` (React/Vite/TS).
- Config de `.env` (`ANTHROPIC_API_KEY`), lint, tsconfig.
- **Prompt ao Claude Code:** *"Crie um monorepo TypeScript com backend Node (WebSocket) e frontend React/Vite. Adicione o Anthropic SDK no backend e um endpoint de health."*

### Fase 1 — World Engine (1–2 dias)
- Estado do mundo, tiles, recursos, regras determinísticas (produção, crescimento, combate), avanço de tick, emissão de eventos. **Testes unitários** do motor.
- **Prompt:** *"Implemente o World Engine determinístico com testes: aplicar um conjunto de ações a um snapshot produz o próximo estado. Nada de LLM aqui."*

### Fase 2 — Camada de Agentes + Tools (2–3 dias)
- Definir as tools (JSON schema, `strict:true`), o system prompt base + personas, o wrapper de chamada à Claude API com **caching** e **thinking**.
- Loop de turno de UM agente end-to-end; validar ações no motor; devolver `tool_result`.
- **Prompt:** *"Implemente `runCivilizationTurn(world, civId)` usando o Anthropic SDK com tool use estruturado (strict), thinking adaptativo summarized, e prompt caching do system. Consulte a skill claude-api para os parâmetros corretos."*

### Fase 3 — Orquestrador + Loop de Simulação (1–2 dias)
- Rodar as 4 civilizações por tick (paralelo), resolver simultaneamente, aplicar budget/pacing, tratar timeout/erro (fallback "passar o turno").
- **Prompt:** *"Implemente o Orquestrador: para cada tick, chama os 4 agentes em paralelo sobre o mesmo snapshot, coleta ações, resolve no World Engine, emite eventos, e faz stream do progresso."*

### Fase 4 — Streaming + UI de Observação (2–3 dias)
- WebSocket back→front com estado + streaming de thinking por civilização.
- React: mapa (Canvas/SVG), painéis com raciocínio ao vivo, feed de eventos, controles play/pause/velocidade.
- **Prompt:** *"Crie a UI de observação: mapa, 4 painéis de civilização com o thinking em streaming, feed de eventos, e controles de reprodução. Sem botões de comando — só observação."*

### Fase 5 — Persistência, Replay, Polimento (1–2 dias)
- Salvar/carregar partida + memórias; export de trace; replay determinístico; narrador de eventos (Haiku).

> **Dicas de uso do Claude Code:**
> - Rode a skill **`claude-api`** antes de escrever qualquer código que chame o modelo — evita erros de parâmetros (ex.: `budget_tokens` foi removido; use `thinking:{type:"adaptive"}`).
> - Use **subagentes** para paralelizar trabalho independente (ex.: um cuida do World Engine + testes, outro da UI).
> - Use a skill **`verify`** para exercitar o loop de simulação de ponta a ponta antes de commitar.
> - Comite por fase, com testes verdes.

---

## 11. Marcos / Roadmap

| Marco | Entregável | Critério de aceite |
|---|---|---|
| M1 | World Engine + testes | Aplicar ações a um snapshot é determinístico e testado |
| M2 | 1 agente decide e age | Um agente Claude produz ações válidas + raciocínio |
| M3 | Loop 4 civs | 4 civilizações rodam N ticks sem travar; fallback em falha |
| M4 | UI observável (MVP) | Usuário assiste mundo + raciocínio em tempo real |
| M5 | Persistência/replay | Salvar/carregar e reproduzir uma partida |

---

## 12. Métricas de Sucesso

- **Engajamento:** tempo médio de observação por sessão (proxy de "é assistível?").
- **Emergência:** nº de eventos "surpreendentes" por partida (alianças/traições não roteirizadas).
- **Custo:** US$/partida e % de tokens servidos por cache (meta: >70% cache-read no input).
- **Confiabilidade:** % de turnos sem erro/timeout de agente (meta: >98%).
- **Latência:** tempo de tick na velocidade padrão (meta: ≤ poucos segundos p/ 4 civs).

---

## 13. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Custo de API cresce com ticks/civs | Alto | Prompt caching agressivo, modelos por camada, task budgets, `effort` baixo em turnos triviais |
| Ações inválidas/alucinadas do LLM | Médio | `strict:true` nas tools + validação no motor + `tool_result` com `is_error` para o agente corrigir |
| JSON de tool com escaping diferente | Baixo | Sempre `JSON.parse`, nunca casar string crua |
| Agente trava/timeout | Médio | Timeout por turno + fallback "passar o turno"; simulação nunca depende de 1 agente |
| Comportamento "chato"/repetitivo | Médio | Personas fortes e distintas, memória persistente, injeção de eventos aleatórios (seca, peste) |
| Contexto crescente (partidas longas) | Médio | Enviar snapshot compacto + memória resumida; compaction/context editing na fase 2 |

---

## 14. Considerações Técnicas de LLM (fixar no time)

- **Modelos:** default `claude-opus-4-8` para decisões; `claude-sonnet-5` / `claude-haiku-4-5` para reduzir custo por camada. Usar os **IDs exatos**.
- **Thinking:** `thinking: {type:"adaptive", display:"summarized"}` (esses modelos **não** aceitam `budget_tokens`; um `type:"disabled"` explícito não é necessário).
- **Tools:** `strict: true`, resultados paralelos em **uma** mensagem `user`, e devolver `is_error: true` em falhas de validação.
- **Caching:** ordem `tools → system → messages`; conteúdo estável (regras, tools, persona) antes do breakpoint; snapshot volátil depois. Verificar `usage.cache_read_input_tokens`.
- **Streaming:** obrigatório para expor raciocínio e para `max_tokens` altos.
- **Task budgets** (beta `task-budgets-2026-03-13`): teto de tokens por turno para pacing/custo.

---

## 15. Anexo — Prompt inicial sugerido para o Claude Code

> "Vamos construir **GeniusAI Civilizations**, uma simulação 'watchable AI' onde 4 civilizações (Roma, Egito, Grécia, Mali) são agentes Claude autônomos que tomam decisões em tempo real sobre um mundo compartilhado, e o usuário **assiste** (sem comandar). Comece pela Fase 1 deste PRD (`docs/PRD-watchable-ai-civilizations.md`): implemente o World Engine determinístico em TypeScript com testes. Não chame o LLM ainda. Depois seguimos para a camada de agentes usando a skill `claude-api` para os parâmetros corretos do Anthropic SDK."

---

*Fim do PRD v1.0.*
