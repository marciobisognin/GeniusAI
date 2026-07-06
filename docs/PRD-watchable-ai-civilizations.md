# PRD — "Watchable AI": Simulação de Civilizações com Agentes Autônomos (CLI-driven, Local-First)

> **Documento de Requisitos de Produto (PRD)**
> Como replicar a experiência da publicação analisada, com a camada de decisão **executada por um CLI de agente de codificação** (Claude Code, Codex, opencode ou outro) em modo headless no terminal. Todo o sistema, agentes, artefatos e a UI (design) são salvos em disco e servidos em `localhost`.
> Versão 2.1 (CLI-driven, local-first) · Data: 2026-07-06 · Status: Proposta

> **Evolução:** v1 usava a API da Anthropic (nuvem). v2 trocou por um LLM local (Ollama). **v2.1** generaliza a execução: cada agente é acionado por um **CLI de agente** (Claude Code / Codex / opencode / …) rodando em modo não-interativo. O runner é **plugável** — pode apontar para um modelo **local** (offline/privado, o modo preferido) ou para a nuvem, conforme a configuração do usuário. Toda a lógica de produto (motor, agentes, UI, roadmap) permanece; muda a camada de execução.

---

## 0. Fonte / Publicação analisada

- **Autor:** @0xMarioNawfal (via @RoundtableSpace) — publicação de 05/07/2026 no X.
- **Texto original (verbatim):**
  > *"Someone built a UI where AI agents play as entire civilizations, each one making its own decisions in real time. Rome, Egypt, Greece, Mali, all running their own decision trees. Is watchable AI the next interface, not chat windows?"*
- **Mídia:** vídeo (~46s) demonstrando uma interface de simulação onde múltiplas civilizações (Roma, Egito, Grécia, Mali) tomam decisões autônomas simultaneamente, em tempo real.
- **Ideia-chave / tese:** o paradigma de interface deixa de ser a **janela de chat** (o usuário comanda) e passa a ser a **IA observável** ("watchable AI"): o usuário **assiste** agentes autônomos raciocinando e agindo dentro de um sistema complexo.

O que precisamos replicar: **N agentes de IA autônomos, cada um com sua própria "árvore de decisão" (personalidade + estratégia + memória), agindo em tempo real sobre um mundo compartilhado, com o raciocínio de cada agente exposto para o observador** — e **tudo isso rodando localmente**.

---

## 0.1 Princípios de "Local-First" (restrições de projeto)

Estes princípios são requisitos não-negociáveis desta versão:

1. **Execução por CLI de agente:** a decisão de cada civilização é produzida acionando-se um **CLI de agente de codificação em modo headless** (ex.: `claude -p`, `codex exec`, `opencode run`) no terminal. O CLI é escolhido/configurado pelo usuário.
2. **Provedor plugável, local preferido:** o CLI pode ser apontado para um **modelo local** (ex.: opencode+Ollama, ou qualquer CLI atrás de um proxy local) — modo **offline/privado**, preferido — ou para a nuvem. O sistema não fixa um provedor.
3. **Offline-capable (no modo local):** com um modelo local baixado e as dependências instaladas, o sistema funciona **sem internet**.
4. **Tudo em disco, na máquina:** código, estado do mundo, memórias dos agentes, traces/replays e artefatos são salvos localmente (JSON/SQLite em `./data/`).
5. **Design/UI em localhost:** o frontend é servido localmente (ex.: `http://localhost:5173`); assets embutidos, sem dependência externa em runtime.
6. **Operável pelo terminal:** o sistema é iniciado e controlado pela CLI (`npm run dev`; comandos de iniciar/pausar/step da simulação).

---

## 1. Resumo Executivo

**GeniusAI Civilizations** — uma simulação onde cada civilização é controlada por um **agente autônomo acionado por um CLI de agente** (Claude Code / Codex / opencode / …) em modo headless. Os agentes tomam decisões de construção, pesquisa, diplomacia, comércio e guerra a cada "turno" (tick), sobre um mundo compartilhado. A tela principal **não é um chat**: é um painel, servido em localhost, onde o usuário observa em tempo real o mundo evoluindo e o raciocínio de cada civilização.

