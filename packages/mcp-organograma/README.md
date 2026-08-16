# `@genius/mcp-organograma`

Servidor **MCP** do compilador de organograma — a **Lei 1** do produto
("nada existe sem o organograma") disponível para o Hermes Agent, o Claude
Code, o Codex e qualquer cliente MCP.

Item 4 do roadmap da [análise de plug-ins do Hermes](../../docs/ANALISE-PLUGINS-HERMES.md) (§3.2).

## Por que MCP e não plug-in nativo

O plug-in nativo do Hermes é Python; este motor é TypeScript. Mas o motivo
principal é outro: **o mesmo servidor atende vários agentes**. Um plug-in
nativo serviria só o Hermes.

## Rodar

```bash
npm run build -w packages/mcp-organograma
node packages/mcp-organograma/dist/bin.js      # transporte stdio
```

No `config.yaml` do Hermes (ou no `.mcp.json` do Claude Code):

```json
{
  "mcpServers": {
    "genius-organograma": {
      "command": "node",
      "args": ["/caminho/para/GeniusAI/packages/mcp-organograma/dist/bin.js"]
    }
  }
}
```

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `org_import` | Lê organograma de texto, colagem ou arquivo (CSV/TXT/MD) |
| `org_covers` | **O guarda da Lei 1**: a área existe neste organograma? |
| `org_match` | Reaproveitar agente do catálogo × gerar novo |
| `org_assemble` | Resolve o organograma inteiro de uma vez |
| `org_build_squad` | Monta squads por área, reaproveitando templates |
| `org_find_squad` | Procura squad compatível; só propõe novo se pedido |
| `org_workflow` | Deriva o fluxo de trabalho, com os pontos de aprovação |
| `org_template` | Organograma-semente (`empresa` ou `governo`) |

## A Lei 1 como política de execução

`org_covers` responde se um conteúdo de determinada área faz sentido para o
organograma carregado. As instruções do servidor mandam o agente chamá-la
**antes** de oferecer, criar ou executar qualquer coisa — e quando a resposta
é `coberto: false`, aquela área não existe naquela organização:

```json
{
  "coberto": false,
  "area": "Marketing",
  "justificativa": "nenhuma unidade do organograma cobre esta área nem este assunto",
  "unidades": 2
}
```

## Decisões que valem registro

- **`org_find_squad` não cria por conta própria.** Sem template compatível,
  devolve `encontrado: false` e para. Só propõe um squad novo quando
  `criar: true` — e sempre em `dryRun`: um servidor MCP não grava estado do
  produto.
- **Erro é resultado, não queda.** Argumento inválido volta como
  `{ "error": … }` com `isError`, e o servidor continua no ar (coberto por
  teste).

## Testes

```bash
npm run build -w packages/mcp-organograma
npm test -w packages/mcp-organograma
```

24 testes: contrato das ferramentas, os quatro casos da Lei 1, importação e
montagem, e um teste de ponta a ponta em que um **cliente MCP real** fala
JSON-RPC por stdio com o servidor.
