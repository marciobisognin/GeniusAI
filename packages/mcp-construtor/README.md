# `@genius/mcp-construtor`

Servidor **MCP** do Super Construtor, com superfície **deliberadamente
assimétrica**.

Item 6 do roadmap da [análise de plug-ins do Hermes](../../docs/ANALISE-PLUGINS-HERMES.md) (§3.5).

## A assimetria é o produto

O PRD (§3.4) diz que o runtime de execução *"nunca decide política, orçamento
ou aprovação — apenas executa"*. Um servidor que espelhasse a API inteira do
Construtor daria ao agente o poder de **aprovar o próprio trabalho** e de
**escrever credenciais**. Por isso:

| O agente pode | O agente não pode |
|---|---|
| Listar e ler agents, squads, companies, runs, approvals… | Ler ou escrever `providers` (credenciais) |
| Reaproveitar agente/squad (`match`) | Resolver aprovação (`POST /approvals/:id/resolve`) |
| Exportar company como pack | Importar packs ou catálogos |
| Buscar na memória indexada | Alterar política ou orçamento |
| Executar nós **A3+** | Executar nós A0–A2 |

O recorte mora em [`src/policy.ts`](src/policy.ts), com testes que falham se
alguém alargar a superfície sem perceber.

## O portão da autonomia

`constructor_execute` resolve a autonomia do nó antes de disparar. A checagem
usa **lista de permissão** (`A3`, `A4`, `A5`), não lista de bloqueio: um valor
inesperado — vazio, nulo, um nível novo — cai do lado seguro. Um squad é
bloqueado pelo membro de **menor** autonomia.

```json
{
  "status": "recusado",
  "autonomia": "A1",
  "motivo": "autonomia A1 exige aprovação humana, e este servidor não pode resolver aprovações (o executor não aprova o próprio trabalho). Execute pelo Canvas, onde um humano decide."
}
```

## Rodar

```bash
npm run build -w packages/mcp-construtor
GENIUS_CONSTRUCTOR_URL=http://127.0.0.1:3333 node packages/mcp-construtor/dist/bin.js
```

O servidor é um **cliente HTTP** do Construtor, não um segundo processo com o
mesmo banco: a política vive numa fronteira real, e o Construtor continua dono
do estado.

## Testes

```bash
npm test -w packages/mcp-construtor
```

23 testes. Os de integração sobem o **Super Construtor real** (Fastify +
SQLite) e exercitam o portão de autonomia ponta a ponta — testar contra um
dublê provaria que o cliente fala com o dublê, não que a política se sustenta.