O diferencial: **as decisões são geradas acionando-se um CLI de agente no terminal** (que pode apontar para um modelo local — via Ollama/llama.cpp — ou nuvem, conforme a config do usuário), recebendo o estado do mundo, a personalidade da civilização e seu histórico, e respondendo com ações estruturadas (JSON validado por schema). Comportamento emergente, imprevisível, "assistível" — e, no modo local, privado/offline.

**Meta do MVP:** 4 civilizações autônomas (Roma, Egito, Grécia, Mali), mundo simples de recursos/território, loop de simulação com raciocínio transparente, UI de observação em tempo real, **tudo local**.

---

## 2. Objetivos e Não-Objetivos

### 2.1 Objetivos
1. Rodar **≥4 agentes de IA locais** simultâneos, cada um governando uma civilização de forma autônoma.
2. Expor o **raciocínio** de cada agente em streaming — a essência do "watchable AI".
3. Loop de simulação **determinístico no motor, não-determinístico nas decisões**.
4. UI de **observação em tempo real** em localhost (não de comando).
5. **Rodar offline** após setup, com desempenho aceitável em hardware de consumidor.

### 2.2 Não-Objetivos (fora do MVP)
- Uso de qualquer API de LLM em nuvem.
- Multiplayer humano / humano jogando contra a IA.
- Gráficos 3D / engine de jogo pesada.
- Balanceamento profundo de game design.
- Deploy remoto / hospedagem (o produto é para rodar na máquina do usuário).

---

## 3. Personas / Público-alvo

| Persona | Necessidade | Como o produto atende |
|---|---|---|
| **Espectador curioso** | Ver IA "pensando" e agindo sozinha, localmente | Modo observação; play/pause/velocidade em localhost |
| **Pesquisador / dev de IA local** | Estudar comportamento multiagente com modelos abertos, offline e privado | Logs de raciocínio, traces em disco, troca de modelos/personas |
| **Criador de conteúdo** | Gerar clipes narrativos sem custo de API | Replay determinístico, timelapse, eventos narrados |

---

## 4. Visão do Produto / Experiência ("Watchable AI")

Três zonas na tela principal (servida em localhost):

1. **Mundo (centro):** mapa/grid com territórios, cidades, recursos e unidades por civilização (cores distintas). Atualiza a cada tick.
2. **Painéis das civilizações (laterais):** um card por civilização com bandeira/nome, métricas (população, ouro, tecnologia, território, relações) e o **fluxo de raciocínio em streaming** do agente local.
3. **Linha do tempo / feed de eventos (rodapé):** eventos globais narrados ("Roma declarou guerra à Grécia", "Mali descobriu Escrita").

Controles do observador: **play / pause / velocidade / step / focar civilização / replay**. Não há botão para comandar uma civilização.

---

## 5. Requisitos Funcionais

### RF-1 — Motor de Simulação (World Engine)
- Estado do mundo autoritativo: mapa (grid de tiles), recursos, civilizações, unidades, tecnologias, relações.
- Avança em **ticks discretos**. Cada tick: coleta ações dos agentes → valida → aplica → resolve conflitos → emite eventos → publica novo estado.
- Regras determinísticas em código — **não** delegadas ao LLM.

### RF-2 — Agentes de Civilização (LLM local)
- Cada civilização é um **agente de LLM local autônomo** com:
  - **System prompt de personalidade/estratégia** (Roma = expansionista militarista; Egito = defensiva/comercial; Grécia = científica/cultural; Mali = mercantil/diplomática).
  - **Ações possíveis** expostas como **schema JSON** (structured output) e/ou tools (ver RF-3).
  - **Contexto por turno:** estado do mundo, estado próprio, histórico recente, resultados das últimas ações.
  - **Memória:** um arquivo por civilização em disco (ex.: `./data/memory/rome.md`) que o agente lê e atualiza.
