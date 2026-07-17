# GeniusAI Foresight — Product Requirements Document

> **Origem:** PRD consolidado em 2026-07-17 a partir da inspeção do repositório `marciobisognin/GeniusAI`, da metodologia científica de forecasting e da especificação matemática de Teoria dos Jogos.

**Status:** aprovado por Marcio para implementação e publicação
**Versão:** 1.0
**Produto:** `geniusai-foresight`
**Local proposto:** diretório irmão de `geniusai-civilizations` no repositório GeniusAI
**Restrição central:** integrar-se ao repositório sem modificar o comportamento, os contratos, os dados ou o runtime do produto existente.

---

## Documentos científicos normativos

Este PRD é complementado por dois documentos canônicos e obrigatórios:

1. [`docs/METODOLOGIA-CIENTIFICA.md`](docs/METODOLOGIA-CIENTIFICA.md) — evidence ledger bitemporal, inferência causal, modelos Bayesianos, HMM, particle filters, VAR/SVAR, ABM, Monte Carlo, MCTS, calibração, backtesting e governança de risco.
2. [`docs/METODOLOGIA-TEORIA-DOS-JOGOS.md`](docs/METODOLOGIA-TEORIA-DOS-JOGOS.md) — jogos normais/extensivos/Bayesianos/repetidos/estocásticos, Nash, equilíbrios correlacionados, coalizões, Shapley, barganha, Stackelberg, QRE, regret, CFR, replicator dynamics, mean-field e MARL.

Em caso de conflito, segurança, rastreabilidade de evidências e contenção epistemológica prevalecem sobre conveniência narrativa.

---

## 1. Resumo executivo

O `geniusai-foresight` será um laboratório local-first de prospectiva computacional. O sistema permitirá modelar países, organizações e mercados como atores dinâmicos; construir perfis sustentados por evidências; executar simulações temporais em múltiplas escalas; explorar árvores de cenários; combinar deliberação de agentes com adaptadores quantitativos determinísticos; reproduzir qualquer execução; calibrar previsões; e gerar relatórios auditáveis.

A recomendação é **não transformar o `geniusai-civilizations` em uma plataforma genérica**. O novo produto deve nascer isolado em `geniusai-foresight/`, com seu próprio monorepo, contratos, portas, diretório de dados, scripts e pipeline de CI. O código atual permanece intacto e continua testado como produto independente.

O reuso ocorrerá em três níveis:

1. **Reuso de padrões já comprovados:** `AgentRunner`, validação Zod, fallback de agente, loop serializado, eventos WebSocket, trace JSONL, replay determinístico, escrita atômica, segurança de identificadores e UI de Teatro de Decisões.
2. **Portabilidade controlada de implementações estáveis:** copiar e generalizar runners/mock/logger para um pacote próprio do Foresight, com proveniência e testes de paridade, sem imports cruzados para arquivos internos do Civilizations.
3. **Extração compartilhada futura e opcional:** somente após os dois produtos estabilizarem, uma ADR separada poderá propor um pacote raiz compartilhado. Essa extração não faz parte do MVP e não é condição para o Foresight.

O núcleo arquitetural deve separar claramente:

- fatos e evidências;
- estado quantitativo;
- deliberação de agentes;
- regras determinísticas;
- incerteza e cenários;
- narrativa e relatórios.

O LLM poderá propor interpretações, hipóteses, ações e narrativas, mas **não será a fonte de verdade dos cálculos, probabilidades, citações ou transições quantitativas**.

---

## 2. Contexto e evidências do sistema atual

A inspeção do `geniusai-civilizations` confirma uma base técnica valiosa:

- monorepo TypeScript com `apps/backend`, `apps/frontend` e `packages/shared`;
- backend Node.js com WebSocket e frontend React/Vite;
- `AgentRunner` plugável com mock, Ollama e CLIs headless;
- `CivilizationAgentFactory` com validação Zod, fallback e logger;
- `AgentOrchestrator` que registra um agente por civilização;
- `GameLoop` com mutex lógico, eventos de progresso e aplicação determinística;
- persistência local, saves versionados, trace JSONL, replay e exportação;
- contratos compartilhados entre backend e frontend;
- reconexão WebSocket, `maxPayload`, validação de origin, bind em loopback e defesa contra path traversal;
- UI com Teatro de Decisões, timeline, replay e painéis de auditoria;
- testes unitários, integração backend, cobertura e smoke E2E com Playwright em CI.

As limitações estruturais confirmadas impedem que o Foresight seja apenas uma nova “configuração” do jogo:

- `CIV_IDS` é uma união literal fixa: `rome | egypt | greece | mali`;
- `Record<CivId, ...>` aparece em motor, agentes, persistência, protocolo e UI;
- o mapa inicial é fixo em 8×8;
- os recursos centrais são `food`, `gold` e `science`;
- as transições são regras de jogo: cidades, exércitos, tecnologia, diplomacia e vitória;
- o loop termina por condição de vitória/eliminações;
- o replay recria o mundo com o catálogo padrão de civilizações;
- o protocolo WebSocket e a UI carregam semântica de partida/civilização.

**Decisão arquitetural:** generalizar essas estruturas dentro do produto atual teria alto raio de impacto e risco de regressão. O Foresight deve reaproveitar contratos arquiteturais, não o modelo de domínio do jogo.

---

## 3. Visão do produto

### 3.1 Proposta de valor

Permitir que analistas construam estudos prospectivos transparentes e reproduzíveis, nos quais:

- cada afirmação relevante aponta para evidências;
- cada ator tem identidade e estado próprios;
- cada transição quantitativa é explicável;
- cada cenário declara hipóteses, gatilhos e incertezas;
- cada execução pode ser reproduzida sem nova inferência;
- cada previsão pode ser comparada posteriormente com observações reais;
- relatórios diferenciam fato, inferência, hipótese e narrativa.

### 3.2 Usuários primários

- analistas de estratégia e riscos;
- pesquisadores de políticas públicas e geopolítica;
- equipes de planejamento de organizações;
- analistas de mercado e inteligência competitiva;
- professores e estudantes de prospectiva;
- desenvolvedores de novos “domain packs”.

### 3.3 Resultados esperados

- estudo versionado;
- catálogo dinâmico de atores;
- perfis de países/organizações/mercados;
- inventário de evidências e claims;
- configuração temporal e hipóteses;
- árvore de cenários;
- trace e replay;
- indicadores e análise de sensibilidade;
- relatório executivo e relatório técnico;
- resultados de calibração/backtesting.

### 3.4 Não objetivos do MVP

- prever o futuro como uma verdade única;
- executar decisões no mundo real;
- operar mercados, contas bancárias ou sistemas governamentais;
- fazer scraping irrestrito da internet;
- substituir análise humana especializada;
- oferecer “probabilidades” sem método ou base quantitativa;
- suportar colaboração multiusuário em nuvem;
- modificar ou migrar partidas do `geniusai-civilizations`;
- compartilhar banco de dados, portas ou diretórios de runtime com o produto atual.

---

## 4. Princípios arquiteturais

1. **Isolamento por padrão:** diretório, package names, processos, portas, dados e CI próprios.
2. **IDs dinâmicos:** nenhum ator deve depender de enumeração compilada.
3. **Motor determinístico:** mesma configuração, seed, evidências congeladas, saídas de agentes gravadas e versões de adaptadores devem produzir o mesmo replay.
4. **LLM fora do núcleo de cálculo:** agentes sugerem; reducers e adaptadores validam e aplicam.
5. **Evidence first:** fatos e claims precisam de proveniência explícita.
6. **Incerteza explícita:** distinguir probabilidade calibrada, peso heurístico, confiança de fonte e confiança analítica.
7. **Plugins com fronteiras fortes:** domain packs e adaptadores declaram contratos e versões.
8. **Event sourcing pragmático:** trace append-only como trilha de auditoria; snapshots como aceleração, não segunda verdade.
9. **Local-first e exportável:** funcionamento offline após setup e artefatos legíveis fora do aplicativo.
10. **Falha isolada:** falha de ator, fonte ou adaptador não deve corromper a execução inteira.
11. **Compatibilidade aditiva:** schemas versionados e migrações explícitas.
12. **Explicabilidade verificável:** toda saída deve mostrar de onde veio, não apenas parecer convincente.

