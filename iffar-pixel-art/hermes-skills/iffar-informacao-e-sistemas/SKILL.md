---
name: iffar-informacao-e-sistemas
description: Documentar requisitos e evidências de informação e sistemas no Instituto Federal Farroupilha, com base na Portaria Eletrônica nº 876/2026-GRE. Use quando a demanda envolver uma unidade que exerça esta competência.
license: MIT
---

# Documentar requisitos e evidências de informação e sistemas

Competência operacional exercida por **19 unidades** do IFFar
(19 posições normativas), derivada da
**Portaria Eletrônica nº 876/2026-GRE** de 2026-07-03.

## Quando usar

Quando a demanda institucional cair sobre uma das unidades abaixo e exigir
esta competência. Se a unidade responsável **não** estiver nesta lista, esta
skill não se aplica — procure a competência certa em vez de forçar esta.

| Código | Unidade |
|---|---|
| `1.1.4.8` | SECRETARIA DE COMUNICAÇÃO |
| `1.1.10` | COMITÊ DE TECNOLOGIA DA INFORMAÇÃO |
| `1.1.10.1` | COMITÊ GESTOR DE SEGURANÇA DA INFORMAÇÃO |
| `1.1.12` | SERVIÇO DE INFORMAÇÃO AO CIDADÃO |
| `1.1.14.4` | DIRETORIA DE TECNOLOGIA DA INFORMAÇÃO |
| `1.1.14.4.1` | COORDENAÇÃO DE SISTEMAS DE INFORMAÇÃO |
| `1.2.3.2` | COORDENAÇÃO DE TECNOLOGIA DA INFORMAÇÃO |
| `1.3.3.2` | COORDENAÇÃO DE TECNOLOGIA DA INFORMAÇÃO |
| `1.4.3.2` | COORDENAÇÃO DE TECNOLOGIA DA INFORMAÇÃO |
| `1.5.3.2` | COORDENAÇÃO DE TECNOLOGIA DA INFORMAÇÃO |
| `1.6.3.2` | COORDENAÇÃO DE TECNOLOGIA DA INFORMAÇÃO |
| `1.7.3.2` | COORDENAÇÃO DE TECNOLOGIA DA INFORMAÇÃO |

…e mais 7 unidades com a mesma competência.

## Base normativa

- **Art. 1** — Atribuições de todas as unidades organizacionais do IFFar
- **Art. 2** — Atribuições do Conselho Superior - Consup:
- **Art. 3** — Atribuições da Auditoria Interna
- **Art. 4** — Atribuições do Colégio de Dirigentes - Codir
- **Art. 5** — Atribuições da Comissão de Ética - CE
- **Art. 9** — Atribuições da Comissão Própria de Avaliação - CPA
- **Art. 10** — Atribuições da Comitê de Tecnologia da Informação - CTI
- **Art. 11** — Atribuições da Ouvidoria

Fundamento declarado nos manifestos: *Termos da Uorg/cargo: COORDENAÇÃO DE TECNOLOGIA DA INFORMAÇÃO*; *Termos da Uorg/cargo: COMITÊ DE TECNOLOGIA DA INFORMAÇÃO*; *Termos da Uorg/cargo: COMITÊ GESTOR DE SEGURANÇA DA INFORMAÇÃO*; *Termos da Uorg/cargo: SERVIÇO DE INFORMAÇÃO AO CIDADÃO*; *Termos da Uorg/cargo: DIRETORIA DE TECNOLOGIA DA INFORMAÇÃO*; *Termos da Uorg/cargo: COORDENAÇÃO DE SISTEMAS DE INFORMAÇÃO*; *Termos da Uorg/cargo: SECRETARIA DE COMUNICAÇÃO*.

## Como executar

O trabalho roda pelo runbook do agente da unidade:

```bash
node scripts/execute-agent-runbook.mjs \
  --agent <agentId> --event-file <eventFile> --brief <briefFile>
```

Cada execução produz um evento observado e um registro de handoff. Os tipos de
evento aceitos são `agent.work_completed`, `agent.handoff_observed` e
`agent.runbook_completed` — e **só** quando houve trabalho real: planejar ou
declarar intenção não gera evento.

## Limites (não negociáveis)

- Não representa pessoa física nem ocupante de cargo.
- Não produz ato administrativo, publicação ou comunicação externa sem aprovação humana.
- Competências operacionais são derivadas para orquestração e não substituem atribuições legais específicas.

Ver a skill **`iffar-execucao-institucional`** para o contrato de entrega —
checkpoint humano e verificação de artefatos — que vale para toda execução.