- O agente decide **1..N ações por turno** e produz raciocínio explicável.

### RF-3 — Ações estruturadas (structured output / tool use)
Ações mínimas, representadas por um **JSON schema** que o modelo local é forçado a seguir (via `format` do Ollama) — mais confiável que tool-calling em modelos pequenos:
- `build(structure, tile)`, `research(technology)`, `move_army(from,to)` / `attack(tile)`,
  `set_diplomacy(civ, stance)`, `trade(civ, offer, request)`, `set_strategy(note)`.
- O **motor valida** cada ação; retorna resultado (inclusive erros) para o agente no próximo turno, permitindo autocorreção.
- **Fallback obrigatório:** se o JSON vier inválido/fora do schema, re-perguntar 1×; se falhar de novo, a civilização "passa o turno". A simulação nunca trava por causa de um modelo local imperfeito.

### RF-4 — Transparência de Raciocínio (streaming)
- O raciocínio (tokens do modelo e/ou um campo `reasoning` curto por ação) é **transmitido em streaming** do backend para a UI, por civilização.
- Cada ação carrega um "porquê" legível.

### RF-5 — Orquestração / Loop
- Um **Orquestrador** coordena os turnos. Como a inferência local é sequencial-limitada por VRAM, o padrão do MVP é **turnos sequenciais** (uma civilização por vez, mesmo modelo carregado) — com opção de paralelismo se houver VRAM/instâncias suficientes.
- Controla velocidade, pausa, step, timeout por turno e teto de tokens (`num_predict`).

### RF-6 — Informação / "Fog of War" (opcional no MVP)
- Config: visão global (MVP) ou apenas o descoberto pela civilização (fase 2).

### RF-7 — UI de Observação (localhost)
- Render do mundo, painéis com raciocínio em streaming, feed de eventos, controles de reprodução, foco/replay. **Sem recursos externos** (fontes/imagens embutidas).

### RF-8 — Persistência (disco local)
- Salvar/carregar estado do mundo + memórias em `./data/`. Export de trace da partida (JSON) para clipes/análise. Sem banco em nuvem.

---

## 6. Requisitos Não-Funcionais

- **Offline:** após setup (baixar modelo + `npm install`), funciona sem internet.
- **Privacidade:** nenhum dado sai da máquina.
- **Desempenho local:** um tick (4 civs) deve completar em segundos-a-dezenas-de-segundos, dependendo do modelo/hardware; UI atualiza incrementalmente via streaming. A **velocidade da simulação é limitada pela inferência local** — projetar a UI para tornar a espera "assistível" (mostrar o thinking enquanto processa).
- **Robustez:** falha/timeout/JSON inválido de um agente não trava a simulação (fallback "passar o turno").
- **Determinismo do motor:** mesmo conjunto de ações + seed → mesmo resultado (essencial para replay). O LLM é a fonte de não-determinismo; o motor é determinístico.
- **Observabilidade:** logs em disco por request (modelo, tokens, tempo, ação escolhida, validade do JSON).
- **Portabilidade de hardware:** funcionar em GPU de consumidor e degradar graciosamente para CPU (modelo menor).

---

## 7. Arquitetura Técnica (local-first)

