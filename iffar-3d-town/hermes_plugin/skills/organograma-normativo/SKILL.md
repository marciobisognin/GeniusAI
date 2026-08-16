---
name: organograma-normativo
description: >-
  Transformar uma portaria em PDF na estrutura institucional executável —
  extrair unidades e competências, e então decidir cobertura, agentes e squads
  pela Lei 1. Use quando a demanda envolver a estrutura de um órgão público
  descrita em ato normativo.
license: MIT
---

# Do PDF da portaria à organização executável

## Quando usar

Quando alguém pergunta *"quem no órgão faz X?"*, *"esta demanda cabe a qual
unidade?"* ou pede para montar agentes/squads a partir da estrutura de uma
instituição pública cuja fonte é um **ato normativo em PDF**.

## As duas metades da ferramenta

Este fluxo atravessa dois pacotes, e é útil saber por quê:

| Etapa | Onde roda | Por quê |
|---|---|---|
| PDF → estrutura | Plug-in nativo (Python), ferramentas `org_extract_*` | Os extratores dependem de `pdfplumber`/`pypdf` |
| Estrutura → decisões | Servidor MCP `genius-organograma`, ferramentas `org_*` | O compilador de organograma é TypeScript |

## Procedimento

1. **Extraia a estrutura.** `org_extract_pdf` devolve as unidades com código,
   nome e hierarquia. Os padrões (`last_page: 18`) foram depurados contra a
   Portaria nº 876/2026-GRE do IFFar — **outro documento provavelmente precisa
   de outra página**. Se a contagem de unidades vier obviamente errada, ajuste
   o parâmetro em vez de aceitar o resultado.
2. **Extraia as competências.** `org_extract_competencias` devolve, por artigo,
   a unidade e o resumo dos incisos. É o que dá **base normativa** às
   afirmações — sem isso, qualquer atribuição é palpite.
3. **Verifique a cobertura antes de qualquer oferta.** Com as unidades em mãos,
   chame `org_covers` (MCP) para a área da demanda. Se vier `coberto: false`,
   **aquela área não existe nesta instituição**: diga isso em vez de inventar
   uma unidade responsável.
4. **Monte só o que é coberto.** `org_assemble`, `org_build_squad` e
   `org_workflow` produzem agentes, squads e fluxos — sempre derivados das
   unidades reais.

## A regra que ordena tudo (Lei 1)

> Nada existe sem o organograma.

Se o organograma extraído não tem a área, nenhuma ferramenta, conteúdo, KPI ou
agente daquela área deve ser oferecido. Isso não é preferência de
implementação: é a regra de produto que `org_covers` existe para aplicar.

## Cuidados

- **Sempre cite a procedência.** Unidade sem artigo que a sustente é
  informação sem base — diga que a competência é derivada, não normativa.
- **Não confunda unidade com pessoa.** A estrutura descreve cargos e órgãos,
  nunca ocupantes.
- **Não pratique ato administrativo.** Extrair e organizar estrutura não
  autoriza emitir documento oficial, publicar ou comunicar externamente.
