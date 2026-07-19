# GeniusAI

Repositório-guarda-chuva com os projetos do GeniusAI. Cada projeto vive na sua própria pasta, com seu próprio `package.json`, README e histórico.

> **Para onde tudo converge:** o [PRD — Genius Allspark](docs/PRD-genius-allspark.md)
> descreve o produto unificado que funde os três projetos deste repositório
> (SO-IA, Foresight, Civilizations) com Hermes Agent, OmniRift e os conceitos
> do Nirvana-OS — regido por quatro leis: nada existe sem o organograma,
> nenhuma missão sem ensaio, nenhum resultado sem recibo, e autonomia se
> conquista, não se configura.
>
> **Como construir, agora:** o
> [Guia de Construção](docs/PRD-genius-allspark-construcao.md) é o plano
> literal — Motor do Canvas, Hub de Provedores LLM, Biblioteca de Agentes &
> Squads, Super Construtor (Companies/Squads/Agents/Mind-Clones/Packs) e
> Motor de Aprendizado com memória indexada — cada etapa com o código
> existente a reaproveitar e um prompt pronto para uma IA construir agora.
> O [PRD de Execução](docs/PRD-genius-allspark-execucao.md) mantém a visão em
> fases mais amplas como contexto complementar.

## Genius Allspark Canvas — em construção

O monorepo `packages/*` + `apps/*` na raiz é o código do Canvas em si,
seguindo o [Guia de Construção](docs/PRD-genius-allspark-construcao.md):

| Pacote | Etapa | O que é |
|---|---|---|
| [`packages/canon`](packages/canon/) | 0/1/2/3 | Schemas Zod compartilhados (Agent, Squad, Company, MindClone, Pack, ProviderConfig, LearningFlow, MemoryChunk, Task, Run, Approval, CanvasNode, CanvasEdge) + catálogo de eventos |
| [`packages/providers`](packages/providers/) | 2 | Hub de Provedores LLM: `LLMProviderAdapter` + adapters reais para Anthropic, OpenAI (ChatGPT), Codex (CLI), Ollama e endpoints OpenAI-compatíveis (OpenRouter/vLLM/LM Studio) — generaliza o `AgentRunner` que já existia em `geniusai-civilizations` |
| [`packages/agent-library`](packages/agent-library/) | 3 | Biblioteca de Agentes & Squads: importadores puros (sem executar código de outro projeto) que leem, via AST do TypeScript, os catálogos reais de `so-ia` (12 agentes + 7 squads), `geniusai-foresight` (8 agentes YAML) e `geniusai-civilizations` (4 perfis de civilização) |
| [`packages/constructor`](packages/constructor/) | 0/1/2/3/4 | Super Construtor v0: banco SQLite real, CRUD para as doze entidades do canon, `POST /providers/:id/health-check`, `POST /library/import`, "reaproveitar ou criar" (`/agents/match`, `/squads/match` — porte fiel do algoritmo de `so-ia/src/lib/org/matching.ts`) e Packs (exportar/importar Company, mais a pasta `packs/` observada) |
| [`apps/canvas`](apps/canvas/) | 1/2/3/4 | O Motor do Canvas Infinito, os painéis "Provedores" e "Biblioteca", e a tela **Super Construtor**: montar Company → Squad → Agent com formulários guiados que sugerem reaproveitar antes de criar, mais o wizard de criação de Mind-Clone (6 camadas + documentos de referência) |

Rodar localmente:

```bash
npm install
npm run build && npm run test             # todos os workspaces
node packages/constructor/dist/start.js   # Super Construtor em :4001
npm run dev -w apps/canvas                # Canvas em :5173
```

Abra `http://localhost:5173` com o Super Construtor rodando: o badge no
canto superior esquerdo mostra "conectado"; `⌘K`/`Ctrl+K` abre a paleta de
comandos para criar um nó ou buscar um existente pelo nome.

## Projetos

- **[`geniusai-civilizations/`](geniusai-civilizations/)** — *Watchable AI*: simulação onde civilizações (Roma, Egito, Grécia, Mali) são governadas por agentes autônomos acionados por um CLI de agente (Claude Code / Codex / opencode) ou Ollama, observável em tempo real via uma UI local. Veja o [README do projeto](geniusai-civilizations/README.md) e o [PRD](geniusai-civilizations/docs/PRD-watchable-ai-civilizations.md).
- **[`geniusai-foresight/`](geniusai-foresight/)** — *Strategic Foresight*: squad científico para simulação prospectiva de países, instituições e mercados, com células adaptativas de agentes, evidências point-in-time, Teoria dos Jogos, cenários estocásticos e replay auditável. Veja o [README](geniusai-foresight/README.md) e o [PRD](geniusai-foresight/PRD.md).
- **[`so-ia/`](so-ia/)** — *SO-IA*: front-end premium do Sistema Operacional de IA para empresas privadas e o setor público brasileiro (Modo Empresa / Modo Governo) — Centro de Comando, catálogo de Agentes & Skills, workflows com segregação de funções e caixa de aprovações human-in-the-loop. Veja o [README do projeto](so-ia/README.md) e o [PRD](so-ia/docs/PRD-so-ia-v2.md).

## Licença

MIT — ver [`LICENSE`](LICENSE). Aplica-se a todo o repositório, salvo indicação em contrário dentro de um projeto específico.