---

## 5. Estratégia de integração sem alterar o sistema atual

### 5.1 Limites físicos

```text
GeniusAI/
├── geniusai-civilizations/      # permanece independente e inalterado
├── geniusai-foresight/          # novo produto
└── .github/workflows/           # CI pode ganhar job independente após aprovação
```

Regras obrigatórias:

- o Foresight não importa `../geniusai-civilizations/apps/...`;
- o Foresight não lê nem escreve `geniusai-civilizations/data` ou `logs`;
- o Foresight não usa `@geniusai/shared`, pois esse pacote contém contratos de jogo;
- os packages novos usam namespace `@geniusai/foresight-*`;
- portas padrão não colidem: proposta `8797` para backend e `5197` para frontend;
- variáveis específicas usam prefixo `FORESIGHT_` quando não forem de runner;
- o Docker Compose usa nome de projeto e volumes próprios;
- testes do Civilizations continuam sendo um gate de regressão independente.

### 5.2 Reuso recomendado

| Ativo atual | Decisão para Foresight | Justificativa |
|---|---|---|
| `AgentRunner` | Recriar contrato compatível em `packages/runtime`, generalizando comentários e tipos | Interface fina e comprovada; evita import interno |
| `CliAgentRunner`, `OllamaRunner`, `MockRunner` | Portar com proveniência e testes de paridade | Alto valor, baixo acoplamento se isolados |
| `CivilizationAgentFactory` | Não importar; usar como referência para `ActorAgentFactory` | O factory atual depende de `CivId`, recursos e tecnologias |
| conselheiros | Reusar padrão opcional/fail-open em `ActorClusterFactory` | Especialistas podem ser declarados pelo domain pack |
| `AgentOrchestrator` | Reconceber com `Map<ActorId, ActorCluster>` dinâmico | O atual itera `CIV_IDS` |
| `GameLoop` | Reusar princípios de mutex/eventos/fallback, não o código de domínio | O atual assume turnos, vitória e `tick(World, CivDecision[])` |
| RNG determinístico | Portar implementação e golden tests | Essencial para replay e branching |
| trace/replay | Reusar JSONL, escrita atômica e defesa de paths; ampliar envelope | O formato atual não registra versões, evidências e hashes |
| WebSocket | Reusar padrão de eventos, health, origin e reconexão | Semântica será nova e versionada |
| Teatro de Decisões | Adaptar conceitos visuais e padrões de interação | Componentes atuais estão acoplados a civilizações |
| `@geniusai/shared` | Não reutilizar diretamente | Contratos são específicos do jogo |

### 5.3 Estratégia contra drift

Toda implementação portada deve registrar no cabeçalho:

- arquivo de origem;
- commit de origem;
- mudanças semânticas realizadas;
- teste de paridade ou golden correspondente.

Não haverá sincronização automática bidirecional. Correções relevantes poderão ser aplicadas separadamente aos dois produtos, mediante revisão.

### 5.4 Extração compartilhada futura

Uma extração para `packages/agent-runtime` na raiz só poderá ocorrer se:

- os dois produtos tiverem contratos convergentes em produção;
- houver cobertura de compatibilidade para ambos;
- a mudança for aprovada por ADR própria;
- os testes do Civilizations permanecerem verdes sem alteração de comportamento;
- a extração não bloquear releases independentes.

---

## 6. Arquitetura lógica proposta

```text
┌───────────────────────────────────────────────────────────────────┐
│ Frontend React/Vite                                               │
│ Estudo · Evidências · Atores · Cenários · Tempo · Replay · Reports│
└───────────────────────▲───────────────────────┬───────────────────┘
                        │ REST                  │ WebSocket
┌───────────────────────┴───────────────────────▼───────────────────┐
│ API/Application Layer                                             │
│ StudyService · RunService · EvidenceService · ReportService       │
│ validação Zod · auth local opcional · rate/payload limits         │
└─────────────┬───────────────────┬───────────────────┬─────────────┘
              │                   │                   │
┌─────────────▼──────┐ ┌──────────▼─────────┐ ┌──────▼─────────────┐
│ Actor Runtime       │ │ Foresight Engine   │ │ Evidence/Reports  │
│ ActorAgentFactory   │ │ TemporalScheduler  │ │ ClaimGraph        │
│ ActorClusterFactory │ │ ScenarioTree       │ │ ProvenanceStore    │
│ AgentRunner         │ │ Deterministic Core │ │ ReportComposer     │
└─────────────┬──────┘ └──────────┬─────────┘ └──────┬─────────────┘
              │                   │                   │
              └────────────┬──────┴─────────┬─────────┘
                           │                │
                ┌──────────▼──────┐ ┌──────▼────────────────┐
                │ Domain Packs     │ │ Quantitative Adapters │
                │ country/org/     │ │ equations, datasets,  │
                │ market/custom    │ │ models, sensitivity   │
                └──────────┬──────┘ └──────┬────────────────┘
                           │                │
                 ┌─────────▼────────────────▼─────────────────┐
                 │ Persistence Ports                          │
                 │ JSON/JSONL + content-addressed blobs       │
                 │ snapshots · traces · reports · calibration │
                 └────────────────────────────────────────────┘
```

### 6.1 Camadas e dependências

- `contracts`: tipos e schemas compartilhados; não depende de apps.
- `domain-sdk`: interfaces para domain packs, reducers, indicadores e especialistas; depende apenas de `contracts`.
- `core`: relógio, scheduler, árvore, eventos, RNG, hashes, replay e regras invariantes; depende de `contracts` e `domain-sdk`.
- `runtime`: runners de agente e política de execução; depende de `contracts`.
- `application`: casos de uso e orquestração; depende de portas, nunca de implementações concretas.
- `adapters`: persistência, fontes, modelos quantitativos e runners concretos.
- `api`: HTTP/WS, validação e tradução de erros.
- `frontend`: consome apenas `contracts` e API pública.

**Regra de dependência:** código de domínio não importa servidor, filesystem, React, subprocesso ou provedor de LLM.

### 6.2 Fluxo de execução

1. Usuário cria um estudo, horizonte temporal e snapshot de evidências.
2. `CountryProfiler` e profilers equivalentes geram perfis com claims rastreáveis.
3. `ActorClusterFactory` instancia clusters conforme o tipo do ator e o domain pack.
4. `TemporalScheduler` determina o próximo instante efetivo e os módulos com cadence devida.
5. Cada ator recebe uma visão materializada do estado, evidências autorizadas e hipóteses ativas.
6. Especialistas opcionais produzem recomendações curtas; falhas são descartadas e registradas.
7. O agente coordenador propõe ações estruturadas.
8. Schemas e políticas validam ações; ações inválidas são rejeitadas sem mutação.
9. Adaptadores quantitativos calculam deltas ou distribuições com seed/contexto explícitos.
10. Reducers dos domain packs aplicam eventos em ordem estável.
11. Gatilhos podem criar novos nós na árvore de cenários, respeitando orçamento de branching.
12. O trace grava entradas, saídas, evidências, versões e hashes.
13. Snapshots periódicos aceleram leitura; o trace permanece a trilha canônica.
14. UI recebe eventos incrementais; relatórios são gerados apenas a partir de artefatos persistidos.

---

## 7. Estrutura de diretórios proposta

