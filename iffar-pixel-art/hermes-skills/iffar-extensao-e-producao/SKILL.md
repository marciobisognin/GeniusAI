---
name: iffar-extensao-e-producao
description: Organizar evidências de extensão, estágio e produção no Instituto Federal Farroupilha, com base na Portaria Eletrônica nº 876/2026-GRE. Use quando a demanda envolver uma unidade que exerça esta competência.
license: MIT
---

# Organizar evidências de extensão, estágio e produção

Competência operacional exercida por **40 unidades** do IFFar
(40 posições normativas), derivada da
**Portaria Eletrônica nº 876/2026-GRE** de 2026-07-03.

## Quando usar

Quando a demanda institucional cair sobre uma das unidades abaixo e exigir
esta competência. Se a unidade responsável **não** estiver nesta lista, esta
skill não se aplica — procure a competência certa em vez de forçar esta.

| Código | Unidade |
|---|---|
| `1.1.18` | PRÓ-REITORIA DE EXTENSÃO |
| `1.1.18.1` | DIRETORIA DE EXTENSÃO |
| `1.1.18.1.1` | COORDENAÇÃO DE EXTENSÃO TECNOLÓGICA |
| `1.2.6` | DIRETORIA DE PESQUISA, EXTENSÃO E PRODUÇÃO |
| `1.2.6.1` | COORDENAÇÃO DE EXTENSÃO |
| `1.2.6.1.1` | SETOR DE ESTÁGIOS |
| `1.2.6.3` | COORDENAÇÃO DE PRODUÇÃO |
| `1.2.6.3.1` | SETOR DE PRODUÇÃO |
| `1.3.6` | DIRETORIA DE PESQUISA, EXTENSÃO E PRODUÇÃO |
| `1.3.6.1` | COORDENAÇÃO DE EXTENSÃO |
| `1.3.6.1.1` | SETOR DE ESTÁGIOS |
| `1.3.6.3` | COORDENAÇÃO DE PRODUÇÃO |

…e mais 28 unidades com a mesma competência.

## Base normativa

- **Art. 5** — Atribuições da Comissão de Ética - CE
- **Art. 9** — Atribuições da Comissão Própria de Avaliação - CPA
- **Art. 10** — Atribuições da Comitê de Tecnologia da Informação - CTI
- **Art. 14** — Atribuições do Gabinete do(a) Reitor(a) e Uorgs vinculadas
- **Art. 15** — Atribuições da Chefia de Gabinete do(a) Reitor(a):
- **Art. 16** — Atribuições da Secretaria de Comunicação - Secom
- **Art. 18** — Atribuições da Diretoria de Governança, Riscos e Controles - DGRC
- **Art. 19** — Atribuições da Coordenação de Governança e Gestão da Integridade - CGGI
- **Art. 22** — Atribuições da Diretoria de Gestão de Pessoas - DGP
- **Art. 37** — Atribuições do Núcleo de Educação e Gestão Ambiental Institucional - Nugea
- **Art. 103** — Atribuições da Coordenação de Curso
- **Art. 108** — Atribuições da Coordenação de Extensão

Fundamento declarado nos manifestos: *Termos da Uorg/cargo: DIRETORIA DE PESQUISA, EXTENSÃO E PRODUÇÃO*; *Termos da Uorg/cargo: COORDENAÇÃO DE EXTENSÃO*; *Termos da Uorg/cargo: COORDENAÇÃO DE PRODUÇÃO*; *Termos da Uorg/cargo: DIRETORIA DE ENSINO, PESQUISA, EXTENSÃO E PRODUÇÃO*; *Termos da Uorg/cargo: COORDENAÇÃO DE PESQUISA, EXTENSÃO E PRODUÇÃO*; *Termos da Uorg/cargo: DIRETORIA DE ENSINO, PESQUISA E EXTENSÃO*; *Termos da Uorg/cargo: PRÓ-REITORIA DE EXTENSÃO*; *Termos da Uorg/cargo: DIRETORIA DE EXTENSÃO*; *Termos da Uorg/cargo: COORDENAÇÃO DE EXTENSÃO TECNOLÓGICA*; *Termos da Uorg/cargo: SETOR DE ESTÁGIOS*; *Termos da Uorg/cargo: SETOR DE PRODUÇÃO*; *Termos da Uorg/cargo: COORDENAÇÃO DE EXTENSÃO E PRODUÇÃO*.

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
