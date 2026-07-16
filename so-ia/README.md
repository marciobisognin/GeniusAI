# SO-IA — Sistema Operacional de IA

Front-end premium e navegável do **SO-IA**, a plataforma de agentes de IA
governados descrita no [PRD v2.0](docs/PRD-so-ia-v2.md) — um núcleo único
que atende **empresas privadas (20–500 colaboradores)** e o **setor público
brasileiro** (âncora: Instituto Federal Farroupilha / Coordenação de
Licitação e Contratos).

**Nada vem pré-carregado.** Não existe um "Modo Empresa" ou "Modo Governo"
fixo com dados prontos: o sistema só é montado depois que o usuário descreve
o organograma da sua organização — cargos/funções, área de cada um e suas
responsabilidades. A partir disso, o SO-IA busca um agente compatível no
catálogo institucional para cada função ou cria um novo, sob medida, quando
não encontra correspondência — e disponibiliza esse agente para aquele
elemento do organograma executar.

Este é o primeiro incremento do produto: a camada de apresentação, com um
motor de correspondência/criação de agentes simulado no cliente (sem LLM
real), para validar o fluxo e a direção de design antes de plugar um backend
real (multi-tenant, Temporal, Postgres+RLS, conectores MCP para
PNCP/SIPAC/SIAFI, geração de agentes via LLM etc. — ver `docs/PRD-so-ia-v2.md`, §11).

## Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** (sobre `@base-ui/react`) para os componentes de base
- **Framer Motion** para as animações (entradas, transições, gráfico radial, contadores, console de montagem)
- **Recharts** para os gráficos do Centro de Comando
- **next-themes** para dark/light mode

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Sem uma organização configurada, qualquer rota
`/app/*` redireciona automaticamente para o onboarding.

## Fluxo de onboarding (o coração do produto)

| Rota | O que acontece |
|---|---|
| `/onboarding/tipo` | Escolha entre **Empresa privada** ou **Órgão público** + nome da organização. |
| `/onboarding/organograma` | Construtor do organograma: cargos/funções, área, responsabilidades (tags) e hierarquia ("reporta-se a"). Pode partir do zero ou carregar um exemplo editável para acelerar. |
| `/onboarding/montagem` | Console animado: para cada função, busca um agente compatível no catálogo institucional (score por sobreposição de palavras-chave entre responsabilidades e a descrição/skills dos agentes existentes); sem correspondência ≥ limiar, sintetiza um novo agente (nome, descrição, skills e autonomia A2 por padrão) na hora. |

O motor de correspondência/criação vive em `src/lib/org/matching.ts`
(`assembleOrganization`), sobre o catálogo institucional combinado
(`src/lib/data/agents.ts`) e o organograma do usuário (`src/lib/data/org-chart.ts`).
Todo o estado (organograma + resultado da montagem) é mantido em
`OrganizationProvider` (`src/components/providers/organization-provider.tsx`)
e persistido em `localStorage`.

## Estrutura de telas (pós-montagem)

| Rota | Descrição |
|---|---|
| `/` | Landing com o grafo radial do Núcleo de Conhecimento — mostra as áreas do organograma já montado, ou uma prévia genérica antes da configuração. |
| `/app/organograma` | Árvore do organograma com o agente atribuído a cada função (badge "do catálogo" ou "criado sob medida"), botão para executar e link para o detalhe completo do agente. |
| `/app/dashboard` | Centro de Comando — KPIs, execuções x aprovações, atividade recente (conteúdo ilustrativo de referência, com o nome real da organização). |
| `/app/agentes` | Catálogo de Agentes & Skills — lista os agentes efetivamente atribuídos pelo organograma, com busca, filtro por área e painel de detalhe (skills SKILL.md, conectores MCP, política de modelo, autonomia). |
| `/app/workflows` | Cenário de referência: workflow de pesquisa de preços com a regra de **segregação de funções** (Acórdão TCU nº 1668/2021) destacada. |
| `/app/aprovacoes` | Cenário de referência: caixa de aprovações (human-in-the-loop) com citações verificáveis e ação de aprovar/rejeitar. |
| `/app/aprovacoes/atesto-nf` | Cenário de referência (§9.1 do PRD): extração da NF-e, conferência contra o empenho, citações e trilha de auditoria append-only. |

Os "cenários de referência" (dashboard, workflows, aprovações, caso de
atesto) continuam com dados mockados fixos — eles ilustram o que os agentes
fazem em operação, mas não são recalculados a partir do organograma
específico do usuário nesta etapa.

## Dados

Catálogo institucional, skills e cenários de referência em
`src/lib/data/*.ts`, derivados do PRD (§7, §9, §12). Nenhuma integração real
(SIPAC, PNCP, Compras.gov.br etc.) e nenhum LLM real foram implementados
nesta etapa — a "criação de agente" é uma síntese determinística no cliente.

## Próximos passos

Ver roadmap em 5 fases no PRD (§25). Este incremento cobre o essencial da
**Fase 1 (Núcleo) — camada de apresentação com onboarding orientado a
organograma**; faltam multi-tenancy real, geração de agentes via LLM, RAG
com citações vivas, motor de autonomia A0–A5 com guardrails, e os
conectores MCP para os sistemas governamentais.
