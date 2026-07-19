# Packs

Coloque aqui os "packs" que você já tem — bundles de agentes, squads,
workflows e skills — para o Super Construtor importar (Etapa 4 do
[Guia de Construção](../docs/PRD-genius-allspark-construcao.md)).

## Formato esperado

Um arquivo `.json` por pack, validado pelo schema `Pack` de
`packages/canon`:

```json
{
  "id": "pack-licitacoes",
  "nome": "Pack de Licitações",
  "versao": "1.0.0",
  "agents": [ /* entidades Agent */ ],
  "squads": [ /* entidades Squad */ ],
  "skills": [ /* entidades Skill */ ],
  "workflows": [ /* declarativos, formato livre por enquanto */ ]
}
```

Arquivos `.json` nesta pasta são ignorados pelo Git (ver `.gitignore` na
raiz) — cada organização/instalação tem seus próprios packs, que não fazem
parte do código-fonte do produto. Este `README.md` é a exceção versionada.