```text
geniusai-foresight/
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── eslint.config.mjs
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── apps/
│   ├── backend/
│   │   ├── package.json
│   │   └── src/
│   │       ├── api/                 # rotas HTTP, protocolo WS, schemas de entrada
│   │       ├── application/         # casos de uso e serviços
│   │       ├── actors/              # factories, profiler orchestration, views
│   │       ├── engine/              # composição do core + packs + adapters
│   │       ├── evidence/            # ingestão, claims, proveniência
│   │       ├── persistence/         # file store e índices derivados
│   │       ├── reports/             # composição e renderização
│   │       ├── security/            # URL/path/command policies
│   │       ├── config.ts
│   │       ├── logger.ts
│   │       └── index.ts
│   └── frontend/
│       ├── package.json
│       └── src/
│           ├── app/
│           ├── components/
│           ├── features/
│           │   ├── studies/
│           │   ├── evidence/
│           │   ├── actors/
│           │   ├── scenarios/
│           │   ├── simulation/
│           │   ├── replay/
│           │   ├── reports/
│           │   └── calibration/
│           ├── hooks/
│           ├── state/
│           └── styles/
├── packages/
│   ├── contracts/                   # tipos + schemas Zod + protocolo v1
│   ├── core/                        # scheduler, scenario tree, replay, RNG
│   ├── runtime/                     # AgentRunner, CLI/Ollama/mock, policies
│   ├── domain-sdk/                  # contrato de DomainPack
│   ├── domain-packs/
│   │   ├── country/
│   │   ├── organization/
│   │   └── market/
│   ├── quantitative-adapters/
│   │   ├── deterministic-baseline/
│   │   └── fixtures/
│   └── testing/                     # factories, fake clock, fixtures, golden tools
├── data/
│   └── .gitkeep
├── docs/
│   ├── prd-arquitetura-requisitos.md
│   ├── adr/
│   ├── schemas/
│   └── domain-packs/
├── e2e/
├── examples/
│   ├── country-study/
│   ├── organization-study/
│   └── market-study/
└── scripts/
    ├── dev.mjs
    ├── doctor.mjs
    ├── validate-packs.mjs
    └── verify-replay.mjs
```

### 7.1 Layout de dados local

```text
data/
├── studies/<studyId>/
│   ├── study.json
│   ├── actors/<actorId>.json
│   ├── profiles/<profileId>.json
│   ├── evidence/<evidenceId>.json
│   ├── blobs/sha256/<digest>
│   ├── runs/<runId>/
│   │   ├── manifest.json
│   │   ├── trace.jsonl
│   │   ├── snapshots/<sequence>.json
│   │   ├── scenario-tree.json
│   │   └── metrics.json
│   ├── reports/<reportId>/
│   └── calibration/<calibrationId>/
└── index/                           # índice derivado e reconstruível
```

O filesystem exportável é a fonte inicial. Um índice SQLite poderá ser adicionado atrás de `MetadataIndexPort`, mas nunca será a única cópia dos artefatos.

---

## 8. Modelo de domínio e schemas

Os exemplos abaixo são contratos conceituais TypeScript. Na implementação, cada entrada de API e artefato persistido terá schema Zod correspondente e `schemaVersion`.

### 8.1 Identificadores e JSON seguro

```ts
type StudyId = string;      // ^study_[a-z0-9][a-z0-9_-]{2,63}$
type RunId = string;        // ^run_[a-z0-9][a-z0-9_-]{2,63}$
type ActorId = string;      // ex.: country:BR, org:acme, market:soy-brl
type EvidenceId = string;   // content-addressed ou UUID/ULID validado
type ScenarioNodeId = string;
type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
```

Regras de `ActorId`:

- namespace obrigatório (`kind:key`);
- normalização canônica e limite de 128 caracteres;
- não é usado diretamente como caminho de arquivo;
- o storage usa digest/encoding seguro ou um ID interno;
- unicidade por estudo.

### 8.2 Estudo

```ts
interface ForesightStudy {
  schemaVersion: 1;
  id: StudyId;
  title: string;
  question: string;
  baseDate: string;                 // ISO-8601
  horizon: { start: string; end: string };
  defaultScale: "day" | "week" | "month" | "quarter" | "year";
  actorIds: ActorId[];
  domainPackRefs: VersionedRef[];
  evidenceSnapshotId: string;
  assumptions: Assumption[];
  stopPolicy: StopPolicy;
  createdAt: string;
  updatedAt: string;
}
```

Não existe “vitória”. Uma execução termina por horizonte, limite de passos, cancelamento, erro não recuperável ou regra explícita do estudo.

### 8.3 Atores

```ts
type ActorKind = "country" | "organization" | "market" | "custom";

interface ActorDefinition {
  schemaVersion: 1;
  id: ActorId;
  kind: ActorKind;
  name: string;
  aliases: string[];
  description: string;
  profileRef: VersionedRef;
  tags: string[];
  model?: string;
  domainPackRefs: VersionedRef[];
  capabilities: string[];
  constraints: PolicyConstraint[];
  specialistRoles?: string[];
  attributes: Record<string, JsonValue>;
}

interface ActorProfile {
  schemaVersion: 1;
  id: string;
  actorId: ActorId;
  asOf: string;
  dimensions: Record<string, ProfileDimension>;
  claimIds: string[];
  unknowns: UnknownField[];
  generatedBy: GeneratorProvenance;
}

interface ProfileDimension {
  summary: string;
  indicators: Record<string, MeasuredValue>;
  claimIds: string[];
  confidence: "low" | "medium" | "high";
}
```

### 8.4 Country Profiler

O pack `country` deve suportar, no mínimo, dimensões versionadas:

- macroeconomia e estrutura produtiva;
- demografia e capital humano;
- instituições e governança;
- política doméstica;
- relações exteriores e segurança;
- energia e recursos;
- clima e ambiente;
- tecnologia e infraestrutura;
- coesão social e riscos.

O profiler não preenche lacunas silenciosamente. Campo sem evidência vira `unknown`, hipótese explícita ou item de revisão humana.

### 8.5 Evidência, claim e proveniência

```ts
interface EvidenceItem {
  schemaVersion: 1;
  id: EvidenceId;
  sourceType: "file" | "url" | "dataset" | "manual" | "api";
  locator: string;
  title?: string;
  publisher?: string;
  publishedAt?: string;
  capturedAt: string;
  contentSha256: string;
  mediaType: string;
  excerpt?: string;
  license?: string;
  retrieval: {
    adapterId: string;
    adapterVersion: string;
    parameters: Record<string, JsonValue>;
  };
  quality: {
    sourceReliability?: number;      // 0..1; método declarado
    recency?: number;                // 0..1
    directness?: number;             // 0..1
    notes?: string;
  };
}

interface Claim {
  schemaVersion: 1;
  id: string;
  statement: string;
  actorIds: ActorId[];
  validTime?: { from?: string; to?: string };
  evidenceRefs: Array<{ evidenceId: EvidenceId; locator?: string; relation: "supports" | "contradicts" | "context" }>;
  status: "observed" | "inferred" | "assumed" | "disputed" | "superseded";
  confidence: number;               // 0..1; método + justificativa obrigatórios
  rationale: string;
  createdBy: GeneratorProvenance;
}
```

**Regra:** confiança de claim, qualidade da fonte e probabilidade de cenário são conceitos diferentes e não podem compartilhar um único campo genérico.

### 8.6 Domain Pack

```ts
interface DomainPack {
  manifest: {
    id: string;
    version: string;
    engineRange: string;
    actorKinds: ActorKind[];
    dependencies: VersionedRef[];
  };
  schemas: {
    actorState: object;
    action: object;
    event: object;
    configuration: object;
  };
  createInitialState(ctx: InitialStateContext): Promise<JsonValue>;
  buildActorView(ctx: ActorViewContext): JsonValue;
  validateAction(action: unknown, ctx: ValidationContext): ValidationResult;
  reduce(state: JsonValue, event: SimulationEvent, ctx: ReduceContext): JsonValue;
  indicators: IndicatorDefinition[];
  schedules: ScheduleDefinition[];
  specialistRoles?: SpecialistRoleDefinition[];
  branchRules?: BranchRule[];
  reportSections?: ReportSectionProvider[];
}
```

Requisitos de pack:

- manifest e versão semântica;
- schemas serializáveis;
- reducer puro ou efeitos explicitamente isolados;
- ordem de eventos determinística;
- migração de estado entre versões suportadas;
- fixtures e golden tests;
- nenhum acesso direto a filesystem, rede ou subprocesso pelo reducer;
- capabilities declaradas e negadas por padrão.

