# SO-IA — Sistema Operacional de IA

Front-end premium e navegável do **SO-IA**, a plataforma de agentes de IA
governados descrita no [PRD v2.0](docs/PRD-so-ia-v2.md) — um núcleo único
que atende **empresas privadas (20–500 colaboradores)** e o **setor público
brasileiro** (âncora: Instituto Federal Farroupilha / Coordenação de
Licitação e Contratos) em dois perfis (**Modo Empresa** / **Modo Governo**).

Este é o primeiro incremento do produto: a camada de apresentação, com
dados mockados realistas, para validar a direção de design antes de plugar
um backend real (multi-tenant, Temporal, Postgres+RLS, conectores MCP para
PNCP/SIPAC/SIAFI etc. — ver `docs/PRD-so-ia-v2.md`, §11).

## Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** (sobre `@base-ui/react`) para os componentes de base
- **Framer Motion** para as animações (entradas, transições de modo, gráfico radial, contadores)
- **Recharts** para os gráficos do Centro de Comando
- **next-themes** para dark/light mode

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. A tela inicial (`/`) é o landing/login; o
app propriamente dito vive em `/app/*`.

## Estrutura de telas

| Rota | Descrição |
|---|---|
| `/` | Landing/login com o grafo radial do Núcleo de Conhecimento (§5 do PRD), animado e reativo ao modo selecionado. |
| `/app/dashboard` | Centro de Comando — KPIs, execuções x aprovações, atividade recente. Muda completamente de conteúdo entre Modo Empresa (Vendas/Marketing/…) e Modo Governo (Licitações e Contratos, vigências, conformidade append-only). |
| `/app/agentes` | Catálogo de Agentes & Skills, com busca, filtro por área e painel de detalhe (skills SKILL.md, conectores MCP, política de modelo, autonomia). |
| `/app/workflows` | Construtor visual (read-only) do workflow de pesquisa de preços, com a regra de **segregação de funções** (Acórdão TCU nº 1668/2021) destacada. |
| `/app/aprovacoes` | Caixa de aprovações (human-in-the-loop): lista + painel mestre-detalhe com citações verificáveis e ação de aprovar/rejeitar. |
| `/app/aprovacoes/atesto-nf` | Caso demonstrador completo (§9.1 do PRD): extração da NF-e, conferência contra o empenho, citações e trilha de auditoria append-only. |

Todo o conteúdo reage ao seletor **Empresa / Governo** no topo — cores,
áreas de negócio, KPIs, agentes e workflows trocam de acordo com o tenant
ativo (persistido em `localStorage`).

## Dados

Todo o conteúdo é mockado em `src/lib/data/*.ts`, derivado diretamente dos
agentes, skills, KPIs e casos de uso descritos no PRD (§7, §9, §12).
Nenhuma integração real (SIPAC, PNCP, Compras.gov.br etc.) foi implementada
nesta etapa.

## Próximos passos

Ver roadmap em 5 fases no PRD (§25). Este incremento cobre o essencial da
**Fase 1 (Núcleo) — camada de apresentação**; faltam multi-tenancy real,
RAG com citações vivas, motor de autonomia A0–A5 com guardrails, e os
conectores MCP para os sistemas governamentais.
