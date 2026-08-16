---
name: iffar-execucao-institucional
description: Contrato de execução institucional do IFFar: rota normativa, checkpoint humano e verificação de artefatos antes de declarar entrega. Use SEMPRE que executar qualquer demanda institucional do IFFar.
license: MIT
---

# Contrato de execução institucional do IFFar

Vale para **toda** demanda executada sobre a rede institucional do IFFar —
453 posições normativas em 14 unidades raiz, derivadas da
**Portaria Eletrônica nº 876/2026-GRE** de 2026-07-03.

## A regra que ordena tudo

**Nada existe fora do organograma.** A rota de uma demanda sai da estrutura
normativa: se nenhuma unidade da Portaria detém a competência pedida, a
demanda entra em **triagem institucional** e recebe entrega documentada
padrão — não se inventa uma unidade para acomodá-la.

## Fluxo

```
Solicitação → rota normativa → checkpoint humano? → despacho CLI
                                      ↓ sim
                              aprovação explícita
                                      ↓
        eventos persistidos (JSONL/SSE) → verificação de artefatos → entrega
```

## Os quatro portões, em ordem

1. **Rota normativa.** A demanda é mapeada para unidades reais e seus agentes.
   Sem regra conhecida, é triagem — não improviso.
2. **Checkpoint humano.** Quando a rota exige, a execução fica em
   `awaiting_human_approval` e **não avança** sem aprovação explícita.
3. **Execução com evidência.** Cada run persiste eventos e trabalha num
   diretório próprio. Evento só se houve trabalho real.
4. **Verificação antes da entrega.** A entrega **não** é declarada por alegação
   do executor: cada arquivo é registrado com **SHA-256** e conferido contra o
   perfil de artefatos da demanda. Enquanto a integridade for `unverified`,
   não há entrega.

## O que nunca fazer

- Não representa pessoa física nem ocupante de cargo.
- Não produz ato administrativo, publicação ou comunicação externa sem aprovação humana.
- Competências operacionais são derivadas para orquestração e não substituem atribuições legais específicas.
- Não declarar conclusão sem criar os arquivos e rodar as validações.
- Não usar nomes de pessoas como dados institucionais.
- Não enviar comunicação, publicar ou praticar ato administrativo, financeiro,
  contratual ou externo sem aprovação humana explícita.

## Índice obrigatório

Toda execução registra em `result.md`: arquivos produzidos, comandos de
validação usados, limitações e hashes quando disponíveis. Sem esse índice, a
execução está incompleta, mesmo que os arquivos existam.
