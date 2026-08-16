---
name: iffar-ensino-e-ppc
description: Preparar insumos acadêmicos e de PPC no Instituto Federal Farroupilha, com base na Portaria Eletrônica nº 876/2026-GRE. Use quando a demanda envolver uma unidade que exerça esta competência.
license: MIT
---

# Preparar insumos acadêmicos e de PPC

Competência operacional exercida por **57 unidades** do IFFar
(58 posições normativas), derivada da
**Portaria Eletrônica nº 876/2026-GRE** de 2026-07-03.

## Quando usar

Quando a demanda institucional cair sobre uma das unidades abaixo e exigir
esta competência. Se a unidade responsável **não** estiver nesta lista, esta
skill não se aplica — procure a competência certa em vez de forçar esta.

| Código | Unidade |
|---|---|
| `1.1.16` | PRÓ-REITORIA DE ENSINO |
| `1.1.16.2.1` | COORDENAÇÃO DE CURSOS |
| `1.1.16.3` | DIRETORIA DE ENSINO |
| `1.1.16.3.2` | COORDENAÇÃO DE ASSESSORIA PEDAGÓGICA |
| `1.1.17.1.3.1` | COORDENAÇÃO DE CURSOS |
| `1.2.5` | DIRETORIA DE ENSINO |
| `1.2.5.5` | COORDENAÇÃO GERAL DE ENSINO |
| `1.2.5.5.1` | COORDENAÇÕES DE CURSO |
| `1.2.5.5.2` | SETOR DE ASSESSORIA PEDAGÓGICA |
| `1.3.5` | DIRETORIA DE ENSINO |
| `1.3.5.5` | COORDENAÇÃO GERAL DE ENSINO |
| `1.3.5.5.1` | COORDENAÇÕES DE CURSO |

…e mais 45 unidades com a mesma competência.

## Base normativa

- **Art. 1** — Atribuições de todas as unidades organizacionais do IFFar
- **Art. 2** — Atribuições do Conselho Superior - Consup:
- **Art. 5** — Atribuições da Comissão de Ética - CE
- **Art. 9** — Atribuições da Comissão Própria de Avaliação - CPA
- **Art. 10** — Atribuições da Comitê de Tecnologia da Informação - CTI
- **Art. 11** — Atribuições da Ouvidoria
- **Art. 12** — Atribuições da Procuradoria Federal
- **Art. 14** — Atribuições do Gabinete do(a) Reitor(a) e Uorgs vinculadas
- **Art. 15** — Atribuições da Chefia de Gabinete do(a) Reitor(a):
- **Art. 16** — Atribuições da Secretaria de Comunicação - Secom
- **Art. 17** — Atribuições da Secretaria Executiva - SEE
- **Art. 18** — Atribuições da Diretoria de Governança, Riscos e Controles - DGRC
- **Art. 19** — Atribuições da Coordenação de Governança e Gestão da Integridade - CGGI
- **Art. 20** — Atribuições da Coordenação de Centro de Referência
- **Art. 22** — Atribuições da Diretoria de Gestão de Pessoas - DGP
- **Art. 28** — Atribuições da Diretoria de Planejamento e Desenvolvimento Institucional - DPDI(Reitoria)
- **Art. 32** — Atribuições da Pesquisa Institucional - PI
- **Art. 33** — Atribuições da Diretoria de Tecnologia da Informação - DTI

Fundamento declarado nos manifestos: *Termos da Uorg/cargo: DIRETORIA DE ENSINO*; *Termos da Uorg/cargo: COORDENAÇÃO GERAL DE ENSINO*; *Termos da Uorg/cargo: COORDENAÇÕES DE CURSO*; *Termos da Uorg/cargo: SETOR DE ASSESSORIA PEDAGÓGICA*; *Termos da Uorg/cargo: DIRETORIA DE ENSINO, PESQUISA, EXTENSÃO E PRODUÇÃO*; *Termos da Uorg/cargo: SETOR DE APOIO PEDAGÓGICO*; *Termos da Uorg/cargo: DIRETORIA DE ENSINO, PESQUISA E EXTENSÃO*; *Termos da Uorg/cargo: PRÓ-REITORIA DE ENSINO*; *Termos da Uorg/cargo: COORDENAÇÃO DE CURSOS*; *Termos da Uorg/cargo: COORDENAÇÃO DE ASSESSORIA PEDAGÓGICA*.

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