### 8.7 Actor Cluster Factory

```ts
interface ActorCluster {
  actorId: ActorId;
  coordinator: ActorAgent;
  specialists: Map<string, SpecialistAgent>;
  policy: ExecutionPolicy;
}

interface ActorClusterFactory {
  create(definition: ActorDefinition, packs: LoadedDomainPack[], ctx: ActorRuntimeContext): ActorCluster;
}
```

O cluster será enxuto:

- um coordenador por ator;
- especialistas apenas quando o pack e o estudo justificarem;
- especialistas recebem recortes mínimos de estado;
- recomendações têm limite de tamanho, confiança e evidências;
- falha de especialista é fail-open e registrada;
- coordenador não pode emitir ferramentas fora das capabilities do ator.

### 8.8 Estado temporal e eventos

```ts
type TimeScale = "day" | "week" | "month" | "quarter" | "year" | "event";

interface TemporalCursor {
  sequence: number;
  effectiveAt: string;
  scale: TimeScale;
}

interface SimulationState {
  schemaVersion: 1;
  studyId: StudyId;
  runId: RunId;
  cursor: TemporalCursor;
  seed: number;
  rngState: number;
  actors: Record<ActorId, JsonValue>;
  global: JsonValue;
  activeScenarioNodeId: ScenarioNodeId;
  assumptions: Assumption[];
  evidenceSnapshotId: string;
}

interface SimulationEvent {
  schemaVersion: 1;
  id: string;
  sequence: number;
  effectiveAt: string;
  emittedAt: string;
  type: string;
  source: { kind: "actor" | "pack" | "adapter" | "human" | "system"; id: string; version?: string };
  actorIds: ActorId[];
  payload: JsonValue;
  evidenceRefs: EvidenceId[];
  assumptionIds: string[];
  causationId?: string;
  correlationId: string;
}
```

### 8.9 Motor temporal multiescala

O motor usa agenda de eventos, não um único `tick` fixo:

- módulos declaram cadence (`monthly`, `quarterly`, `event-triggered` etc.);
- scheduler avança para o próximo instante devido;
- ordem estável: `effectiveAt`, prioridade, `actorId`, `eventId`;
- eventos simultâneos são avaliados sobre snapshot pré-passo quando o pack exigir decisões concorrentes;
- reducers aplicam uma sequência canônica documentada;
- nenhuma chamada a relógio real ocorre dentro do reducer;
- calendário e timezone do estudo são explícitos;
- branching clona estado imutável por referência/snapshot, não por mutação compartilhada.

### 8.10 Árvore de cenários

```ts
interface ScenarioNode {
  schemaVersion: 1;
  id: ScenarioNodeId;
  parentId: ScenarioNodeId | null;
  label: string;
  status: "active" | "pruned" | "completed" | "failed";
  createdAtSequence: number;
  stateSnapshotRef: string;
  trigger: BranchTrigger | null;
  assumptionsAdded: string[];
  conditionalProbability?: number; // somente quando método probabilístico estiver declarado
  heuristicWeight?: number;        // não rotular como probabilidade
  rationale: string;
  evidenceRefs: EvidenceId[];
  children: ScenarioNodeId[];
}
```

Políticas contra explosão combinatória:

- `maxDepth`, `maxChildrenPerNode`, `maxActiveNodes` e orçamento de execução;
- limiar de poda e motivo registrado;
- merge somente quando equivalência de estado for demonstrável;
- soma de probabilidades de filhos validada apenas em modo probabilístico;
- cenários heurísticos exibem pesos, nunca percentuais enganosos;
- usuário pode fixar, podar, comparar e promover um cenário.

### 8.11 Adaptadores quantitativos

```ts
interface QuantitativeAdapter<I = JsonValue, O = JsonValue> {
  id: string;
  version: string;
  deterministic: boolean;
  inputSchema: object;
  outputSchema: object;
  run(input: I, ctx: QuantContext): Promise<QuantResult<O>>;
}

interface QuantContext {
  studyId: StudyId;
  runId: RunId;
  scenarioNodeId: ScenarioNodeId;
  effectiveAt: string;
  seed: number;
  evidenceSnapshotId: string;
  timeoutMs: number;
}

interface QuantResult<O> {
  output: O;
  diagnostics: Record<string, JsonValue>;
  uncertainty?: DistributionSummary;
  evidenceRefs: EvidenceId[];
  warnings: string[];
}
```

Políticas:

- adapters são allowlisted e versionados;
- entrada e saída sempre validadas;
- adapter não determinístico deve registrar seed e dependências;
- timeout, cancelamento e limite de recursos;
- subprocessos sem shell e com argumentos estruturados;
- saída numérica não pode ser sobrescrita silenciosamente por texto do LLM;
- fallback deve ser declarado pelo estudo: falhar, usar baseline, manter último valor ou marcar desconhecido.

### 8.12 Trace, snapshot e replay

```ts
interface TraceRecord {
  schemaVersion: 1;
  runId: RunId;
  sequence: number;
  effectiveAt: string;
  scenarioNodeId: ScenarioNodeId;
  inputDigest: string;
  stateBeforeDigest: string;
  stateAfterDigest: string;
  rngBefore: number;
  rngAfter: number;
  actorExecutions: ActorExecutionRecord[];
  adapterExecutions: AdapterExecutionRecord[];
  events: SimulationEvent[];
  evidenceRefs: EvidenceId[];
  packVersions: VersionedRef[];
  runtimeVersion: string;
}
```

Replay nunca chama LLM ou fonte externa. Usa o manifest congelado, eventos registrados e versões de packs/adapters. Divergência de hash é erro de integridade explícito.

### 8.13 Calibração

```ts
interface CalibrationRun {
  id: string;
  studyTemplateRef: VersionedRef;
  trainingCutoff: string;
  evaluationDate: string;
  targets: CalibrationTarget[];
  forecastRunIds: RunId[];
  observations: Observation[];
  metrics: CalibrationMetric[];
  leakageChecks: LeakageCheck[];
  status: "pending" | "running" | "completed" | "invalid";
}
```

A calibração deve suportar:

- backtesting com cutoff temporal;
- proibição de evidência posterior ao cutoff;
- Brier score para eventos binários probabilísticos;
- erro absoluto/percentual para pontos quando aplicável;
- cobertura de intervalos e calibration error para distribuições;
- comparação com baseline simples;
- amostra e limitações visíveis;
- nenhuma nota agregada única sem decomposição.

### 8.14 Relatórios

Todo relatório deve separar:

1. pergunta e escopo;
2. snapshot de evidências;
3. premissas;
4. método e versões;
5. cenários e gatilhos;
6. resultados quantitativos;
7. incertezas e unknowns;
8. sensibilidade;
9. claims com citações;
10. divergências e evidências contraditórias;
11. calibração disponível;
12. limitações e aviso de uso responsável.

Formatos do MVP: Markdown, JSON e HTML autocontido. PDF fica atrás de renderer opcional, sem bloquear o núcleo.

---

## 9. APIs e protocolo em tempo real

### 9.1 Princípios

- prefixo versionado `/api/v1`;
- REST para CRUD, comandos idempotentes e downloads;
- WebSocket para streaming de execução;
- schemas compartilhados em `@geniusai/foresight-contracts`;
- `requestId`, `correlationId` e `runId` em logs e erros;
- erros públicos estruturados: `{ code, message, requestId, details? }`;
- nenhuma stack trace enviada ao browser.

### 9.2 Endpoints propostos

