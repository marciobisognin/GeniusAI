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

## 16. PRD — Fase 14: Conselheiros Especialistas (opcional, ativável)

### 16.1 Contexto
A Fase 13 introduziu o `CivilizationAgentFactory`: cada civilização já nasce de uma `CivilizationDefinition` explícita (personalidade, prioridades, tolerância a risco, estilo diplomático, modelo próprio) e um `AgentOrchestrator` que a registra. Hoje, porém, a decisão do turno é **monolítica**: um único agente lê o snapshot do mundo e decide todas as ações. Esta fase adiciona uma camada opcional de **conselheiros especialistas** que recomendam antes do agente principal decidir — sem tornar o fluxo obrigatório nem quebrar o caminho hoje testado (RUNNER=mock, CLIs, Ollama).

### 16.2 Objetivo
Dar à civilização uma "corte" de conselheiros (econômico, diplomático, militar, científico, historiador) cujas recomendações — curtas, com um "porquê" — entram no prompt do agente principal antes da decisão final, aumentando a qualidade e a explicabilidade das escolhas sem multiplicar o custo de inferência de forma descontrolada.

### 16.3 Requisitos Funcionais

**RF-9 — Conselheiros especialistas**
- Cada `CivilizationDefinition` ganha um campo opcional `advisors?: AdvisorRole[]` (`"economic" | "diplomatic" | "military" | "scientific" | "historian"`). Ausente ou vazio = comportamento atual (sem conselheiros), preservando compatibilidade com toda partida já jogável.
- Cada conselheiro ativo roda **1 chamada curta ao mesmo runner da civilização** (mesmo `AgentRunner`, mesmo modelo — não é um segundo provedor), recebendo um recorte do snapshot do mundo relevante à sua especialidade (ex.: o conselheiro militar não recebe detalhes de pesquisa) e devolvendo uma recomendação estruturada: `{ role, recommendation: string (≤280 chars), confidence: "low"|"medium"|"high" }`, validada por `zod` com o mesmo padrão de fallback do RF-3 (se o conselheiro falhar/retornar JSON inválido, sua recomendação é descartada — **nunca bloqueia o turno**).
- As recomendações coletadas (0..N) são anexadas ao `buildTurnPrompt` do agente principal como uma seção "Conselho da corte", antes da decisão. O agente principal permanece livre para segui-las ou não — a decisão final é sempre dele.
- A UI (Teatro de Decisões e painel de civilização) exibe as recomendações do turno, com o conselheiro autor de cada uma — reforçando a "transparência de raciocínio" do RF-4.
- Fallback obrigatório: se **todos** os conselheiros de uma civilização falharem, o turno prossegue exatamente como hoje (sem seção de conselho no prompt) — este recurso é estritamente aditivo.

**RF-10 — Ativação por civilização (não é global)**
- A flag é por `CivilizationDefinition`, não um env var único — permite comparar, na mesma partida, uma civilização "com corte" e outra sem, o que é também uma forma natural de validar o recurso.

### 16.4 Requisitos Não-Funcionais
- **Custo de inferência controlado:** N conselheiros ativos = até N chamadas extras de LLM por turno daquela civilização. Deve ser possível, olhando os logs estruturados (RNF-003), medir o `durationMs` agregado de conselheiros vs. decisão principal, para o usuário avaliar se vale o custo no seu hardware.
- **Timeout independente:** cada conselheiro tem seu próprio timeout (reaproveitando `TURN_TIMEOUT_MS` ou uma fração dele) — um conselheiro lento não deve estourar o orçamento de tempo do turno inteiro.
- **Robustez:** nenhuma falha de conselheiro deve ser visível como erro fatal ao usuário; degrada silenciosamente (loga `warn`, segue sem a recomendação).

### 16.5 Modelo de dados (extensão)
```ts
type AdvisorRole = "economic" | "diplomatic" | "military" | "scientific" | "historian";

type AdvisorRecommendation = {
  role: AdvisorRole;
  recommendation: string;     // ≤280 chars
  confidence: "low" | "medium" | "high";
};

// CivilizationDefinition (Fase 13) ganha:
//   advisors?: AdvisorRole[];

// AgentDecision (§9) ganha, opcionalmente:
//   advisorRecommendations?: AdvisorRecommendation[];
```

