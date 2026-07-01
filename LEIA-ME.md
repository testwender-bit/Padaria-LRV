# Patch v9.2 Fix 2 — Corrige campo qtd_total_gramas

## Problema
```
Type error: Property 'total_gramas' does not exist on type 'ItemLista'. Did you mean 'qtd_total_gramas'?
```

## Causa
Na interface `ItemLista`, o campo se chama `qtd_total_gramas` (não `total_gramas`).
A função `handleAbrirSnapshot` usava o nome errado.

## Fix
Corrigidas 2 linhas para usar `qtd_total_gramas`:
- Linha 131: `i.qtd_total_gramas` (era `i.total_gramas`)
- Linha 134: `i.qtd_total_gramas` (era `i.total_gramas`)

## Como aplicar
```bash
unzip patch-lista-compras-v9.2-fix2.zip -d .
git add -A
git commit -m "fix: campo qtd_total_gramas no handleAbrirSnapshot"
git push
```