```text
GET    /health
GET    /api/v1/capabilities

POST   /api/v1/studies
GET    /api/v1/studies
GET    /api/v1/studies/:studyId
PATCH  /api/v1/studies/:studyId
POST   /api/v1/studies/:studyId/validate

POST   /api/v1/studies/:studyId/evidence
GET    /api/v1/studies/:studyId/evidence
POST   /api/v1/studies/:studyId/evidence/snapshot
GET    /api/v1/studies/:studyId/claims

POST   /api/v1/studies/:studyId/actors
POST   /api/v1/studies/:studyId/actors/:actorId/profile
GET    /api/v1/studies/:studyId/actors
GET    /api/v1/studies/:studyId/actors/:actorId

POST   /api/v1/studies/:studyId/runs
GET    /api/v1/runs/:runId
POST   /api/v1/runs/:runId/commands       # play|pause|step|cancel|branch|prune
GET    /api/v1/runs/:runId/scenarios
GET    /api/v1/runs/:runId/trace
GET    /api/v1/runs/:runId/replay
GET    /api/v1/runs/:runId/metrics

POST   /api/v1/runs/:runId/reports
GET    /api/v1/reports/:reportId
GET    /api/v1/reports/:reportId/export?format=json|md|html

POST   /api/v1/calibrations
GET    /api/v1/calibrations/:calibrationId
```

### 9.3 Idempotência e concorrência

- criação e comandos mutáveis aceitam `Idempotency-Key`;
- um `runId` tem no máximo um passo mutável em voo;
- `step` concorrente retorna `RUN_BUSY`;
- edição de estudo usa `revision`/ETag para evitar lost update;
- report e replay são somente leitura;
- cancelamento é cooperativo e registrado.

### 9.4 WebSocket

Endpoint proposto: `ws://127.0.0.1:8797/ws?runId=<id>&protocol=v1`.

Servidor → cliente:

- `hello`;
- `health`;
- `run_init`;
- `run_state`;
- `step_start`;
- `actor_start`;
- `actor_token`;
- `actor_end`;
- `adapter_start`;
- `adapter_end`;
- `events_committed`;
- `scenario_branched`;
- `scenario_pruned`;
- `step_end`;
- `report_progress`;
- `run_error`;
- `run_completed`.

O cliente reconecta com `lastSequence`; o servidor repõe eventos ausentes ou envia snapshot + delta. Eventos têm ordem por `sequence` e são deduplicáveis.

---

## 10. Experiência de usuário e UI

### 10.1 Navegação principal

1. **Estudos** — criar, duplicar, importar e validar estudos.
2. **Sala de Evidências** — fontes, claims, conflitos, freshness e snapshot.
3. **Mapa de Atores** — países, organizações, mercados e relações.
4. **Perfis** — dimensões, indicadores, lacunas e evidências.
5. **Teatro de Decisões** — deliberação ao vivo, especialistas, ações propostas/aceitas/rejeitadas.
6. **Explorador de Cenários** — árvore, comparação, poda, pesos/probabilidades e gatilhos.
7. **Lente Temporal** — escala, horizonte, cadences e scrubber.
8. **Painel Quantitativo** — séries, intervalos, adapters, diagnósticos e sensibilidade.
9. **Replay** — reprodução sem inferência com verificação de integridade.
10. **Estúdio de Relatórios** — preview, citações, export e limitações.
11. **Laboratório de Calibração** — backtests, baselines e métricas.

### 10.2 Reuso da linguagem visual existente

O Teatro de Decisões pode reaproveitar o padrão de “ator em foco + raciocínio ao vivo + ações + recomendações”, mas não os componentes acoplados a `CivId`. A abstração visual será `ActorRail`, `ActorDecisionPanel` e `ScenarioTimeline`.

### 10.3 Requisitos de explicabilidade da UI

- badges distintos: `fato`, `inferência`, `hipótese`, `resultado de modelo`, `narrativa`;
- indicador de fonte ao lado de números e claims;
- probabilidade só aparece quando houver método probabilístico;
- pesos heurísticos usam rótulo próprio;
- toda ação mostra status: proposta, validada, rejeitada, aplicada;
- toda mudança quantitativa abre diagnóstico do adapter;
- unknowns são visíveis e não renderizados como zero;
- replay exibe manifest, versões e estado de integridade.

### 10.4 Acessibilidade

- WCAG 2.2 AA como meta;
- navegação completa por teclado;
- foco visível;
- sem dependência exclusiva de cor;
- tabelas e gráficos com alternativa textual;
- regiões de streaming com `aria-live` configurável para evitar excesso;
- preferência `prefers-reduced-motion`;
- árvore de cenários operável sem drag-and-drop obrigatório.

---

## 11. Mapa de requisitos funcionais

### 11.1 Estudos e configuração

| ID | Requisito | Prioridade | Evidência de aceite |
|---|---|---:|---|
| RF-001 | Criar, editar, duplicar, listar, importar e exportar estudo versionado | Must | round-trip JSON sem perda e validação de schema |
| RF-002 | Configurar pergunta, data-base, horizonte, escala, seed, stop policy e orçamento | Must | estudo inválido é rejeitado com erro de campo |
| RF-003 | Congelar snapshot de evidências por execução | Must | run aponta para snapshot imutável |
| RF-004 | Validar compatibilidade de packs/adapters antes de iniciar | Must | execução bloqueada com diagnóstico acionável |

### 11.2 Atores, perfis e clusters

| ID | Requisito | Prioridade | Evidência de aceite |
|---|---|---:|---|
| RF-005 | Aceitar IDs dinâmicos e namespaced sem enum compilado | Must | estudo com >4 atores e IDs não previstos roda |
| RF-006 | Suportar atores `country`, `organization`, `market` e `custom` | Must | fixture e2e de cada tipo principal |
| RF-007 | Criar, editar, desativar e relacionar atores | Must | relações aparecem no mapa e no snapshot |
| RF-008 | Gerar perfil de país multidimensional com unknowns e claims | Must | cada dimensão aponta para claims/evidências |
| RF-009 | Permitir profilers específicos para organização e mercado | Should | packs produzem perfis válidos com schemas próprios |
| RF-010 | Instanciar `ActorCluster` por factory dinâmica | Must | um cluster por ator ativo; lookup por `ActorId` |
| RF-011 | Ativar especialistas por pack/ator, com falha isolada | Should | especialista falho não bloqueia coordenador |
| RF-012 | Restringir visão e capabilities por ator | Must | teste prova que ator não recebe dado/capability negado |

### 11.3 Domain packs e adaptadores

| ID | Requisito | Prioridade | Evidência de aceite |
|---|---|---:|---|
| RF-013 | Descobrir e validar domain packs por manifest versionado | Must | pack incompatível falha no doctor/CI |
| RF-014 | Compor múltiplos packs sem colisão silenciosa | Must | conflito de namespace exige resolução explícita |
| RF-015 | Executar reducers determinísticos e schemas por pack | Must | property/golden tests repetíveis |
| RF-016 | Registrar indicadores, schedules, ações e branch rules por pack | Must | catálogo `/capabilities` lista metadados reais |
| RF-017 | Executar adaptadores quantitativos versionados | Must | input/output/timeout/diagnostics persistidos |
| RF-018 | Declarar política de fallback por adapter | Must | falha simulada segue política e gera warning |

### 11.4 Evidência e proveniência

| ID | Requisito | Prioridade | Evidência de aceite |
|---|---|---:|---|
| RF-019 | Ingerir arquivo, URL permitida, dataset, API permitida ou entrada manual | Must | conteúdo armazenado com hash e metadata |
| RF-020 | Criar claims ligados a trechos de evidência | Must | claim sem evidência exige status `assumed`/`inferred` |
| RF-021 | Registrar suporte, contradição e contexto entre claim/evidência | Must | relatório exibe fontes conflitantes |
| RF-022 | Versionar captura, freshness, licença e método de retrieval | Must | manifest reproduz o snapshot usado |
| RF-023 | Distinguir qualidade da fonte, confiança do claim e incerteza do cenário | Must | schemas e UI não usam campo ambíguo comum |

### 11.5 Simulação e cenários