### 16.6 Critérios de aceite
- Uma civilização sem `advisors` definido decide exatamente como hoje (nenhuma regressão em partidas existentes / testes atuais).
- Uma civilização com `advisors: ["military"]` gera, a cada turno, no máximo 1 recomendação militar visível na UI antes da decisão, e a decisão final ainda passa por toda a validação de ações existente (RF-3).
- Com `RUNNER=mock`, os conselheiros também respondem de forma determinística (mock precisa cobrir o novo tipo de chamada), para manter os testes E2E sem dependência de LLM real.
- Falha simulada de um conselheiro (ex.: JSON inválido) não derruba o turno nem aparece como `error` para o usuário — aparece no log como `warn`.

### 16.7 Fora de escopo
- Conselheiros não têm memória própria nem histórico entre turnos (ficam de fora até uma fase futura, se houver demanda).
- Não há UI dedicada para configurar conselheiros dinamicamente durante a partida — a definição é fixada na criação da partida (tela de criação, RF-010).

---

## 17. PRD — Fase 17: UI de Auditoria (timeline paginada, filtros e painel em abas)

### 17.1 Contexto
A `EventTimeline` hoje mostra uma lista simples com os últimos eventos do `state.timeline`, sem paginação nem filtro por tipo. O painel de civilização (`EraInspector`/`CrisisPanel`/`ChroniclePanel` etc., em `App.tsx`) mistura visão geral, economia, tecnologia, diplomacia, militar e memória numa única superfície. Em partidas curtas com `RUNNER=mock` isso não incomoda, mas em partidas longas com LLM real — o cenário que este produto foi desenhado para "assistir" — auditar por que uma civilização tomou uma decisão específica há dezenas de ticks fica difícil.

### 17.2 Objetivo
Tornar a simulação **auditável** sem sair da UI: encontrar rapidamente um evento antigo por tipo/categoria, e navegar o estado de uma civilização por assunto (não uma parede única de informação).

### 17.3 Requisitos Funcionais

**RF-11 — Timeline paginada e filtrável**
- A `EventTimeline` passa a paginar (ex.: 20–30 eventos por página, navegação anterior/próxima), em vez de depender apenas do corte implícito de `state.timeline`.
- Filtro por categoria: `economia | construção | ciência | diplomacia | guerra | agentes | sistema` (mapeadas a partir dos `GameEvent.type` já existentes no motor — nenhuma categoria nova é inventada no motor, é uma classificação puramente de apresentação). Filtros combináveis (múltipla seleção), com contagem de eventos por categoria visível.
- O estado do filtro/página é local à sessão da UI (não precisa persistir entre partidas).

**RF-12 — Painel de civilização em abas**
- O painel de civilização selecionada ganha navegação em abas: **Visão geral · Economia · Tecnologia · Diplomacia · Militar · Memória · Conversa**. Cada aba reaproveita dados já existentes no `world`/`state` (nenhum novo endpoint de backend é necessário só para isto) — é uma reorganização de apresentação, não uma nova fonte de dados.
- A aba ativa é lembrada por civilização enquanto a partida está aberta (trocar de civilização selecionada não reseta a aba escolhida).

**RF-13 — "Localizar no mapa"**
- Eventos e itens do painel (cidade, exército, tile em disputa) ganham um botão/link "localizar no mapa" que centraliza e destaca o tile correspondente no `WorldMap` (canvas). Não requer mudança no motor — só leitura de coordenadas já presentes no evento/estado.

### 17.4 Requisitos Não-Funcionais
- **Sem regressão de performance:** paginação e filtros são client-side sobre dados já entregues por WebSocket; não devem introduzir novas rodadas de rede por interação de filtro/página.
- **Compatível com o tema duplo** (claro/escuro) e o design system existente (`styles.css`) — nenhuma nova paleta de cores paralela.
- **Continua "watchable":** abrir uma aba ou paginar a timeline não deve pausar nem atrasar o loop de simulação em andamento.

