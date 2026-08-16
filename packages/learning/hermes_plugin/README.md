# `genius-memory` — memory provider do Hermes

Porte de [`packages/learning`](../) para o ponto de extensão de **memória** do
Hermes Agent. Item 5 do roadmap da
[análise de plug-ins](../../../docs/ANALISE-PLUGINS-HERMES.md) (§3.3).

## O diferencial: procedência

Os providers do ecossistema (`mem0`, `Mnemosyne`, `hindsight`) guardam
**conversas**. Este guarda também **execuções aprovadas por um humano**, e cada
trecho recuperado sabe de onde veio:

| `sourceType` | O que é | Peso |
|---|---|---|
| `approved-result` | Resultado que passou por aprovação humana | mais forte |
| `learning-flow` · `mind-clone-doc` | Conhecimento registrado do Allspark | forte |
| `conversation` | Conversa anterior, sem revisão | mais fraco |

Os três primeiros são **os valores do canon** (`MemoryChunkSourceType` em
`schemas/canon.schema.json`) — usar exatamente eles é o que permite um chunk
escrito aqui ser lido pelo motor TypeScript, e vice-versa. Um teste compara a
tupla do Python com o JSON Schema versionado. `conversation` é extensão só
deste lado (o Hermes sincroniza turnos; o canon não tem equivalente) e fica
declarada à parte, para não passar por canônica.

`prefetch` serve as aprovadas primeiro e **diz no próprio contexto** o que
passou por revisão humana e o que não passou. Indexar sem `source_id` é
recusado: memória sem procedência não entra.

## Instalar

```bash
cp -r packages/learning/hermes_plugin ~/.hermes/plugins/genius-memory
hermes plugins enable genius-memory
```

Sem dependências: o índice é **SQLite** (biblioteca padrão) e o embedding é
local. Configuração em `plugin.yaml` (`db_path`, `prefetch_k`), ou pela
variável `GENIUS_MEMORY_DB`.

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `memory_search` | Busca por significado, com procedência em cada resultado |
| `memory_index` | Indexa um trecho com procedência explícita |

## Paridade com o TypeScript

O embedding (hashing trick, 128 dimensões, normalizado L2) é **idêntico** ao de
`src/embeddings.ts`. Não por inspeção: o lado TypeScript gera
`tests/embedding-parity.json` com 14 casos — acentuação, caixa, repetição,
vazio, texto longo — e o teste Python exige o mesmo vetor com 12 casas
decimais. Se alguém mexer num lado só, quebra.

```bash
npm run parity -w packages/learning                 # regrava a fixture
python3 -m unittest discover -s hermes_plugin/tests -t .   # 26 testes
```

## Busca

Força bruta sobre 128 dimensões. Índice aproximado seria complexidade sem
ganho para corpora de execuções aprovadas — e custaria uma dependência que o
plug-in hoje não tem. Empates são resolvidos pelo id, para a ordem ser
determinística.