| ID | Requisito | Prioridade | Evidência de aceite |
|---|---|---:|---|
| RF-024 | Avançar tempo em escalas diária, semanal, mensal, trimestral, anual e por evento | Must | schedules mistos executam em ordem golden |
| RF-025 | Executar atores sobre snapshot coerente e ordem estável | Must | mesma seed/inputs produz mesmo trace estrutural |
| RF-026 | Validar e aplicar ações via eventos/reducers, nunca diretamente pelo LLM | Must | ação inválida gera rejeição sem mutação |
| RF-027 | Criar árvore de cenários com gatilhos e premissas | Must | branch preserva pai e snapshot de origem |
| RF-028 | Limitar, podar, fixar, comparar e promover cenários | Must | políticas de orçamento têm testes de fronteira |
| RF-029 | Suportar probabilidade calibrada e peso heurístico como campos distintos | Must | UI nunca formata weight como `%` |
| RF-030 | Permitir intervenção humana registrada e reversível por novo branch | Should | intervenção gera evento `human` e cenário filho |
| RF-031 | Pausar, continuar, executar passo e cancelar run | Must | comandos concorrentes não geram passos paralelos |
| RF-032 | Degradar falha de ator para ação nula/política configurada | Must | run continua e trace registra falha |

### 11.6 Auditoria, replay, relatórios e calibração

| ID | Requisito | Prioridade | Evidência de aceite |
|---|---|---:|---|
| RF-033 | Persistir trace append-only com hashes e versões | Must | registro completo por sequência |
| RF-034 | Criar snapshots versionados e escritos atomicamente | Must | interrupção simulada não produz snapshot parcial válido |
| RF-035 | Reproduzir run sem LLM, rede ou adapters externos | Must | hashes finais do replay coincidem |
| RF-036 | Exportar bundle autocontido do estudo/run | Must | import em diretório limpo preserva replay |
| RF-037 | Gerar relatório Markdown, JSON e HTML com citações | Must | seção sem evidência aparece como hipótese/limitação |
| RF-038 | Exibir comparação e sensibilidade entre cenários | Should | diferenças por indicador e premissa visíveis |
| RF-039 | Executar backtesting com cutoff e leakage checks | Should | evidência posterior invalida calibration run |
| RF-040 | Calcular métricas adequadas por tipo de target e comparar baseline | Should | Brier/erro/cobertura têm fixtures conhecidas |

### 11.7 API e UI

| ID | Requisito | Prioridade | Evidência de aceite |
|---|---|---:|---|
| RF-041 | Expor API REST v1 com schemas e erros estruturados | Must | contract tests de sucesso e erro |
| RF-042 | Transmitir progresso por WebSocket ordenado e recuperável | Must | reconexão com `lastSequence` não duplica nem perde evento |
| RF-043 | Exibir Sala de Evidências e Mapa de Atores | Must | e2e cria fonte, claim e ator relacionado |
| RF-044 | Exibir Teatro de Decisões para atores dinâmicos | Must | e2e com 7 atores sem código específico por ID |
| RF-045 | Exibir árvore de cenários e comparação | Must | árvore navegável por mouse e teclado |
| RF-046 | Exibir Lente Temporal, indicadores e incerteza | Must | escalas e intervalos têm alternativa textual |
| RF-047 | Exibir Replay com scrubber e verificação de integridade | Must | e2e navega início/fim e confirma hash válido |
| RF-048 | Exibir Estúdio de Relatórios e Laboratório de Calibração | Should | export e métricas acessíveis na UI |

---

## 12. Requisitos não funcionais

| ID | Requisito | Meta/critério |
|---|---|---|
| RNF-001 | Zero regressão no Civilizations | nenhum arquivo runtime do produto atual alterado no MVP; suíte existente verde |
| RNF-002 | Determinismo | reducers e scheduler repetíveis; replay valida hashes por passo |
| RNF-003 | Reprodutibilidade | manifest registra seed, versões, config, evidence snapshot e outputs de agentes |
| RNF-004 | Proveniência | 100% dos claims em relatório têm evidence refs ou status explícito de hipótese/inferência |
| RNF-005 | Robustez | erro de ator/especialista/adapter segue política, sem estado parcial ou crash não tratado |
| RNF-006 | Integridade | snapshots atômicos; trace detecta truncamento/hash inconsistente |
| RNF-007 | Performance interativa | p95 de API local <250 ms para leitura de metadata, excluindo inferência/render pesado |
| RNF-008 | Streaming | evento WS disponível ao cliente em até 500 ms após emissão local, em condição nominal |
| RNF-009 | Escala MVP | estudo de referência com 25 atores, 1.000 passos e 500 nós de cenário sem erro de memória |
| RNF-010 | Replay | replay de 1.000 passos em até 5 s na máquina de CI, sem inferência |
| RNF-011 | Local-first | após instalação e import de evidências, core/replay/report operam sem internet |
| RNF-012 | Privacidade | bind loopback padrão; nenhuma telemetria externa; logs sem secrets/conteúdo bruto por padrão |
| RNF-013 | Segurança de entrada | toda entrada externa validada; payloads, uploads, URLs e caminhos limitados |
| RNF-014 | Observabilidade | logs estruturados com request/run/scenario/actor/sequence e duração |
| RNF-015 | Acessibilidade | WCAG 2.2 AA, teclado, reduced motion e alternativas textuais |
| RNF-016 | Portabilidade | Node LTS suportado pelo repo; Linux/macOS/Windows e Termux quando dependências permitirem |
| RNF-017 | Manutenibilidade | cobertura mínima por pacote crítico; limites de dependência verificados no CI |
| RNF-018 | Evolução de schema | todo artefato persistido tem `schemaVersion` e migração/teste ou erro incompatível claro |
| RNF-019 | Budget | limites configuráveis de chamadas, tokens, duração, nós e armazenamento por run |
| RNF-020 | Explainability | toda transição mostra evento causador, adapter/reducer, evidências e premissas |

As metas de performance devem ser aferidas em fixture pública de referência e revisadas após a Fase 2; não são promessa para tempo de inferência de LLM.

---

## 13. Persistência e consistência

### 13.1 Fonte de verdade

- `trace.jsonl`: sequência canônica de execução;
- `manifest.json`: configuração congelada;
- blobs por SHA-256: conteúdo de evidência;
- snapshots: cache validado por digest;
- `scenario-tree.json`: índice materializado reconstruível a partir de eventos de branch;
- índices de busca: derivados e descartáveis.

### 13.2 Escrita

- diretório temporário + rename atômico para JSON/snapshots/reports;
- append serializado para trace;
- flush/checkpoint configurável;
- arquivo `COMPLETED`/estado no manifest somente após validação final;
- recuperação de trace truncado até último registro válido, com warning e sem inventar dados.

### 13.3 Imutabilidade

Após início do run:

- evidence snapshot, pack refs, adapter refs, seed e calendário são imutáveis;
- alteração cria novo run;
- intervenção cria evento e, por padrão, branch filho;
- report referencia um run/revision específico.

---

## 14. Segurança e uso responsável

### 14.1 Ameaças principais

1. path traversal em IDs, import/export e nomes de arquivo;
2. SSRF por ingestão de URL;
3. command injection por runners/adapters;
4. prompt injection contida em evidências;
5. payload/arquivo excessivo e decompression bombs;
6. exposição de serviço local na rede;
7. vazamento de secrets em trace/log/report;
8. pack/adaptador malicioso com acesso amplo;
9. relatório convincente com citações inexistentes;
10. uso indevido de foresight como recomendação operacional automática.

### 14.2 Controles obrigatórios

- bind `127.0.0.1` padrão e origins allowlisted;
- `maxPayload` WS e limites HTTP/upload;
- IDs validados e resolução de caminho com contenção no diretório base;
- URLs apenas `http/https`, resolução DNS validada e bloqueio de ranges privados/metadata por padrão; conectores locais exigem opt-in explícito;
- redirects limitados e revalidados;
- MIME, tamanho, extensão e hash verificados;
- subprocessos com `spawn` sem `shell`, executável allowlisted e cwd isolado;
- timeout, cancelamento, stdout/stderr e tamanho de saída limitados;
- packs/adapters sem capacidades por padrão; capabilities explícitas;
- evidência tratada como dado não confiável, delimitada e nunca interpretada como instrução de sistema;
- prompt do sistema não inclui secrets nem caminhos desnecessários;
- redaction de tokens, chaves, e-mails/PII configurável em logs e reports;
- citações montadas a partir do `ClaimGraph`, não inventadas pelo gerador textual;
- CSP e HTML escaping em reports/preview;
- export bundle com manifest de checksums;
- disclaimer e human review para decisões de alto impacto;
- nenhum conector de ação real no MVP.

