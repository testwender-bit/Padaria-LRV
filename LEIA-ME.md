# Patch v9.2 Fix — Corrige erro de TypeScript no build da Vercel

## Problema

Erro de build na Vercel:
```
Type error: Argument of type '{ total_gramas: number; ... }' is not assignable to
parameter of type 'SetStateAction<ListaResponse | null>'.
Type '{ total_gramas: number; ... }' is missing the following properties from type
'ListaResponse': cardapio, semanas_consideradas, escolas, total_alunos_parcial, and 2 more.
```

## Causa

A função `handleAbrirSnapshot` criava um objeto parcial sem todos os campos
obrigatórios da interface `ListaResponse`.

## Fix

Agora `handleAbrirSnapshot` preenche TODOS os campos:
- `cardapio` — objeto com dados do snapshot (ou vazio)
- `semanas_consideradas` — array vazio (snapshot não guarda)
- `escolas` — parse de `escolas_snapshot` (JSON)
- `total_alunos_parcial/integral` — 0 (snapshot não guarda)
- `total_itens` — contagem dos itens
- `total_gramas/kg` — soma calculada dos itens
- `por_grupo` — agrupamento calculado por grupo

## Como aplicar

```bash
unzip patch-lista-compras-v9.2-fix.zip -d .
git add -A
git commit -m "fix(v9.2): corrige erro de TypeScript no handleAbrirSnapshot"
git push
```