### 17.5 Critérios de aceite
- Com uma partida de 60+ eventos, o filtro por categoria "guerra" mostra somente eventos de batalha/movimentação militar, e a paginação permite alcançar o evento mais antigo sem scroll infinito.
- Selecionar uma civilização e navegar para a aba "Militar" mostra exércitos/tiles daquela civilização; trocar para outra civilização e voltar preserva a aba "Militar" selecionada.
- Clicar em "localizar no mapa" a partir de um evento de batalha centraliza o `WorldMap` no tile correto (verificável via E2E/Playwright, análogo ao smoke test existente).

### 17.6 Fora de escopo
- Busca textual livre na timeline (fica para uma iteração futura, se necessário).
- Exportação filtrada de trace (o RF-8 de export completo já existe e não muda nesta fase).

---

## 18. PRD — Fase 18: Guerra/Ocupação Ricas, Balanceamento e Acessibilidade

### 18.1 Contexto
O combate hoje (`engine.ts`, ações `move_army`/`attack`) resolve um ataque como um único evento `battle` com rolagem de dados e vencedor — sem diferenciar deslocamento pacífico, entrada em território hostil, ocupação após vitória ou retirada, e sem custo de manutenção para exércitos parados. Em paralelo, o produto nunca recebeu uma auditoria de acessibilidade (RNF novo, não coberto pela seção 6 original do PRD).

### 18.2 Objetivo
Dar profundidade estratégica ao componente militar (decisões de guerra deixam de ser binárias "atacar/não atacar") e garantir que a UI seja utilizável por teclado e por usuários com necessidades de acessibilidade — sem quebrar o determinismo do motor (RNF já existente).

### 18.3 Requisitos Funcionais

**RF-14 — Ações militares diferenciadas**
- `move_army` para tile neutro/próprio permanece deslocamento simples (comportamento atual).
- `move_army` para tile de território hostil sem defensor passa a gerar um evento distinto de **entrada em território hostil** (ainda sem combate), preparando o terreno para ocupação.
- `attack` continua resolvendo combate determinístico (RNG seedado, sem mudança de comportamento estatístico), mas o evento resultante passa a carregar também a consequência territorial: vitória do atacante sobre um tile com cidade pode iniciar **ocupação** (tile passa a produzir para o ocupante, com possível resistência/eventos de revolta em iterações futuras — fora de escopo aqui além do registro do estado de ocupação).
- Nova ação de motor `retreat_army(armyId)`: retira um exército de território hostil/ocupado sem combate, encerrando a ocupação daquele exército quando aplicável. Segue o mesmo padrão de validação de ações do RF-3 (ação inválida → `action_rejected`, nunca exceção).

**RF-15 — Manutenção de exércitos**
- Cada exército ativo passa a consumir uma manutenção periódica (ouro e/ou comida, valor a calibrar no balanceamento) por tick. Civilização sem recursos para sustentar seus exércitos sofre penalidade determinística (ex.: redução de força), nunca um crash ou estado inconsistente.

**RF-16 — Passada de balanceamento**
- Revisão dos parâmetros de economia/combate/pesquisa (§8 do PRD) para que partidas de referência (mock e LLM real) não convirjam trivialmente para um único vencedor previsível — critério de aceite é qualitativo (via partidas de teste), documentado nos resultados desta fase.

**RF-17 — Acessibilidade (RNF-004)**
- Navegação por teclado completa: toda ação hoje só alcançável por clique (play/pause/step, seleção de civilização, abas do RF-12, filtros do RF-11) precisa ter equivalente de teclado com foco visível.
- Contraste de cores auditado contra **WCAG AA** nos dois temas (claro/escuro) já existentes — sem introduzir uma terceira paleta.
- `aria-live` nas regiões de eventos ao vivo (timeline, feed de raciocínio em streaming) para leitores de tela acompanharem a simulação "assistível" sem depender só de visão.
- Foco visível (outline) consistente em todos os elementos interativos, incluindo o `WorldMap` (canvas) quando navegável por teclado.

