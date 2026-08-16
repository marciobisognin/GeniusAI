---
name: iffar-pesquisa-e-inovacao
description: Organizar evidências de pesquisa, inovação e pós-graduação no Instituto Federal Farroupilha, com base na Portaria Eletrônica nº 876/2026-GRE. Use quando a demanda envolver uma unidade que exerça esta competência.
license: MIT
---

# Organizar evidências de pesquisa, inovação e pós-graduação

Competência operacional exercida por **32 unidades** do IFFar
(32 posições normativas), derivada da
**Portaria Eletrônica nº 876/2026-GRE** de 2026-07-03.

## Quando usar

Quando a demanda institucional cair sobre uma das unidades abaixo e exigir
esta competência. Se a unidade responsável **não** estiver nesta lista, esta
skill não se aplica — procure a competência certa em vez de forçar esta.

| Código | Unidade |
|---|---|
| `1.1.14.3.3` | PESQUISA INSTITUCIONAL |
| `1.1.17` | PRÓ-REITORIA DE PESQUISA, PÓS- GRADUAÇÃO E INOVAÇÃO |
| `1.1.17.1` | DIRETORIA DE PESQUISA, PÓS- GRADUAÇÃO E INOVAÇÃO |
| `1.1.17.1.1` | COORDENAÇÃO DE INOVAÇÃO TECNOLÓGICA |
| `1.1.17.1.2` | COORDENAÇÃO DE PESQUISA |
| `1.2.6` | DIRETORIA DE PESQUISA, EXTENSÃO E PRODUÇÃO |
| `1.2.6.2` | COORDENAÇÃO DE PESQUISA, PÓS-GRADUAÇÃO E INOVAÇÃO |
| `1.3.6` | DIRETORIA DE PESQUISA, EXTENSÃO E PRODUÇÃO |
| `1.3.6.2` | COORDENAÇÃO DE PESQUISA, PÓS-GRADUAÇÃO E INOVAÇÃO |
| `1.4.6` | DIRETORIA DE PESQUISA, EXTENSÃO E PRODUÇÃO |
| `1.4.6.2` | COORDENAÇÃO DE PESQUISA, PÓS-GRADUAÇÃO E INOVAÇÃO |
| `1.5.6` | DIRETORIA DE PESQUISA, EXTENSÃO E PRODUÇÃO |

…e mais 20 unidades com a mesma competência.

## Base normativa

- **Art. 1** — Atribuições de todas as unidades organizacionais do IFFar
- **Art. 2** — Atribuições do Conselho Superior - Consup:
- **Art. 5** — Atribuições da Comissão de Ética - CE
- **Art. 9** — Atribuições da Comissão Própria de Avaliação - CPA
- **Art. 10** — Atribuições da Comitê de Tecnologia da Informação - CTI
- **Art. 14** — Atribuições do Gabinete do(a) Reitor(a) e Uorgs vinculadas
- **Art. 16** — Atribuições da Secretaria de Comunicação - Secom
- **Art. 18** — Atribuições da Diretoria de Governança, Riscos e Controles - DGRC
- **Art. 19** — Atribuições da Coordenação de Governança e Gestão da Integridade - CGGI
- **Art. 20** — Atribuições da Coordenação de Centro de Referência
- **Art. 33** — Atribuições da Diretoria de Tecnologia da Informação - DTI
- **Art. 67** — Atribuições da Coordenação de Assessoria Pedagógica
- **Art. 68** — Atribuições da Coordenação de Programas Educacionais

Fundamento declarado nos manifestos: *Termos da Uorg/cargo: DIRETORIA DE PESQUISA, EXTENSÃO E PRODUÇÃO*; *Termos da Uorg/cargo: COORDENAÇÃO DE PESQUISA, PÓS-GRADUAÇÃO E INOVAÇÃO*; *Termos da Uorg/cargo: DIRETORIA DE ENSINO, PESQUISA, EXTENSÃO E PRODUÇÃO*; *Termos da Uorg/cargo: COORDENAÇÃO DE PESQUISA, EXTENSÃO E PRODUÇÃO*; *Termos da Uorg/cargo: SETOR DE INOVAÇÃO*; *Termos da Uorg/cargo: DIRETORIA DE ENSINO, PESQUISA E EXTENSÃO*; *Termos da Uorg/cargo: PESQUISA INSTITUCIONAL*; *Termos da Uorg/cargo: PRÓ-REITORIA DE PESQUISA, PÓS- GRADUAÇÃO E INOVAÇÃO*; *Termos da Uorg/cargo: DIRETORIA DE PESQUISA, PÓS- GRADUAÇÃO E INOVAÇÃO*; *Termos da Uorg/cargo: COORDENAÇÃO DE INOVAÇÃO TECNOLÓGICA*; *Termos da Uorg/cargo: COORDENAÇÃO DE PESQUISA*.

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
