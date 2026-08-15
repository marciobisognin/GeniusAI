---
name: foresight-cycle
description: >-
  Conduzir um estudo prospectivo auditável de ponta a ponta com o kernel do
  GeniusAI Foresight — enquadrar o problema, montar o snapshot de evidências
  com data de corte, simular cenários com Teoria dos Jogos e publicar o
  relatório apenas quando o red team autorizar. Use quando o pedido envolver
  prever, simular ou avaliar consequências de decisões entre atores
  (países, instituições, mercados) sob incerteza.
license: MIT
---

# Ciclo de prospecção do GeniusAI Foresight

## Quando usar

Use este procedimento quando o pedido for do tipo *"o que acontece se…"*
envolvendo **múltiplos atores que reagem uns aos outros** — tarifas entre
países, disputa de mercado entre concorrentes, resposta institucional a uma
mudança regulatória. Não use para previsão de série temporal de uma variável
isolada: o valor aqui está na interação estratégica, não na extrapolação.

## O que você precisa do usuário antes de começar

Quatro coisas, e nenhuma delas pode ser inventada:

| Informação | Por que é obrigatória |
|---|---|
| **Problema** | Define o contrato de previsão e a variável primária |
| **Atores** | Cada um vira uma célula adaptativa com coordenador e especialistas |
| **Horizonte** | Quantos passos simular, e em qual unidade |
| **Data de corte** | Evidência posterior ao corte é descartada — é o que impede *look-ahead bias* |

Se qualquer uma faltar, **pergunte**. Um estudo com atores inventados produz
números com a mesma aparência de rigor e nenhum valor.

## O ciclo, em oito etapas

O kernel executa as oito como um DAG; nenhuma pula seu gate.

```
frame-study  →  build-evidence-snapshot  →  profile-actors  →  select-game-form
     ↓                                                              ↓
  [gate humano]                                            build-causal-model
                                                                    ↓
                          publish-brief  ←  calibrate-and-red-team  ←  run-scenarios
                               ↓
                         [gate humano]
```

Duas etapas têm **gate humano**: `frame-study` (o enquadramento precisa ser
aceito antes de simular) e `publish-brief` (o relatório precisa ser aceito
antes de circular). As outras seis são automáticas.

## Procedimento

1. **Enquadre.** Colete problema, atores, horizonte e data de corte. Monte o
   JSON do estudo (`brief`, `actors`, `evidence`). Confirme o enquadramento
   com o usuário — este é o primeiro gate humano.
2. **Valide antes de gastar.** Chame `foresight_validate`. Ele confere os
   contratos e devolve o hash do snapshot de evidências sem rodar a
   simulação. Erros de contrato aparecem aqui, de graça.
3. **Mostre quem vai raciocinar.** `foresight_profile` lista, por ator, o
   coordenador e os especialistas por domínio. Útil para o usuário conferir se
   os atores foram entendidos como ele pretendia.
4. **Execute.** `foresight_run` com um `output_dir`. Produz `result.json`,
   `report.md` e `report.html`.
5. **Leia o gate antes de relatar qualquer número.** Se a resposta vier com
   `status: "blocked_by_gate"`, **nenhum relatório foi escrito** e nenhum
   resultado deve ser apresentado — diga ao usuário que o red team reprovou e
   por quê. Só `completed_research_only` autoriza seguir.
6. **Audite quando fizer diferença.** `foresight_replay` reconstrói a run e
   compara hashes com um `result.json` anterior: `match` prova que o relatório
   continua reproduzível.

Para uma interação estratégica isolada, sem estudo completo, use
`foresight_game` com um dos jogos canônicos (`prisoners-dilemma`,
`stag-hunt`, `chicken`, `matching-pennies`).

Sem estudo pronto e querendo demonstrar a ferramenta: `foresight_demo`.

## Regras que não se negociam

- **Nunca publique com o gate reprovado.** O `status` do gate é a autorização,
  não uma sugestão.
- **Nunca apresente as probabilidades como calibradas empiricamente.** Elas são
  *model-implied*, acompanhadas de erro de Monte Carlo (MCSE). O próprio kernel
  devolve isso em `warnings` — repasse os avisos ao usuário, não os filtre.
- **Nunca trate o resultado como recomendação financeira ou política.** É
  material de pesquisa condicional.
- **Não peça nem registre cadeia de raciocínio privada** dos agentes: guarde
  saídas estruturadas e justificativas curtas.
- **Anexe sempre o rodapé canônico** ao relatar resultados:

  > Licença: MIT. Criado por Marcio Bisognin. Instagram: @marciobisognin.

## Como ler o resultado

| Campo | O que significa |
|---|---|
| `gate.status` | `go_research_only` autoriza publicar; qualquer outro bloqueia |
| `model_signature_sha256` | Assinatura do modelo — muda se o método mudar |
| `outputs` | Caminhos de `result.json`, `report.md` e `report.html` |
| `warnings` | Limites do resultado — repassar ao usuário, sempre |
| `runs` | Quantas execuções de Monte Carlo sustentam as probabilidades |
