---
name: iffar-revisao-normativa
description: Conferir a aderência à fonte normativa disponível no Instituto Federal Farroupilha, com base na Portaria Eletrônica nº 876/2026-GRE. Use quando a demanda envolver uma unidade que exerça esta competência.
license: MIT
---

# Conferir a aderência à fonte normativa disponível

Competência operacional exercida por **435 unidades** do IFFar
(453 posições normativas), derivada da
**Portaria Eletrônica nº 876/2026-GRE** de 2026-07-03.

## Quando usar

Quando a demanda institucional cair sobre uma das unidades abaixo e exigir
esta competência. Se a unidade responsável **não** estiver nesta lista, esta
skill não se aplica — procure a competência certa em vez de forçar esta.

| Código | Unidade |
|---|---|
| `1.1.1` | CONSELHO SUPERIOR |
| `1.1.2` | AUDITORIA INTERNA |
| `1.1.3` | COLÉGIO DE DIRIGENTES |
| `1.1.4` | GABINETE DO(A) REITOR(A) |
| `1.1.4.1` | DIRETORIA DO CAMPUS CAÇAPAVA DO SUL |
| `1.1.4.2` | ASSESSORIA |
| `1.1.4.3` | CHEFIA DO GABINETE DO(A) REITOR(A) |
| `1.1.4.4` | DIRETORIA DE GOVERNANÇA, RISCOS E CONTROLES |
| `1.1.4.5` | ASSESSORIA |
| `1.1.4.6` | ASSESSORIA |
| `1.1.4.7` | ASSESSORIA |
| `1.1.4.8` | SECRETARIA DE COMUNICAÇÃO |

…e mais 423 unidades com a mesma competência.

## Base normativa

- **Art. 1** — Atribuições de todas as unidades organizacionais do IFFar
- **Art. 2** — Atribuições do Conselho Superior - Consup:
- **Art. 3** — Atribuições da Auditoria Interna
- **Art. 4** — Atribuições do Colégio de Dirigentes - Codir
- **Art. 5** — Atribuições da Comissão de Ética - CE
- **Art. 6** — Atribuições da Comissão Interna de Supervisão do Plano de Carreira dos Servidores Técnico-
- **Art. 7** — Atribuições da Comissão Permanente de Pessoal Docente - CPPD
- **Art. 8** — Atribuições da Unidade Correcional Instituída - UCI
- **Art. 9** — Atribuições da Comissão Própria de Avaliação - CPA
- **Art. 10** — Atribuições da Comitê de Tecnologia da Informação - CTI
- **Art. 11** — Atribuições da Ouvidoria
- **Art. 12** — Atribuições da Procuradoria Federal
- **Art. 13** — Atribuições do Serviço de Informação ao Cidadão
- **Art. 14** — Atribuições do Gabinete do(a) Reitor(a) e Uorgs vinculadas
- **Art. 15** — Atribuições da Chefia de Gabinete do(a) Reitor(a):
- **Art. 16** — Atribuições da Secretaria de Comunicação - Secom
- **Art. 17** — Atribuições da Secretaria Executiva - SEE
- **Art. 18** — Atribuições da Diretoria de Governança, Riscos e Controles - DGRC
- **Art. 19** — Atribuições da Coordenação de Governança e Gestão da Integridade - CGGI
- **Art. 20** — Atribuições da Coordenação de Centro de Referência
- **Art. 22** — Atribuições da Diretoria de Gestão de Pessoas - DGP
- **Art. 25** — Atribuições da Coordenação de Gestão de Pessoas - CGP (Reitoria)
- **Art. 26** — Atribuições do Núcleo de Aposentadoria e Pensões - NAP
- **Art. 28** — Atribuições da Diretoria de Planejamento e Desenvolvimento Institucional - DPDI(Reitoria)
- **Art. 32** — Atribuições da Pesquisa Institucional - PI
- **Art. 33** — Atribuições da Diretoria de Tecnologia da Informação - DTI
- **Art. 36** — Atribuições do Comitê Gestor de Tecnologia da Informação - CGTI
- **Art. 37** — Atribuições do Núcleo de Educação e Gestão Ambiental Institucional - Nugea
- **Art. 51** — Atribuições da Diretoria de Administração, Orçamento e Finanças - DAOF
- **Art. 61** — Atribuições da Pró-Reitoria de Ensino - Proen e Uorgs vinculadas
- **Art. 62** — Atribuições da Diretoria de Assistência Estudantil - DAE
- **Art. 65** — Atribuições da Coordenação de Apoio a Pessoas com Necessidades Educacionais Específicas
- **Art. 66** — Atribuições da Coordenação de Ações Afirmativas (Reitoria)
- **Art. 67** — Atribuições da Coordenação de Assessoria Pedagógica
- **Art. 68** — Atribuições da Coordenação de Programas Educacionais
- **Art. 82** — Atribuições do Gabinete do(a) Diretor(a) Geral
- **Art. 96** — Atribuições da Diretoria de Ensino (campus)
- **Art. 97** — Atribuições da biblioteca
- **Art. 98** — Atribuições da Coordenação de Ações Afirmativas (campus)
- **Art. 103** — Atribuições da Coordenação de Curso
- **Art. 108** — Atribuições da Coordenação de Extensão

Fundamento declarado nos manifestos: *Portaria nº 876/2026-GRE*.

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