### 14.3 Trust boundaries

- browser é não confiável;
- evidências e packs importados são não confiáveis;
- saída de LLM é não confiável;
- adaptadores externos são não confiáveis;
- reducers internos e schemas versionados formam o núcleo confiável mínimo;
- filesystem local não é considerado íntegro sem validação de hash/schema.

---

## 15. Estratégia de testes

### 15.1 Pirâmide

**Unidade**

- schemas e normalização de IDs;
- scheduler/calendário;
- RNG;
- reducers por pack;
- branch/prune;
- cálculo de métricas;
- qualidade/confiança/probabilidade como conceitos distintos;
- safe paths, URL policy e redaction.

**Property-based/invariantes**

- mesma seed + eventos = mesmo estado;
- sequência nunca regride;
- siblings probabilísticos somam 1 dentro da tolerância quando o modo exigir;
- pesos heurísticos não entram nessa regra;
- pruning não muta ancestral;
- ator não acessa estado negado;
- replay não chama runner/adapters/fontes.

**Contract tests**

- `AgentRunner` concreto contra suite comum;
- todo Domain Pack contra `domain-sdk`;
- todo Quant Adapter contra schemas, timeout e diagnostics;
- REST/WS contra `contracts`.

**Golden tests**

- estudo mínimo de país;
- estudo com país + organização + mercado;
- agenda multiescala;
- árvore com branches/poda;
- trace e replay byte/digest equivalentes;
- relatório com claims contraditórios.

**Integração**

- profiler → actor cluster → engine → trace;
- adapter quantitativo → reducer → indicador;
- persistência interrompida e recuperação;
- reconexão WS por `lastSequence`;
- bundle export/import.

**E2E Playwright**

- criar estudo e evidência;
- adicionar 7 atores dinâmicos;
- iniciar, pausar, step, branch e concluir;
- navegar árvore por teclado;
- abrir claim e fonte;
- reproduzir run sem runner;
- gerar/exportar report;
- verificar tema, acessibilidade e erro recuperável.

**Calibração**

- fixtures sintéticas com métricas conhecidas;
- leakage posterior ao cutoff bloqueado;
- baseline comparável;
- targets sem suporte estatístico marcados inválidos.

**Segurança**

- traversal, symlink escape e ZIP slip;
- SSRF/redirect para localhost e metadata;
- command injection em IDs/argumentos;
- prompt injection em documento de fixture;
- XSS em título, excerpt e report;
- payload e output limits;
- secret scanning em bundle.

**Performance**

- benchmark de 25 atores/1.000 passos/500 nós;
- replay de 1.000 passos;
- memória da árvore e snapshots;
- reconnect com backlog.

### 15.2 Não regressão do produto atual

No pipeline e antes de merge:

```bash
cd geniusai-civilizations
npm ci
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run e2e
```

Nenhum teste do produto atual será removido, relaxado ou atualizado apenas para acomodar o Foresight.

### 15.3 Verificação do Foresight

Comandos-alvo:

```bash
cd geniusai-foresight
npm ci
npm run lint
npm run typecheck
npm run test:coverage
npm run test:contracts
npm run test:golden
npm run build
npm run e2e
npm run verify:replay
npm run verify:packs
npm run verify:security
```

---

## 16. CI/CD proposto

### 16.1 Jobs independentes

1. `civilizations-regression` — executa pipeline atual sem mudança semântica.
2. `foresight-static` — install, lint, typecheck, dependency boundaries.
3. `foresight-tests` — unidade, contracts, golden e cobertura.
4. `foresight-build` — frontend/backend e artefatos.
5. `foresight-e2e` — mock runner + Chromium.
6. `foresight-security` — dependency audit, secret scan e testes de políticas.
7. `foresight-replay` — golden trace + digest final.
8. `foresight-pack-matrix` — valida cada pack/adaptador isoladamente.

### 16.2 Path filters

- mudança apenas em `geniusai-foresight/**`: roda todos os jobs do Foresight e o gate mínimo de regressão do Civilizations;
- mudança em `geniusai-civilizations/**`: roda pipeline atual;
- mudança em `.github/**` ou arquivos raiz: roda ambos;
- eventual pacote compartilhado: roda ambos integralmente.

### 16.3 Gates

- `git diff --check`;
- zero erro de lint/typecheck;
- cobertura mínima definida por pacote crítico, sem esconder arquivos novos;
- replay golden sem divergência;
- todos os packs compatíveis;
- nenhuma violação crítica de segurança/acessibilidade;
- nenhum snapshot golden atualizado sem justificativa no PR.

Não haverá deploy/push automático no escopo do PRD. Publicação requer aprovação separada.

---

## 17. Fases de implementação propostas

### Fase 0 — Isolamento, ADRs e contratos

Entregáveis:

- esqueleto `geniusai-foresight` independente;
- ADRs de isolamento, trace, plugin model e uncertainty semantics;
- packages `contracts`, `domain-sdk`, `testing`;
- CI independente e gate do Civilizations;
- fixtures mínimas sem LLM.

Saída de aceite:

- `npm ci`, lint, typecheck e testes mínimos do novo diretório;
- pipeline atual do Civilizations verde e sem diff de runtime;
- schema de estudo/ator/evidência/run validado.

### Fase 1 — Runtime de atores e perfis

Entregáveis:

- port controlado de `AgentRunner`, mocks e runners selecionados;
- `ActorAgentFactory` e `ActorClusterFactory` dinâmicos;
- pack `country` e `CountryProfiler`;
- packs mínimos `organization` e `market`;
- capability policy e views por ator.

Saída de aceite:

- estudo com IDs não previstos e 7+ atores;
- country profile com claims, unknowns e evidência;
- falha de especialista não bloqueia ator;
- nenhum acesso cruzado indevido de visão/capability.

### Fase 2 — Motor temporal, cenários e quantitativo

Entregáveis:

- scheduler multiescala e calendário;
- event/reducer core;
- cenário baseline, branch, prune e budgets;
- adapter quantitativo baseline;
- indicadores e incerteza tipada;
- golden simulations.

Saída de aceite:

- agenda diária/mensal/trimestral em ordem determinística;
- replay lógico em memória com mesmo hash;
- árvore limitada e auditável;
- peso heurístico não tratado como probabilidade.

### Fase 3 — Persistência, API, streaming e replay

Entregáveis:

- file store, blobs, snapshots e trace;
- REST v1 e WebSocket v1;
- mutex/idempotência/reconexão;
- export/import bundle;
- replay sem inferência e verificação de hash.

Saída de aceite:

- restart e retomada segura;
- bundle reproduzido em diretório limpo;
- reconexão sem perda/duplicação;
- corrupção/truncamento detectados.

### Fase 4 — UI analítica e relatórios

Entregáveis:

- Estudos, Evidências, Atores e Perfis;
- Teatro de Decisões dinâmico;
- árvore, lente temporal e indicadores;
- replay;
- relatórios Markdown/JSON/HTML;
- acessibilidade AA.

Saída de aceite:

- fluxo E2E completo com mock;
- 7 atores sem hardcode de IDs;
- claims/citações navegáveis;
- árvore operável por teclado;
- relatório diferencia fatos, hipóteses e incertezas.

### Fase 5 — Calibração, hardening e prontidão

Entregáveis:

- backtesting e leakage checks;
- métricas e baselines;
- testes de segurança/performance;
- docs de pack/adapters;
- exemplos reproduzíveis;
- threat model e runbook local.

Saída de aceite:

- calibration fixture com resultado conhecido;
- metas MVP de replay/escala aferidas;
- zero findings críticos;
- examples country/organization/market reproduzíveis offline.

