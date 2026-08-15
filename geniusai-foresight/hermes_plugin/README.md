# `genius-foresight` — plug-in nativo do Hermes Agent

Expõe o kernel do [GeniusAI Foresight](../README.md) como ferramentas do
[Hermes Agent](https://hermes-agent.nousresearch.com/): simulação prospectiva
multiagente com Teoria dos Jogos, evidência *point-in-time* e replay
determinístico — preservando o gate científico.

É o item 1 do roadmap da
[análise de plug-ins do Hermes](../../docs/ANALISE-PLUGINS-HERMES.md) (§3.1).

## Instalação

### Opção A — via pip (recomendada)

O plug-in é distribuído junto do pacote e declarado como *entry point*, então
não há nada para copiar:

```bash
pip install ./geniusai-foresight     # ou: pip install geniusai-foresight
hermes plugins enable genius-foresight
hermes plugins list                  # confirme que aparece como habilitado
```

### Opção B — diretório em `~/.hermes/plugins/`

```bash
cp -r geniusai-foresight/hermes_plugin ~/.hermes/plugins/genius-foresight
pip install ./geniusai-foresight     # o kernel continua sendo dependência
hermes plugins doctor ~/.hermes/plugins/genius-foresight
hermes plugins enable genius-foresight
```

> Sem o kernel instalado o plug-in **carrega assim mesmo** — a primeira chamada
> devolve `{"status": "error", ...}` explicando como instalar, em vez de
> derrubar o boot do agente.

## Ferramentas

Todas no toolset `foresight`.

| Ferramenta | Custo | O que faz |
|---|---|---|
| `foresight_validate` | barato | Valida contratos e o gate de entrada **sem** simular; devolve o hash do snapshot de evidências |
| `foresight_profile` | barato | Lista as células adaptativas: coordenador e especialistas por ator |
| `foresight_run` | caro | Executa as 8 etapas e escreve `result.json`, `report.md` e `report.html` |
| `foresight_demo` | caro | Roda o cenário demonstrativo embutido (5 atores, 600 runs) |
| `foresight_game` | barato | Equilíbrios de um jogo canônico 2×2 (Nash puro/misto, QRE, Pareto, dominância) |
| `foresight_replay` | caro | Reconstrói uma run e compara hashes com um `result.json` anterior |

Os estudos entram por `study` (JSON inline, vindo do modelo) **ou**
`study_path` (arquivo em disco) — nunca os dois. O estudo inline é gravado num
arquivo temporário de propósito: assim ele passa pelas mesmas guardas do
kernel (arquivo regular, ≤ 5 MiB, constantes JSON não-finitas rejeitadas,
≤ 10 000 registros de evidência) em vez de contorná-las.

## O gate científico continua valendo

`foresight_run` e `foresight_demo` só publicam quando o red team devolve
`go_research_only`. Quando reprova, nada é escrito em disco e a resposta é:

```json
{
  "status": "blocked_by_gate",
  "study": "...",
  "gate": {"status": "no_go", "reason": "scientific_quality_gate_failed", "research_only": true},
  "hint": "nenhum relatório foi escrito: o red team reprovou a execução…"
}
```

O bloqueio é **estruturado** — o agente distingue "estudo malformado"
(`status: "error"`) de "a ciência disse não" (`status: "blocked_by_gate"`) sem
precisar interpretar mensagem de erro.

## Skill acompanhante

O plug-in registra a skill **`foresight-cycle`**
([`skills/foresight-cycle/SKILL.md`](skills/foresight-cycle/SKILL.md)): o
procedimento das oito etapas, o que perguntar ao usuário antes de começar, os
dois gates humanos (`frame-study` e `publish-brief`) e as regras que não se
negociam — não publicar com gate reprovado, não apresentar as probabilidades
como calibradas empiricamente, repassar os `warnings`, anexar o rodapé
canônico.

## Contrato dos handlers

Duas regras, ambas cobertas por teste em
[`../tests/test_hermes_plugin.py`](../tests/test_hermes_plugin.py):

1. **Sempre devolvem string JSON**, inclusive no erro — nenhum handler
   propaga exceção para o loop do agente.
2. **Sempre aceitam `**kwargs`**, para o Hermes acrescentar parâmetros sem
   quebrar o plug-in.

Nenhum hook de ciclo de vida é registrado (`provides_hooks: []`): as
ferramentas bastam, e assim o plug-in não depende de nenhum hook cuja
invocação precise ser confirmada versão a versão do Hermes.

## Testes

```bash
cd geniusai-foresight
python -m unittest tests.test_hermes_plugin -v
```

Cobrem registro (nomes batendo com o `plugin.yaml`, enum de fixtures batendo
com o kernel), o contrato dos handlers sob entradas hostis, equivalência entre
estudo inline e em disco, limpeza dos arquivos temporários, paridade do
payload com a CLI do kernel, replay determinístico e o bloqueio pelo gate.
