# Sala de Ensaio — servidor MCP

A **Lei 2** do Allspark ("nenhuma missão sem ensaio") apoiada no motor
determinístico deste projeto. Item 7 do roadmap da
[análise de plug-ins do Hermes](../../../../docs/ANALISE-PLUGINS-HERMES.md) (§3.7).

## O que entrega

O que este motor tem e nada mais no repositório tem: dado um `seed` e um
conjunto de decisões, **o mundo seguinte é sempre o mesmo** (`createWorld`
determinístico, `tick` puro, PRNG com estado serializável). Um agente pode
descobrir a consequência de um plano *antes* de executá-lo.

| Ferramenta | O que faz |
|---|---|
| `rehearse_plan` | Roda N ticks a partir de uma semente e devolve consequências + assinatura |
| `verify_rehearsal` | Repete o ensaio e confirma que a assinatura bate |

## Rodar

```bash
npm run mcp:ensaio --workspace apps/backend
```

## O limite, dito na cara

O domínio simulado é o **de civilizações** (cidades, exércitos, tecnologia,
diplomacia) — não decisões institucionais genéricas. Generalizar o motor para
ensaiar qualquer decisão é **redesenho de produto, não porte**, e continua em
aberto. Por isso o aviso viaja dentro de cada resposta:

> Ensaio determinístico no domínio de civilizações do GeniusAI Civilizations.
> As consequências valem para este modelo, não são previsão sobre o mundo real.

## O ensaio também ensina o que não dá

- `invalidas` — ações malformadas, que nem chegaram ao motor (ex.: `research`
  com `tech` em vez de `technology`). Sem isso, um plano errado passaria
  silenciosamente sem fazer nada.
- `recusadas` — ações bem formadas que o motor rejeitou (ex.: construir fora
  do mapa), com o evento `action_rejected` correspondente.

## Assinatura

`signature` cobre também o que está **em andamento** (`researching`, propostas
pendentes), não só o que concluiu: uma assinatura que não distingue um mundo
pesquisando de um mundo parado não serviria para provar reprodutibilidade.

## Testes

```bash
node --import tsx --test src/mcp/rehearsal.test.ts
```

13 testes, já incluídos no `npm test` do backend (191 no total).
