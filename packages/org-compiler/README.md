# `@genius/org-compiler`

O compilador de organograma, extraído de `so-ia/src/lib/org/*` — onde nasceu
junto com a **Lei 1** do produto ("nada existe sem o organograma", em
`relevance.ts`).

O motor é TypeScript puro, sem React/Next: mora aqui para poder ser consumido
por servidores MCP, plug-ins e outros pacotes, não só pelo app. É o que o
[PRD do Allspark](../../docs/PRD-genius-allspark.md) prevê ao mandar extrair os
motores do `so-ia` "com golden tests garantindo comportamento idêntico".

## O que tem dentro

| Módulo | Função |
|---|---|
| `import.ts` | `parseOrgFile`, `parseOrgText`, `parseOrgPasted` |
| `relevance.ts` | `organizationCovers` — **a Lei 1** |
| `matching.ts` | `matchNode`, `assembleOrganization` |
| `squads.ts` · `squad-registry.ts` | `buildSquads`, `findSquadTemplate`, `createSquadTemplate` |
| `workflow-builder.ts` | `buildOrgWorkflow` |
| `templates.ts` | Organogramas-semente (empresa, governo) |
| `catalog.ts` · `skillDescriptions.ts` | 12 agentes e as descrições de skills |

Fora do pacote: `pdf-extract.ts`, que é `"use client"` e depende de `pdfjs-dist`
no navegador. Do lado do servidor essa lacuna é preenchida pelos extratores
Python em [`iffar-3d-town/hermes_plugin`](../../iffar-3d-town/hermes_plugin/).

## A única mudança de comportamento

`squad-registry.ts` guardava os squads criados em `window.localStorage`, que
não existe fora do navegador — e o código já devolvia lista vazia nesse caso.
A dependência virou uma porta injetável, com **o mesmo padrão de antes**:

```ts
import { setSquadStore, createMemorySquadStore } from "@genius/org-compiler";

setSquadStore(createMemorySquadStore()); // opt-in: agora persiste no processo
setSquadStore(null);                     // volta a não persistir (padrão)
```

## Equivalência provada, não presumida

`test/golden/so-ia-baseline.json` foi gerado executando a implementação
**original** do `so-ia` (compilada com o alias `@/` resolvido) sobre uma
bateria de entradas — 22 superfícies, de `slugify` a `buildOrgWorkflow`. O
golden test roda a mesma bateria contra este pacote e exige saída **byte a
byte idêntica**.

```bash
npm run build -w packages/org-compiler
npm test -w packages/org-compiler
```

Se o golden test falhar, o pacote divergiu do `so-ia`. Só atualize a baseline
se a mudança for intencional **e feita nos dois lados**.
