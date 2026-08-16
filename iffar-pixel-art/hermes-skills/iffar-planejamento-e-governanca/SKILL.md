---
name: iffar-planejamento-e-governanca
description: Organizar evidências de planejamento, avaliação e governança no Instituto Federal Farroupilha, com base na Portaria Eletrônica nº 876/2026-GRE. Use quando a demanda envolver uma unidade que exerça esta competência.
license: MIT
---

# Organizar evidências de planejamento, avaliação e governança

Competência operacional exercida por **35 unidades** do IFFar
(36 posições normativas), derivada da
**Portaria Eletrônica nº 876/2026-GRE** de 2026-07-03.

## Quando usar

Quando a demanda institucional cair sobre uma das unidades abaixo e exigir
esta competência. Se a unidade responsável **não** estiver nesta lista, esta
skill não se aplica — procure a competência certa em vez de forçar esta.

| Código | Unidade |
|---|---|
| `1.1.9` | COMISSÃO PRÓPRIA DE AVALIAÇÃO |
| `1.1.14.2` | DIRETORIA DE GESTÃO DE PESSOAS |
| `1.1.14.2.3` | COORDENAÇÃO DE GESTÃO DE PESSOAS |
| `1.1.14.3` | DIRETORIA DE PLANEJAMENTO E DESENVOLVIMENTO INSTITUCIONAL |
| `1.1.14.3.1` | COORDENAÇÃO DE AVALIAÇÃO INSTITUCIONAL |
| `1.1.14.3.2` | COORDENAÇÃO DE GESTÃO DOCUMENTAL |
| `1.2.3` | DIRETORIA DE PLANEJAMENTO E DESENVOLVIMENTO INSTITUCIONAL |
| `1.2.3.1` | COORDENAÇÃO DE GESTÃO DE PESSOAS |
| `1.3.3` | DIRETORIA DE PLANEJAMENTO E DESENVOLVIMENTO INSTITUCIONAL |
| `1.3.3.1` | COORDENAÇÃO DE GESTÃO DE PESSOAS |
| `1.4.3` | DIRETORIA DE PLANEJAMENTO E DESENVOLVIMENTO INSTITUCIONAL |
| `1.4.3.1` | COORDENAÇÃO DE GESTÃO DE PESSOAS |

…e mais 23 unidades com a mesma competência.

## Base normativa

- **Art. 1** — Atribuições de todas as unidades organizacionais do IFFar
- **Art. 2** — Atribuições do Conselho Superior - Consup:
- **Art. 3** — Atribuições da Auditoria Interna
- **Art. 4** — Atribuições do Colégio de Dirigentes - Codir
- **Art. 5** — Atribuições da Comissão de Ética - CE
- **Art. 6** — Atribuições da Comissão Interna de Supervisão do Plano de Carreira dos Servidores Técnico-
- **Art. 8** — Atribuições da Unidade Correcional Instituída - UCI
- **Art. 10** — Atribuições da Comitê de Tecnologia da Informação - CTI
- **Art. 17** — Atribuições da Secretaria Executiva - SEE
- **Art. 18** — Atribuições da Diretoria de Governança, Riscos e Controles - DGRC
- **Art. 19** — Atribuições da Coordenação de Governança e Gestão da Integridade - CGGI
- **Art. 20** — Atribuições da Coordenação de Centro de Referência

Fundamento declarado nos manifestos: *Termos da Uorg/cargo: DIRETORIA DE PLANEJAMENTO E DESENVOLVIMENTO INSTITUCIONAL*; *Termos da Uorg/cargo: COORDENAÇÃO DE GESTÃO DE PESSOAS*; *Termos da Uorg/cargo: DIRETORIA DE ADMINISTRAÇÃO, PLANEJAMENTO E DESENVOLVIMENTO*; *Termos da Uorg/cargo: COORDENAÇÃO DE PLANEJAMENTO E DESENVOLVIMENTO INSTITUCIONAL*; *Termos da Uorg/cargo: UNIDADE DE GESTÃO DOCUMENTAL*; *Termos da Uorg/cargo: DIRETORIA DE ADMINISTRAÇÃO, PLANEJAMENTO E DESENVOLVIMENTO INSTITUCIONAL*; *Termos da Uorg/cargo: DIRETORIA DE GESTÃO DE PESSOAS*; *Termos da Uorg/cargo: COORDENAÇÃO DE AVALIAÇÃO INSTITUCIONAL*; *Termos da Uorg/cargo: COORDENAÇÃO DE GESTÃO DOCUMENTAL*; *Termos da Uorg/cargo: COMISSÃO PRÓPRIA DE AVALIAÇÃO*.

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
