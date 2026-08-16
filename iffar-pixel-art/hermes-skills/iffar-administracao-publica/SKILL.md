---
name: iffar-administracao-publica
description: Organizar instrução administrativa e controles de processo no Instituto Federal Farroupilha, com base na Portaria Eletrônica nº 876/2026-GRE. Use quando a demanda envolver uma unidade que exerça esta competência.
license: MIT
---

# Organizar instrução administrativa e controles de processo

Competência operacional exercida por **65 unidades** do IFFar
(65 posições normativas), derivada da
**Portaria Eletrônica nº 876/2026-GRE** de 2026-07-03.

## Quando usar

Quando a demanda institucional cair sobre uma das unidades abaixo e exigir
esta competência. Se a unidade responsável **não** estiver nesta lista, esta
skill não se aplica — procure a competência certa em vez de forçar esta.

| Código | Unidade |
|---|---|
| `1.1.7` | COMISSÃO INTERNA DE SUPERVISÃO DO PLANO DE CARREIRA DOS SERVIDORES TÉCNICO-ADMINISTRATIVOS EM EDUCAÇÃO |
| `1.1.14.2.1` | COORDENAÇÃO DE ADMINISTRAÇÃO DE PESSOAL |
| `1.1.15` | PRÓ-REITORIA DE ADMINISTRAÇÃO |
| `1.1.15.2` | DIRETORIA DE ADMINISTRAÇÃO, ORÇAMENTO E FINANÇAS |
| `1.1.15.2.1` | COORDENAÇÃO DE ADMINISTRAÇÃO, ALMOXARIFADO E PATRIMÔNIO |
| `1.1.15.2.1.1` | SETOR DE ALMOXARIFADO E PATRIMÔNIO |
| `1.1.15.2.3` | COORDENAÇÃO DE ORÇAMENTO E FINANÇAS |
| `1.1.15.3` | DIRETORIA DE COMPRAS, LICITAÇÕES E CONTRATOS |
| `1.1.15.3.1` | COORDENAÇÃO DE LICITAÇÕES E CONTRATOS |
| `1.2.4` | DIRETORIA DE ADMINISTRAÇÃO |
| `1.2.4.1` | COORDENAÇÃO DE ALMOXARIFADO E PATRIMÔNIO |
| `1.2.4.3` | COORDENAÇÃO DE LICITAÇÕES E CONTRATOS |

…e mais 53 unidades com a mesma competência.

## Base normativa

- **Art. 2** — Atribuições do Conselho Superior - Consup:
- **Art. 3** — Atribuições da Auditoria Interna
- **Art. 4** — Atribuições do Colégio de Dirigentes - Codir
- **Art. 5** — Atribuições da Comissão de Ética - CE
- **Art. 7** — Atribuições da Comissão Permanente de Pessoal Docente - CPPD
- **Art. 8** — Atribuições da Unidade Correcional Instituída - UCI
- **Art. 10** — Atribuições da Comitê de Tecnologia da Informação - CTI
- **Art. 18** — Atribuições da Diretoria de Governança, Riscos e Controles - DGRC
- **Art. 19** — Atribuições da Coordenação de Governança e Gestão da Integridade - CGGI
- **Art. 20** — Atribuições da Coordenação de Centro de Referência
- **Art. 51** — Atribuições da Diretoria de Administração, Orçamento e Finanças - DAOF

Fundamento declarado nos manifestos: *Termos da Uorg/cargo: DIRETORIA DE ADMINISTRAÇÃO*; *Termos da Uorg/cargo: COORDENAÇÃO DE ALMOXARIFADO E PATRIMÔNIO*; *Termos da Uorg/cargo: COORDENAÇÃO DE LICITAÇÕES E CONTRATOS*; *Termos da Uorg/cargo: COORDENAÇÃO DE ORÇAMENTO E FINANÇAS*; *Termos da Uorg/cargo: DIRETORIA DE ADMINISTRAÇÃO, PLANEJAMENTO E DESENVOLVIMENTO*; *Termos da Uorg/cargo: COORDENAÇÃO DE ADMINISTRAÇÃO, ORÇAMENTO E FINANÇAS*; *Termos da Uorg/cargo: COORDENAÇÃO DE LICITAÇÃO, COMPRAS E CONTRATOS*; *Termos da Uorg/cargo: DIRETORIA DE ADMINISTRAÇÃO, PLANEJAMENTO E DESENVOLVIMENTO INSTITUCIONAL*; *Termos da Uorg/cargo: COORDENAÇÃO DE ADMINISTRAÇÃO DE PESSOAL*; *Termos da Uorg/cargo: PRÓ-REITORIA DE ADMINISTRAÇÃO*; *Termos da Uorg/cargo: DIRETORIA DE ADMINISTRAÇÃO, ORÇAMENTO E FINANÇAS*; *Termos da Uorg/cargo: COORDENAÇÃO DE ADMINISTRAÇÃO, ALMOXARIFADO E PATRIMÔNIO*; *Termos da Uorg/cargo: SETOR DE ALMOXARIFADO E PATRIMÔNIO*; *Termos da Uorg/cargo: DIRETORIA DE COMPRAS, LICITAÇÕES E CONTRATOS*; *Termos da Uorg/cargo: COMISSÃO INTERNA DE SUPERVISÃO DO PLANO DE CARREIRA DOS SERVIDORES TÉCNICO-ADMINISTRATIVOS EM EDUCAÇÃO*; *Termos da Uorg/cargo: SETOR DE LICITAÇÕES E CONTRATOS*; *Termos da Uorg/cargo: SETOR DE ORÇAMENTO E FINANÇAS*.

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