```
┌──────────────────────────────────────────────────────────────┐
│              Frontend (React + TS) — http://localhost:5173    │
│   Mapa/Estado · Painéis de raciocínio (stream) · Timeline     │
│              controles: play/pause/velocidade                 │
└───────────────▲──────────────────────────┬───────────────────┘
                │ WebSocket (estado +       │ streaming de tokens)
                │                           ▼
┌───────────────┴──────────────────────────────────────────────┐
│         Backend (Node.js + TypeScript) — localhost            │
│                                                               │
│   ┌────────────────┐   snapshot   ┌────────────────────────┐  │
│   │  World Engine  │─────────────▶│      Orquestrador      │  │
│   │ (determinístico│◀─── ações ───│  (loop de ticks, budget│  │
│   │  em disco)     │              └───────────┬────────────┘  │
│   └────────────────┘                          │ 1 agente/civ  │
│                                               ▼               │
│                         ┌───────────────────────────────────┐ │
│                         │ Agentes → AgentRunner (plugável)  │ │
│                         │ system + schema JSON + memória    │ │
│                         │ Roma · Egito · Grécia · Mali      │ │
│                         └───────────────┬───────────────────┘ │
└──────────────────────────────────────────┼────────────────────┘
                        spawn CLI headless  │  ou HTTP
                                            ▼
        claude -p / codex exec / opencode run   —OU—   Ollama :11434
                    (provedor plugável · dados em ./data/)
```

### 7.1 Stack recomendada
- **Runner de decisão (primário):** um **CLI de agente em modo headless**, atrás da interface `AgentRunner` (ver §7.3). Implementações: `ClaudeCodeRunner` (`claude -p --output-format json`), `CodexRunner` (`codex exec`), `OpencodeRunner` (`opencode run`). O CLI escolhido roda como subprocesso, recebe o prompt do turno e devolve JSON.
- **Runner alternativo (direto):** **Ollama** (`ollama serve` em `localhost:11434`) via HTTP, sem passar por um CLI de agente — útil para máxima velocidade/controle. Também atrás de `AgentRunner`.
  - *Outros back-ends de modelo:* llama.cpp (`llama-server`), LM Studio, vLLM — acessíveis por qualquer CLI que os suporte ou pelo runner Ollama-compatível.
- **Backend:** Node.js + TypeScript. Cliente: pacote oficial **`ollama`** (npm) ou o SDK da OpenAI apontado para `http://localhost:11434/v1` (Ollama expõe endpoint compatível). WebSocket (`ws`) para tempo real.
- **Frontend:** React + TypeScript + Vite (dev server em localhost). Mapa em Canvas/SVG (ou PixiJS). Tailwind. **Assets embutidos** (sem CDN).
- **Persistência:** JSON em `./data/` no MVP (SQLite local na fase 2).

### 7.2 Camada de Agentes — decisões via CLI de agente (headless)

Cada turno, para cada civilização, o backend invoca o **runner configurado** (um CLI de agente em modo headless, ou o Ollama direto) pedindo **saída estruturada em JSON** (mecanismo primário — mais robusto que tool-calling em modelos locais):

- **Prompt do sistema** (estável): regras do jogo + descrição das ações + personalidade da civilização. Mantê-lo estável entre turnos favorece cache de prompt/KV do back-end.
- **Prompt do turno** (volátil): snapshot do mundo (JSON compacto), estado próprio, resultados do último turno, memória atual.
- **Contrato de saída:** exigir no prompt **apenas** um JSON aderente ao schema de ações; quando o CLI suportar, usar `--output-format json`/modo estruturado. Validar sempre com `zod`.
- **Streaming:** ler stdout do subprocesso incrementalmente para exibir o raciocínio na UI.
- **Limites:** timeout por turno, teto de saída e cancelamento do processo se estourar.

> Exemplo (TypeScript — runner que aciona um CLI de agente em headless):
> ```ts
> import { spawn } from "node:child_process";
>
> // Comando configurável por env, ex.:
> //   claude   -p --output-format json
> //   codex    exec
> //   opencode run
> function runCliAgent(cmd: string, args: string[], prompt: string,
>                      onToken: (t: string) => void, timeoutMs = 60_000): Promise<string> {
>   return new Promise((resolve, reject) => {
>     const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
>     let out = "";
>     const t = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("timeout")); }, timeoutMs);
>     child.stdout.on("data", (d) => { const s = d.toString(); out += s; onToken(s); });
>     child.on("error", reject);
>     child.on("close", () => { clearTimeout(t); resolve(out); });
>     child.stdin.write(prompt);   // envia o prompt do turno via stdin
>     child.stdin.end();
>   });
> }
> // → extrair o JSON da saída → zod.parse(ACTION_SCHEMA) → VALIDAR no World Engine
> // → se inválido: re-perguntar 1x; se falhar de novo: "passar o turno".
> ```
> Regras: sempre extrair/`JSON.parse` + validar com `zod` antes de aplicar; nunca confiar cegamente na saída. Devolver erros de validação como contexto no próximo turno (autocorreção). O runner **Ollama-direto** (§7.3) é a alternativa: fala HTTP com `localhost:11434` usando `format` (JSON schema) — mesmo contrato de saída.

