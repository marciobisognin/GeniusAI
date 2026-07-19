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
| [`packages/canon`](packages/canon/) | 0 | Schemas Zod compartilhados (Agent, Squad, Company, MindClone, Pack, ProviderConfig, LearningFlow, MemoryChunk, Task, Run, Approval) + catálogo de eventos |
| [`packages/constructor`](packages/constructor/) | 0/4 | Super Construtor v0: banco SQLite real + servidor Fastify de CRUD para as dez entidades do canon |
| [`apps/canvas`](apps/canvas/) | 0/1 | O app do canvas infinito — hoje um placeholder que já fala com o Super Construtor; o motor de canvas de verdade (React Flow, nós, minimapa) é da Etapa 1 |

Rodar localmente:

```bash
npm install
npm run build && npm run test   # todos os workspaces
node packages/constructor/dist/start.js   # Super Construtor em :4001
npm run dev -w apps/canvas                # Canvas em :5173
```

## Projetos

- **[`geniusai-civilizations/`](geniusai-civilizations/)** — *Watchable AI*: simulação onde civilizações (Roma, Egito, Grécia, Mali) são governadas por agentes autônomos acionados por um CLI de agente (Claude Code / Codex / opencode) ou Ollama, observável em tempo real via uma UI local. Veja o [README do projeto](geniusai-civilizations/README.md) e o [PRD](geniusai-civilizations/docs/PRD-watchable-ai-civilizations.md).
- **[`geniusai-foresight/`](geniusai-foresight/)** — *Strategic Foresight*: squad científico para simulação prospectiva de países, instituições e mercados, com células adaptativas de agentes, evidências point-in-time, Teoria dos Jogos, cenários estocásticos e replay auditável. Veja o [README](geniusai-foresight/README.md) e o [PRD](geniusai-foresight/PRD.md).
- **[`so-ia/`](so-ia/)** — *SO-IA*: front-end premium do Sistema Operacional de IA para empresas privadas e o setor público brasileiro (Modo Empresa / Modo Governo) — Centro de Comando, catálogo de Agentes & Skills, workflows com segregação de funções e caixa de aprovações human-in-the-loop. Veja o [README do projeto](so-ia/README.md) e o [PRD](so-ia/docs/PRD-so-ia-v2.md).

## Licença

MIT — ver [`LICENSE`](LICENSE). Aplica-se a todo o repositório, salvo indicação em contrário dentro de um projeto específico.
