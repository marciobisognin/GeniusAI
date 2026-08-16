# `genius-organograma-pdf` — plug-in de extração normativa

Transforma a **portaria em PDF** na estrutura institucional executável. É a
metade Python do fluxo do organograma: este plug-in entrega a estrutura, e o
servidor MCP [`genius-organograma`](../../packages/mcp-organograma/) decide
sobre ela (cobertura pela Lei 1, agentes, squads, workflows).

Item 6 do roadmap da [análise de plug-ins](../../docs/ANALISE-PLUGINS-HERMES.md) (§3.6).

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `org_extract_pdf` | Unidades com código, nome e hierarquia, da tabela vetorial do PDF |
| `org_extract_competencias` | Competências por artigo, do Anexo da portaria |

Os extratores usam detecção de tabelas do `pdfplumber` e recuperam linhas
cortadas por quebra de página e códigos que somem da detecção — conhecimento de
domínio depurado contra a Portaria nº 876/2026-GRE do IFFar.

## Instalar

```bash
python3 iffar-3d-town/hermes_plugin/sync_extractors.py   # atualiza a cópia embarcada
cp -r iffar-3d-town/hermes_plugin ~/.hermes/plugins/genius-organograma-pdf
hermes plugins enable genius-organograma-pdf             # instala pdfplumber, pypdf, PyYAML
```

## Por que os extratores viajam dentro do plug-in

O Hermes instala um plug-in copiando **o diretório do plug-in** para
`~/.hermes/plugins/<nome>/`. O diretório irmão `tools/` não vai junto — um
plug-in que dependesse de `../tools` carregaria normalmente e **falharia em
toda extração** fora de um checkout do repositório.

Por isso `extractors/` existe: é uma cópia derivada de `tools/*.py`, que
continua sendo a fonte de verdade (e a CLI documentada no README do projeto).
`sync_extractors.py --check` roda no teste e falha se as duas divergirem.

## Cuidado com os padrões de página

`last_page: 18` e `first_page: 17` foram depurados contra **uma** portaria.
Outro documento provavelmente precisa de outros valores — por isso são
parâmetros, não constantes escondidas. Se a contagem de unidades vier
obviamente errada, ajuste em vez de aceitar o resultado.

## Testes

```bash
cd iffar-3d-town
python3 -m unittest discover -s hermes_plugin -p 'test_*.py'
```

17 testes: registro, contrato dos handlers sob entrada hostil (nenhum levanta
exceção, mesmo sem `pdfplumber` instalado), e a resolução dos extratores
funcionando quando só a cópia embarcada existe — o cenário da instalação real.