### 7.3 Interface de troca de runner (`AgentRunner`)
Interface fina para não acoplar a um CLI/back-end específico:
```ts
interface AgentRunner {
  name: string;
  healthy(): Promise<boolean>;               // o runner configurado responde?
  decide(input: { system: string; user: string; schema: object;
                  onToken?: (t: string) => void; timeoutMs?: number }): Promise<AgentDecision>;
}
// Implementações:
//   ClaudeCodeRunner → spawn("claude", ["-p","--output-format","json"])
//   CodexRunner      → spawn("codex", ["exec"])
//   OpencodeRunner   → spawn("opencode", ["run"])
//   OllamaRunner     → HTTP POST localhost:11434/api/chat (format = JSON schema)
// Selecionada por env RUNNER=claude|codex|opencode|ollama (+ AGENT_CMD p/ override).
```

---

## 8. Desempenho, Modelos e Hardware (substitui "custo de API")

Sem custo de API — o gargalo agora é **desempenho local** e **hardware**. Alavancas:

1. **Escolha de modelo (equilíbrio capacidade × velocidade × VRAM).** Priorizar modelos com bom suporte a JSON/tools:
   - **Recomendado (decisões):** `qwen2.5:14b` ou `llama3.3` (bom raciocínio e aderência a JSON).
   - **Hardware modesto:** `qwen2.5:7b` / `llama3.1:8b` (quantização `Q4_K_M`).
   - **CPU-only / muito leve:** `qwen2.5:3b` (qualidade menor; ainda "assistível").
   - **Narrador de eventos** (manchetes do feed): um modelo pequeno e rápido.
2. **Reaproveitar KV-cache do prefixo estável:** manter regras+persona no `system` **inalteradas** entre turnos → menor tempo de prompt-eval no Ollama. Colocar o que muda (snapshot) sempre depois.
3. **Manter o modelo carregado:** `keep_alive` alto para evitar recarregar pesos a cada turno.
4. **Controlar contexto e saída:** `num_ctx` só o necessário; snapshot do mundo **compacto**; `num_predict` curto (a decisão é pequena).
5. **Quantização:** `Q4_K_M`/`Q5_K_M` para caber em GPU de consumidor com boa qualidade.
6. **Paralelismo consciente:** com VRAM sobrando, rodar 2+ civilizações em paralelo (múltiplas requisições/instâncias); senão, sequencial.

**Referência de hardware (aprox., quantizado Q4):** 3B ≈ 3–4 GB · 7–8B ≈ 6–8 GB · 14B ≈ 10–12 GB · 32B ≈ 20–24 GB de VRAM/RAM. CPU-only funciona com modelos pequenos, porém mais lento — projetar a UI para tornar a espera parte do espetáculo (mostrar o thinking).

---

## 9. Modelo de Dados (esboço) — persistido em `./data/`

```ts
type World = {
  tick: number; seed: number;
  map: Tile[][];                                   // terreno, recurso, dono
  civilizations: Record<CivId, Civilization>;
  diplomacy: Record<`${CivId}:${CivId}`, Stance>;  // peace|war|alliance|trade
  events: GameEvent[];
};

type Civilization = {
  id: CivId;                    // "rome" | "egypt" | "greece" | "mali"
  persona: string;             // system prompt de personalidade
  resources: { gold: number; food: number; science: number };
  tech: string[]; cities: City[]; armies: Army[];
  memory: string;              // ./data/memory/<civ>.md — lido/atualizado pelo agente
};

type AgentDecision = {
  civ: CivId; tick: number;
  reasoning: string;           // resumo do raciocínio (para a UI)
  actions: ToolCall[];         // ações escolhidas
  raw?: string;                // saída bruta do modelo (para debug/trace)
};
```
Layout em disco: `./data/saves/<partida>.json`, `./data/memory/<civ>.md`, `./data/traces/<partida>.jsonl`, `./logs/`.