### 18.4 Requisitos Não-Funcionais
- **RNF-004 — Acessibilidade:** critérios acima (teclado, WCAG AA, `aria-live`, foco visível) tratados como requisito de aceite desta fase, não "nice to have".
- **Determinismo preservado:** as novas ações (`retreat_army`, ocupação, manutenção) continuam puras/determinísticas dado `(world, ações, seed)` — sem introduzir nenhuma fonte de aleatoriedade fora do `Rng` já existente.
- **Sem quebra de saves antigos:** partidas salvas antes desta fase devem carregar (mesmo que exércitos "ganhem" manutenção só a partir do primeiro tick pós-upgrade — migração aditiva, não destrutiva).

### 18.5 Critérios de aceite
- Testes de motor cobrindo: deslocamento simples, entrada em território hostil, ataque com ocupação resultante, `retreat_army`, e exército sem recursos sofrendo a penalidade de manutenção — todos determinísticos (mesma seed + mesmas ações → mesmo resultado).
- Auditoria manual (ou automatizada, ex. `axe-core` num teste E2E) de contraste AA nos dois temas, sem violações críticas.
- Fluxo completo de uma partida jogável **somente por teclado** (sem mouse), verificado via Playwright com navegação por `Tab`/`Enter`/setas.

### 18.6 Fora de escopo
- Sistema de revolta/insatisfação em território ocupado (fica para além desta fase — hoje só registra o estado de ocupação).
- Diplomacia de guerra mais rica (pedidos de paz condicionais, reparações) — fora do escopo aqui, é extensão do RF-3 existente.

---

## 19. PRD — Fase 19: Validação com LLM real e streaming de raciocínio visível

### 19.1 Contexto
Da Fase 0 até a Fase 18, toda verificação de ponta a ponta usou `RUNNER=mock` (decisões determinísticas, sem LLM). É a escolha certa para testes/CI, mas nunca prova que o produto funciona com um runner real — e o `RUNNER=claude` (`claude -p`) tem dois problemas arquiteturais nunca exercitados: (1) o "system prompt" da civilização é apenas concatenado dentro do texto enviado por stdin, então cada turno paga o **system prompt padrão inteiro do Claude Code** (identidade de agente de codificação, lista de ferramentas, ~33k tokens em cache) em vez de só a persona da civilização — caro e semanticamente errado; (2) `--output-format json` só entrega o resultado completo no final — o `onToken` do `AgentRunner` nunca recebe fragmentos reais, então o "streaming de raciocínio" do RF-4 nunca existiu de verdade para este runner, só para o mock (que também manda tudo de uma vez).

### 19.2 Objetivo
Provar que o produto funciona com um LLM real, corrigir o que quebrar, e entregar de verdade o RF-4 ("Transparência de Raciocínio"): o observador vê o texto do raciocínio da civilização aparecendo token a token, não um contador de fragmentos.

### 19.3 Requisitos Funcionais

**RF-18 — `--system-prompt` nativo em vez de concatenado no stdin**
- `CliAgentRunner` ganha uma opção `systemPromptFlag` (ex.: `"--system-prompt"`). Quando definida, `input.system` vai como argumento de CLI dedicado — o texto enviado por stdin carrega só `user` + instruções de schema, nunca a persona. `RUNNER=claude` passa a usar `--system-prompt` (substitui o prompt padrão do Claude Code por inteiro, não `--append-system-prompt`).
- Runners sem essa opção (`codex`, `opencode`) mantêm o comportamento atual (system concatenado no prompt) — mudança aditiva, não quebra os outros runners.

**RF-19 — Streaming real via `stream-json`**
- `RUNNER=claude` passa a usar `--output-format stream-json --include-partial-messages` em vez de `--output-format json`. A saída é NDJSON (uma linha por evento); o runner interpreta linha a linha e chama `onToken` só para eventos `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":...}}}`, repassando o texto incremental real do modelo.
- O resultado final continua vindo da linha `{"type":"result",...,"result":"<texto completo>"}` — o parsing final (`parseDecision`) não muda, só a origem do texto/tokens intermediários.
- Falha ao interpretar uma linha do stream não derruba o turno (mesmo espírito do RF-3): a linha é ignorada e o runner segue esperando a linha `result`.