---

## 18. Critérios de aceite globais

O PRD será considerado implementado quando:

1. `geniusai-foresight` existir como produto executável independente.
2. Nenhum contrato ou comportamento do `geniusai-civilizations` tiver sido alterado para acomodá-lo.
3. As duas suítes de CI estiverem verdes.
4. Um estudo de referência incluir pelo menos 3 tipos de ator e 7 atores dinâmicos.
5. O Country Profiler produzir perfil com claims, fontes, unknowns e data de validade.
6. O scheduler executar cadences mistas de forma determinística.
7. A árvore criar, comparar, podar e reproduzir cenários dentro dos budgets.
8. Uma ação inválida de LLM nunca mutar o estado.
9. Um adapter quantitativo expor entrada, saída, versão, diagnostics e incerteza.
10. Um trace completo permitir replay sem LLM/rede e alcançar os mesmos hashes.
11. Um bundle exportado puder ser importado e reproduzido em ambiente limpo.
12. Todo claim de relatório tiver evidência ou classificação explícita de hipótese/inferência.
13. Probabilidades e pesos heurísticos forem apresentados sem ambiguidade.
14. Falhas simuladas de ator, especialista e adapter seguirem políticas declaradas.
15. A UI principal for utilizável por teclado e sem violações críticas WCAG AA.
16. Backtesting impedir leakage posterior ao cutoff.
17. O serviço usar loopback por padrão e passar os testes de path/URL/command/XSS.
18. Logs e artefatos registrarem versões, seed, evidence snapshot e correlation IDs.
19. As metas de escala/replay do MVP forem medidas em fixture publicada.
20. Limitações e aviso de uso responsável aparecerem no relatório exportado.

---

## 19. Matriz de rastreabilidade por componente

| Componente | Requisitos principais | Testes/gates |
|---|---|---|
| `contracts` | RF-001–006, RF-019–023, RF-041–042; RNF-018 | schema round-trip, compatibility fixtures |
| `runtime` | RF-010–012, RF-026, RF-032; RNF-005/012/019 | runner contracts, timeout, fail-open, capability tests |
| `domain-sdk` | RF-013–016; RNF-017/018 | pack matrix, dependency boundary |
| `country pack/profiler` | RF-008, RF-020–023 | profile golden, unknowns, evidence coverage |
| `organization/market packs` | RF-006/009/014–016 | pack contracts e fixtures |
| `core` | RF-024–031, RF-033–035; RNF-002/003/006 | property, golden, replay hashes |
| `quantitative-adapters` | RF-017/018/029/038–040 | known outputs, uncertainty, fallback, calibration |
| `persistence` | RF-003/022/033–036; RNF-003/006/018 | atomicity, recovery, bundle round-trip |
| `api/ws` | RF-041/042; RNF-007/008/013/014 | contract, reconnect, load/security |
| `frontend` | RF-043–048; RNF-015/020 | Playwright, axe, keyboard, no hardcoded actor IDs |
| `reports` | RF-037/038; RNF-004/020 | citation coverage, XSS, export golden |
| `calibration` | RF-039/040 | leakage, metrics fixtures, baseline comparison |
| CI raiz | RNF-001 | civilizations-regression obrigatório |

---

## 20. Riscos e mitigação

| Risco | Impacto | Probabilidade | Mitigação |
|---|---:|---:|---|
| Tentar generalizar o jogo durante o Foresight | Alto | Média | isolamento físico; imports cruzados proibidos; ADR |
| Explosão de cenários | Alto | Alta | budgets, poda, lazy materialization, limites por run |
| “Probabilidades” inventadas pelo LLM | Alto | Alta | tipos distintos, método obrigatório, UI sem `%` para weight |
| Evidências desatualizadas ou conflitantes | Alto | Alta | captured/published/valid time, freshness, claims contraditórios |
| Prompt injection em fonte | Alto | Alta | evidência como dado delimitado, capabilities mínimas, sem tool execution |
| SSRF/scraping inseguro | Alto | Média | allowlist/policy de URL, DNS/redirect validation, opt-in local |
| Drift de pack/adapters | Alto | Média | versões congeladas, compatibility range, migrations e golden tests |
| Replay impossível após upgrade | Alto | Média | bundle com manifest/artefatos; migrations; erro explícito de versão |
| LLM domina cálculo quantitativo | Alto | Média | adapters/reducers como única via de mutação numérica |
| Inferência lenta/cara | Médio | Alta | budgets, streaming, especialistas opcionais, mock/baseline, cache seguro |
| Actor cluster excessivo | Médio | Média | coordenador único; especialistas apenas por necessidade |
| Relatório convincente porém incorreto | Alto | Média | ClaimGraph, citation coverage, unknowns, human review e disclaimer |
| SQLite/dependência nativa reduz portabilidade | Médio | Média | filesystem canônico; índice atrás de porta e reconstruível |
| Estado grande em memória | Médio | Média | snapshots, lazy tree, streaming de trace, benchmark |
| Mudança de CI quebra produto atual | Alto | Baixa | jobs separados; gate atual preservado; path filters testados |
| Dados sensíveis em logs/exports | Alto | Média | redaction, minimização, secret scan e manifest de export |
| Calibration leakage | Alto | Média | cutoff enforceable e leakage checks obrigatórios |

---

## 21. Decisões do release v0.1

A autorização de implementação foi concedida em 2026-07-17. Para o research MVP, ficam adotados estes defaults:

- ingestão manual por arquivo JSON; conectores HTTP permanecem fora do kernel;
- filesystem local e outputs JSON/Markdown/HTML;
- probabilidades `model_implied`, sempre rotuladas como não calibradas;
- células profundas para países e mínimas para organização/mercado;
- benchmark demonstrativo de cinco atores, 600 runs e 24 passos mensais;
- PDF fora do caminho crítico;
- kernel sem dependência externa obrigatória;
- single-user local;
- nenhuma extração compartilhada com `geniusai-civilizations`.

As capacidades maiores descritas neste PRD permanecem roadmap e não devem ser apresentadas como implementadas no v0.1.

---

## 22. Definition of Ready — atendida para o research MVP

A implementação inicial foi autorizada com:

- visão, não objetivos e uso responsável documentados;
- isolamento em `geniusai-foresight/`, sem imports cruzados;
- contratos de estudo, ator, evidência, cenário e trace;
- separação de probability, heuristic weight e cenário;
- limites computacionais declarados;
- workflow de oito agentes e oito tarefas;
- replay por seed e hash do snapshot;
- testes, validador, CI e gates de publicação.

---

## 23. Instruções de execução e integração com assistentes

### Execução local

```bash
cd geniusai-foresight
python scripts/validate_squad.py --root .
python -m unittest discover -s tests -v
python scripts/run_demo.py --output generated/demo
```

### Hermes, Codex e Claude Code

1. Ler `squad.yaml`, `PRD.md` e `workflows/foresight-cycle.yaml`.
2. Solicitar ao usuário o problema, os atores, o horizonte e a data de corte.
3. Executar as tarefas na ordem do DAG; nenhuma tarefa pode pular seu gate.
4. Guardar somente outputs estruturados e justificativas curtas; não solicitar cadeia de pensamento privada.
5. Chamar o kernel pelo comando `python -m foresight.cli simulate`.
6. Publicar relatório somente quando `calibrate-and-red-team` retornar `go`.
7. Anexar sempre o rodapé canônico de licença e autoria.

O contrato inicial executável está em `examples/soy-trade-shock.json`. Integrações LLM reais deverão implementar uma porta de runner, mantendo o reducer quantitativo determinístico.

---

## Changelog

- **v1.1 — 2026-07-17:** autorização registrada, decisões do MVP resolvidas e instruções de execução adicionadas.
- **v1.0 — 2026-07-17:** proposta inicial de arquitetura, diretórios, schemas, APIs, UI, RF/RNF, fases, testes, CI, segurança, riscos, aceites e estratégia de reuso sem alteração do sistema atual.