---

## 10. Plano de Implementação **com um CLI de codificação (local ou Claude Code)**

Você pode construir o projeto com o Claude Code/Codex **ou** com um agente de codificação local (ex.: `aider` apontado para o Ollama). O produto final, porém, roda 100% local.

### Fase 0 — Setup (0,5 dia)
- Ter ao menos um runner disponível: um CLI de agente (`claude`, `codex` ou `opencode`) **ou** Ollama (`ollama pull qwen2.5:14b`).
- Monorepo TS: `apps/backend` (Node + `ws`) e `apps/frontend` (React/Vite). `.env` local (`RUNNER`, `AGENT_CMD`, `MODEL`).
- **Prompt:** *"Crie um monorepo TypeScript com backend Node (WebSocket) e frontend React/Vite. No backend, defina a interface `AgentRunner` com implementações `ClaudeCodeRunner`/`CodexRunner`/`OpencodeRunner` (spawn de CLI headless) e `OllamaRunner` (HTTP). Selecione por env `RUNNER`. Health check que confirma que o runner configurado responde."*

### Fase 1 — World Engine determinístico + testes (1–2 dias)
- Estado, tiles, recursos, regras (produção, crescimento, combate), tick, eventos. Testes unitários. **Sem LLM.**

### Fase 2 — Camada de Agentes local (2–3 dias)
- `LLMClient` + schema de ações (`format`) + system prompt/personas + `runCivilizationTurn(world, civId)`.
- Validação com `zod`, fallback (re-perguntar 1×, senão passar o turno), atualização de memória em disco.
- **Prompt:** *"Implemente `runCivilizationTurn` usando o OllamaClient com `format` (JSON schema das ações), streaming de tokens, validação `zod` e fallback de turno. Salve/atualize a memória da civilização em ./data/memory."*

### Fase 3 — Orquestrador + Loop (1–2 dias)
- Ticks sequenciais (padrão local), timeout por turno, `keep_alive`, budget de tokens, tratamento de erro. Streaming de progresso.

### Fase 4 — UI de Observação em localhost (2–3 dias)
- WebSocket back→front (estado + tokens de raciocínio por civilização). Mapa, painéis com thinking ao vivo, feed de eventos, controles de reprodução. **Assets embutidos, nada externo.**

### Fase 5 — Persistência, Replay, Polimento (1–2 dias)
- Salvar/carregar em `./data/`, export de trace, replay determinístico, narrador de eventos (modelo pequeno local).

> **Dicas:**
> - Isole o runtime atrás de `LLMClient` desde o início (troca Ollama↔llama.cpp sem refatorar).
> - Modelos locais erram JSON: `format`+`zod`+fallback são obrigatórios, não opcionais.
> - Comite por fase, com testes verdes. Use a skill **`verify`** para exercitar o loop de simulação de ponta a ponta antes de commitar.

---

## 11. Marcos / Roadmap

| Marco | Entregável | Critério de aceite |
|---|---|---|
| M0 | Ollama respondendo + monorepo | `LLMClient` conversa com o modelo local; health OK |
| M1 | World Engine + testes | Aplicar ações a um snapshot é determinístico e testado |
| M2 | 1 agente local decide e age | Modelo local produz ações válidas (schema) + raciocínio; fallback funciona |
| M3 | Loop 4 civs | 4 civilizações rodam N ticks sem travar, offline |
| M4 | UI observável em localhost | Usuário assiste mundo + raciocínio em tempo real |
| M5 | Persistência/replay | Salvar/carregar e reproduzir uma partida em disco |