**RF-20 — UI mostra o texto do raciocínio ao vivo**
- Hoje a UI só mostra "O agente está deliberando… N fragmento(s)" enquanto pensa. Passa a acumular e exibir o texto recebido via `turn_token` em tempo real (mesmo painel onde a decisão final aparece), substituído pelo `reasoning` definitivo só quando o turno termina.

### 19.4 Requisitos Não-Funcionais
- **Custo/latência:** eliminar o system prompt padrão do Claude Code do caminho de decisão reduz tokens de entrada por turno de forma substancial — medido e registrado no resultado da verificação desta fase (não é só uma alegação).
- **Robustez preservada:** o fallback do RF-3 (re-perguntar 1×, depois passar o turno) continua funcionando idêntico com o novo formato de saída — timeout/JSON inválido/processo morto ainda caem no mesmo caminho.
- **Sem novo runner:** nenhuma dependência nova; só como o `RUNNER=claude` já existente invoca o CLI.

### 19.5 Critérios de aceite
- Uma partida real (`RUNNER=claude`, poucos ticks) roda sem exceção não tratada, com pelo menos um turno de cada civilização decidindo com sucesso.
- Comparação antes/depois: tokens de entrada por chamada com o system prompt antigo (concatenado) vs. o novo (`--system-prompt`) — queda documentada.
- `onToken` recebe mais de um fragmento por turno numa chamada real (prova de streaming de verdade, não só o texto inteiro de uma vez).
- Testes automatizados (com um runner fake que simula a saída NDJSON de `stream-json`) cobrindo: parsing de deltas, ignorar linhas malformadas, `--system-prompt` sendo passado como argumento separado.

### 19.6 Fora de escopo
- Streaming real para `codex`/`opencode` (mantém o comportamento atual — nenhum dos dois CLIs foi confirmado como suportando um formato equivalente nesta fase).
- Uso de `--json-schema` nativo do Claude Code (o schema já embutido no prompt continua sendo a fonte de verdade; usar o parâmetro nativo fica para uma fase futura, se necessário).

---

## 20. PRD — Fase 20: Fog of War (RF-6)

### 20.1 Contexto
O RF-6 do PRD original já previa dois modos: visão global (MVP, o que existe hoje) e visão limitada ao descoberto (fase 2, nunca implementada). Hoje `snapshotForCiv` entrega a TODOS os agentes o estado completo de todas as civilizações — cada IA sabe onde estão os exércitos e cidades de todo mundo, mesmo sem nunca ter "visto" aquele território. Isso simplifica o motor mas elimina qualquer incerteza estratégica real.

### 20.2 Objetivo
Cada civilização só conhece o que já foi revelado (seu próprio território + raio de visão de cidades/exércitos): decisões passam a lidar com informação incompleta, e a UI ganha um modo "assistir como" que mostra a névoa de guerra de uma civilização específica.

### 20.3 Requisitos Funcionais

**RF-21 — Descoberta de tiles**
- `Civilization` ganha `discovered: Set<string>` (chaves `"x,y"`) — persistido no `World` (serializável). Cidades e exércitos revelam tiles num raio fixo ao redor de sua posição a cada tick (raio configurável, ex. 2). Uma vez descoberto, um tile nunca "esquece" (sem névoa dinâmica que se refecha — simplicidade deliberada nesta fase).
- `snapshotForCiv` (prompt do agente) passa a filtrar: `others[].cities`/`others[].armies` só aparecem se a posição estiver em `discovered`; tiles do mapa fora de `discovered` não aparecem em `you.tiles` de outras civilizações.

**RF-22 — Config: visão global vs. limitada**
- Flag por partida (`GameLoopOptions.fogOfWar?: boolean`, padrão `false` = comportamento atual preservado) — parte do mesmo mecanismo de opt-in já usado por `advisors` (Fase 14), sem quebrar nenhuma partida/teste existente.

**RF-23 — UI: "assistir como" com névoa**
- Na Vista Mundo, ao selecionar uma civilização com `fogOfWar` ativo, tiles fora de `discovered` daquela civilização aparecem escurecidos/hachurados no `WorldMap` — o observador vê exatamente a informação que a IA daquela civilização tem, reforçando o "watchable".

