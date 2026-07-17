# Regras de trabalho deste repositório

Regras pedidas pelo dono do repositório — valem para toda sessão futura.

## Quando o usuário pedir uma implementação

Após concluir e verificar a implementação, **sem esperar novo pedido**:

1. **Commitar e abrir pull request** para a `main` e **fazer o merge** (squash,
   como de costume) assim que o CI passar e os comentários de review forem
   verificados. Reportar o link do repositório ao final.
2. **Verificar o README** (`so-ia/README.md`) e **melhorá-lo**: refletir o que
   mudou e deixá-lo sempre mais didático e visual (passo a passo, tabelas,
   diagramas/screenshots quando ajudarem). A melhoria do README entra no mesmo
   pull request da implementação.

## Convenções já estabelecidas

- Branch de trabalho: `claude/premium-system-design-o5i7yo`. PRs são
  squash-merged; antes de trabalho novo, ressincronizar com
  `git fetch origin main && git checkout -B <branch> origin/main`.
- Identidade de commit: `Claude <noreply@anthropic.com>` (hook do repositório
  rejeita outra identidade).
- Projeto principal: `so-ia/` (Next.js 16, Tailwind v4, shadcn/ui sobre
  @base-ui/react — usar `render`, não `asChild`; Framer Motion).
- Regra de produto central: **tudo deriva do organograma carregado** — se uma
  área não existe no organograma, nenhuma ferramenta/conteúdo daquela área
  deve existir no sistema (ver `so-ia/src/lib/org/relevance.ts`).
