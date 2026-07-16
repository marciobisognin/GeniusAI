# SO-IA — Sistema Operacional de IA

> Um sistema de agentes de IA que se monta sozinho a partir do organograma
> da sua empresa ou órgão público — em vez de vir pronto com um catálogo
> genérico que ninguém pediu.

Baseado no [PRD v2.0](docs/PRD-so-ia-v2.md), pensado para atender tanto
**empresas privadas (20–500 colaboradores)** quanto o **setor público
brasileiro** (âncora: Instituto Federal Farroupilha / Coordenação de
Licitação e Contratos).

![Landing — nada pré-carregado até você configurar sua organização](docs/screenshots/01-landing.png)

---

## Em uma frase

Você conta **quem faz o quê** na sua organização, e o SO-IA monta, para
cada função, um agente de IA — reaproveitando um agente pronto do catálogo
quando ele serve, ou criando um novo na hora quando não serve.

## Por que não vem tudo pronto?

Porque "um catálogo genérico de agentes" raramente encaixa na estrutura
real de uma empresa ou de um órgão público — cada organização tem seus
próprios cargos, suas próprias responsabilidades e sua própria hierarquia.
Em vez de forçar isso num molde fixo (o antigo "Modo Empresa" / "Modo
Governo" pré-carregado), o SO-IA começa **em branco** e só monta o sistema
depois de entender a sua organização.

---

## Como funciona, passo a passo

### 1. Você diz o tipo de organização

Empresa privada ou órgão público, e o nome da organização. Isso só ajusta o
vocabulário e o tema visual (cores) do restante do sistema.

![Passo 1 — tipo de organização](docs/screenshots/02-onboarding-tipo.png)

### 2. Você monta o organograma

Para cada cargo/função: **qual é o nome**, **em qual área** ele fica, **quais
são as responsabilidades** (em texto livre, viram tags) e **a quem ele se
reporta** — isso monta a hierarquia. Dá para começar do zero ou carregar um
exemplo pronto só para acelerar (e depois editar à vontade).

![Passo 2 — construtor de organograma](docs/screenshots/03-onboarding-organograma.png)

### 3. O sistema é montado sozinho

Para cada função, o SO-IA:

1. Compara as responsabilidades cadastradas com a descrição e as *skills*
   de cada agente do **catálogo institucional** (uma biblioteca de agentes
   já prontos, comum a todas as organizações).
2. Se encontra um agente com sobreposição suficiente, **reaproveita** esse
   agente para a função.
3. Se não encontra nada parecido, **cria um agente novo na hora** — com
   nome, descrição e *skills* derivados das responsabilidades daquele
   cargo.

Isso acontece com uma pequena animação, função por função — não é uma
tabela estática, é um processo que você acompanha acontecendo:

<table>
<tr>
<td width="50%"><img src="docs/screenshots/04-onboarding-montagem.png" alt="Montagem em andamento, buscando um agente compatível" /><br/><sub>Durante — buscando um agente compatível</sub></td>
<td width="50%"><img src="docs/screenshots/05-onboarding-montagem-completa.png" alt="Montagem concluída, com todas as funções resolvidas" /><br/><sub>Ao final — cada função resolvida</sub></td>
</tr>
</table>

### 4. Pronto: cada função tem seu agente

O resultado vira uma árvore navegável — o seu organograma, agora com um
agente de IA atribuído a cada caixinha, pronto para ser executado.

![Organograma montado, com agentes atribuídos](docs/screenshots/06-app-organograma.png)

E o catálogo de agentes passa a mostrar exatamente os agentes que foram
atribuídos ao *seu* organograma — não mais uma lista genérica:

![Catálogo de Agentes & Skills, montado a partir do organograma](docs/screenshots/07-app-agentes.png)

E o resto do sistema — Centro de Comando incluído — já reconhece a sua
organização pelo nome real, não por um tenant fictício:

![Centro de Comando com o nome real da organização](docs/screenshots/08-app-dashboard.png)

---

## Conceitos-chave

| Termo | O que significa aqui |
|---|---|
| **Organograma** | A estrutura de cargos/funções que você cadastra: título, área, responsabilidades e hierarquia. É o único "input" que o sistema precisa para se montar. |
| **Catálogo institucional** | A biblioteca de agentes de IA já existentes (ex.: *Agente de Atesto de Nota Fiscal*, *Agente de Triagem de Tickets*) que o sistema tenta reaproveitar antes de criar algo novo. |
| **Agente "do catálogo"** | Quando uma função do organograma encontrou um agente pronto compatível o suficiente. |
| **Agente "sob medida"** | Quando nenhum agente do catálogo serviu, e um novo foi criado especificamente para aquela função. |
| **Skill (SKILL.md)** | Uma capacidade reutilizável de um agente (ex.: `conferir-nf-contra-empenho`), no formato aberto SKILL.md da Anthropic. |
| **Autonomia (A0–A5)** | O quanto um agente pode agir sem revisão humana — de A0 (só observa) até A5 (autonomia ampliada). Atos administrativos vinculados ficam travados em A2 (prepara, mas não decide). |
| **Auditoria append-only** | Todo registro de execução/decisão de agente é imutável e rastreável — nunca sobrescrito. |
| **Conector MCP** | A forma padronizada (Model Context Protocol) como um agente se conecta a um sistema externo (SIPAC, PNCP, CRM etc.). |

---

## Rodando localmente

```bash
cd so-ia
npm install
npm run dev
```

Abra `http://localhost:3000`. Sem uma organização configurada, qualquer
tela do app (`/app/*`) redireciona automaticamente para o onboarding — não
tem como "pular" a etapa de configuração.

## Mapa de telas

| Rota | O que você encontra |
|---|---|
| `/` | Landing — apresenta o produto e leva para o onboarding (ou direto para o Centro de Comando, se você já configurou uma organização antes). |
| `/onboarding/tipo` | Passo 1 — tipo de organização + nome. |
| `/onboarding/organograma` | Passo 2 — construtor de organograma. |
| `/onboarding/montagem` | Passo 3 — console animado da montagem (busca no catálogo / criação de agente, função por função). |
| `/app/organograma` | O organograma final, em árvore, com o agente de cada função e um botão "Executar agora". |
| `/app/agentes` | Catálogo de Agentes & Skills — os agentes realmente atribuídos ao seu organograma, com busca, filtro por área e um painel de detalhe (skills, conectores, política de modelo, autonomia). |
| `/app/dashboard` | Centro de Comando — KPIs, execuções, atividade recente (cenário de referência ilustrativo, já com o nome real da sua organização). |
| `/app/workflows` | Cenário de referência: um workflow de pesquisa de preços com a regra de **segregação de funções** (Acórdão TCU nº 1668/2021) em destaque. |
| `/app/aprovacoes` | Cenário de referência: caixa de aprovações *human-in-the-loop*, com citações verificáveis. |
| `/app/aprovacoes/atesto-nf` | Cenário de referência (§9.1 do PRD): um atesto de nota fiscal completo, do início ao fim, com citações e trilha de auditoria. |

## Stack técnica

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** (sobre `@base-ui/react`) para os componentes de base
- **Framer Motion** para as animações (onboarding, gráfico radial, console de montagem, contadores)
- **Recharts** para os gráficos do Centro de Comando
- **next-themes** para dark/light mode

Todo o estado do organograma e da montagem vive em `OrganizationProvider`
(`src/components/providers/organization-provider.tsx`) e fica salvo no
`localStorage` do navegador. O motor de correspondência/criação de agentes
está em `src/lib/org/matching.ts`.

## O que ainda é simulado (por enquanto)

Este é o primeiro incremento do produto: a camada de apresentação.

- A "criação de um agente novo" é uma síntese determinística no cliente
  (compara palavras-chave), não uma chamada real a um LLM.
- Os cenários de referência (dashboard, workflows, aprovações, caso de
  atesto) usam dados mockados fixos — eles ilustram o que os agentes fazem
  em operação, mas não são recalculados a partir do organograma específico
  de cada usuário.
- Nenhuma integração real (SIPAC, PNCP, Compras.gov.br, SIAFI etc.) foi
  implementada ainda.

## Próximos passos

Ver o roadmap em 5 fases no PRD (§25). Depois desta camada de apresentação,
faltam: multi-tenancy real, geração de agentes via LLM de verdade, RAG com
citações vivas, motor de autonomia A0–A5 com guardrails, e os conectores
MCP para os sistemas governamentais e de CRM.