### 20.4 Requisitos Não-Funcionais
- **Determinismo preservado:** descoberta é função pura de posições de cidades/exércitos a cada tick — mesma seed + mesmas ações → mesmo conjunto `discovered`.
- **Compatibilidade:** partidas salvas antes desta fase carregam com `discovered` vazio + hidratação retroativa (recalculado a partir de cidades/exércitos atuais no primeiro tick pós-upgrade) — sem quebrar saves antigos.

### 20.5 Critérios de aceite
- Teste de motor: uma civilização nunca viu o território de outra → `snapshotForCiv` para ela não contém as cidades/exércitos daquela civilização; após um exército passar perto, o tile passa a aparecer.
- Partida com `fogOfWar: true` jogável de ponta a ponta com `RUNNER=mock` sem exceções.
- Verificação visual (Playwright) do mapa com névoa aplicada ao trocar de civilização selecionada.

### 20.6 Fora de escopo
- Névoa dinâmica (tiles "esquecidos" quando não há mais unidade por perto).
- Espionagem ativa ou ações dedicadas a revelar território à força.

---

## 21. PRD — Fase 21: Replay e exportação de partidas

### 21.1 Contexto
Desde a Fase 5, cada tick é gravado em `./data/traces/<gameId>.jsonl` (decisões + eventos + narração). O motor é determinístico por construção (§6 do PRD) exatamente para viabilizar replay — mas isso nunca virou uma feature: hoje o trace só é lido para reconstruir o estado de reconexão (`summarizeTrace`), nunca para reassistir uma partida.

### 21.2 Objetivo
Transformar uma partida encerrada (ou em andamento) em um artefato reassistível: um modo replay que reconstrói o mundo tick a tick a partir do trace gravado, com controles de reprodução — sem LLM, sem custo, sem esperar inferência.

### 21.3 Requisitos Funcionais

**RF-24 — Backend: reconstrução de replay a partir do trace**
- Novo comando `{ type: "command", action: "replay", gameId }`: carrega o trace completo (`readTrace`) e devolve ao cliente a sequência de `world` reconstruído tick a tick, aplicando `tick(world, decisions)` do motor (o MESMO código de produção — reafirma o determinismo, não uma segunda implementação paralela) a partir do save inicial (seed).
- Novo tipo de mensagem `ServerMessage` (`{ type: "replay_ready", ticks: World[] }` ou streaming tick a tick, a decidir na implementação) — reaproveita `DisplayEvent`/`GameEvent` já existentes.

**RF-25 — UI: modo replay com scrubber**
- Nova vista (ou modo dentro de uma vista existente) com: barra de progresso/scrubber por tick, play/pause sobre o histórico (velocidade ajustável, reaproveitando os controles existentes), navegação livre (ir direto a um tick). Deixa claro visualmente que é um replay, não a partida ao vivo (banner/indicador).

**RF-26 — Exportação**
- Botão "exportar partida": baixa o trace (`.jsonl`) já gravado — RF-8 do PRD original ("export de trace da partida para clipes/análise") finalmente exposto na UI, sem reinventar o formato.

### 21.4 Requisitos Não-Funcionais
- **Sem custo de inferência:** replay nunca invoca `AgentRunner` — é reconstrução pura a partir de decisões já gravadas.
- **Fiel ao motor real:** a reconstrução usa exatamente `tick()` do motor de produção; qualquer divergência entre replay e o que de fato aconteceu é, por definição, um bug a corrigir, não uma segunda verdade.

### 21.5 Critérios de aceite
- Reconstruir uma partida gravada produz, tick a tick, o MESMO `World` que está persistido em `saves/<gameId>.json` no tick final (prova de fidelidade determinística).
- Replay de uma partida de referência funciona de ponta a ponta na UI (scrubber, play/pause, navegação livre), verificado via Playwright.
- Exportação baixa um arquivo `.jsonl` válido e não vazio para uma partida com histórico.

### 21.6 Fora de escopo
- Replay ao vivo de uma partida em andamento (só partidas com trace já gravado, mesmo que parcial).
- Edição/anotação do replay (marcadores, cortes) — é visualização, não um editor.

---

*Fim do PRD v2.0 (local-first).*