---

## 12. Métricas de Sucesso

- **Engajamento:** tempo médio de observação por sessão.
- **Emergência:** nº de eventos "surpreendentes" por partida (alianças/traições não roteirizadas).
- **Confiabilidade do modelo local:** % de turnos com JSON válido de primeira (meta: alta o suficiente para o fallback ser raro).
- **Robustez:** % de turnos sem erro/timeout que travem a simulação (meta: 100% — sempre há fallback).
- **Desempenho:** tempo médio de tick por modelo/hardware (medir e documentar por preset).

---

## 13. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Modelo local produz JSON inválido/alucina ações | Alto | `format` (JSON schema) + validação `zod` + re-pergunta + fallback "passar o turno" |
| Inferência local lenta → simulação arrastada | Alto | Modelo/quantização menores, `keep_alive`, KV-cache do prefixo estável, snapshot compacto, `num_predict` curto; UI que torna a espera assistível |
| Hardware insuficiente (VRAM) | Médio | Presets por hardware (3B/7B/14B/32B); degradar para CPU + modelo pequeno |
| Comportamento repetitivo/"chato" | Médio | Personas fortes/distintas, memória persistente, eventos aleatórios (seca, peste), `temperature` moderada |
| Contexto crescente em partidas longas | Médio | Snapshot compacto + memória resumida; resumir histórico antigo |
| Acoplamento a um runtime específico | Baixo | Interface `LLMClient` isolando Ollama/llama.cpp/LM Studio |
| Vazamento de rede acidental (quebrar o "local") | Médio | Sem SDKs de nuvem; assets embutidos; teste que falha se houver chamada externa |

---

## 14. Considerações Técnicas de LLM Local (fixar no time)

- **Runner:** um CLI de agente headless (`claude -p` / `codex exec` / `opencode run`) ou Ollama direto (`localhost:11434`), tudo atrás de `AgentRunner` e selecionado por env `RUNNER`.
- **Provedor/modelo:** escolha do usuário via o CLI/config. Modo local preferido (ex.: opencode+Ollama, `qwen2.5:14b`; presets `7b`/`8b` p/ hardware modesto, `3b` p/ CPU). Escolher modelos com bom suporte a JSON.
- **Saída estruturada:** usar `format` (JSON schema) como mecanismo primário das ações; tool-calling só para modelos fortes. **Sempre** validar com `zod` antes de aplicar.
- **KV-cache:** manter `system` (regras+persona) byte-idêntico entre turnos; volátil (snapshot) sempre depois. `keep_alive` alto para não recarregar pesos.
- **Contexto/saída:** `num_ctx` mínimo necessário, snapshot compacto, `num_predict` curto.
- **Streaming:** obrigatório para expor raciocínio ao vivo na UI.
- **Robustez:** timeout por turno + re-pergunta + fallback "passar o turno". Nada trava por causa do modelo.
- **Offline/privacidade:** nenhuma dependência de rede em runtime; testar sem internet.

---

## 15. Anexo — Prompt inicial sugerido para o agente de codificação

> "Vamos construir **GeniusAI Civilizations**, uma simulação 'watchable AI': 4 civilizações (Roma, Egito, Grécia, Mali) são agentes acionados por um **CLI de agente headless** (`claude -p` / `codex exec` / `opencode run`) ou por Ollama, tomando decisões em tempo real sobre um mundo compartilhado; o usuário **assiste** por uma UI em localhost (sem comandar). Provedor plugável, local preferido; estado/memória/trace em `./data/`. Comece pela **Fase 0** (`docs/PRD-watchable-ai-civilizations.md`): monorepo TypeScript (backend Node + WebSocket, frontend React/Vite), a interface `AgentRunner` com implementações de CLI e Ollama selecionadas por env, e um health check. Depois seguimos para o World Engine determinístico (Fase 1) com testes, sem LLM."

---

*Fim do PRD v2.0 (local-first).*
