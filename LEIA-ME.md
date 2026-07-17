# Fix — Ordenação por ordem_rota respeitada em todo lugar

## Problema

O campo `ordem_rota` não era respeitado. Mesmo com escolas=0 e órgãos=99,
ficavam misturados.

## Causa

1. `ItemProducao` não tinha campo `ordem_rota` — a info se perdia
2. Página de produção re-ordenava SÓ por `nome_curto`, ignorando `ordem_rota`
3. Romaneio não tinha `ordem_rota` na interface nem ordenava por ele

## Fix

### 1. `ItemProducao` (producao-utils.ts)
Adicionado campo `ordem_rota: number` na interface.

### 2. API de produção (producao/route.ts)
- Todos os 5 loops que criam `ItemProducao` agora incluem `ordem_rota: escola.ordem_rota`
- `orderBy` do banco já tem `[{ rota: 'asc' }, { ordem_rota: 'asc' }, { nome_curto: 'asc' }]`

### 3. EscolaConsolidada (producao-semana-utils.ts)
- Adicionado `ordem_rota` na interface
- `obterOuCriar` copia `ordem_rota` do item

### 4. Página de produção (producao/page.tsx)
- Função `sortEscolas` ordena por: `rota → ordem_rota → nome_curto`
- Aplicada em `escolasPF`, `escolasPCQ`, `escolasLanche`

### 5. Romaneio (romaneio-utils.ts + romaneio/route.ts)
- `EscolaRomaneio` agora tem `ordem_rota`
- Construção inclui `ordem_rota: escola.ordem_rota`
- Filtragem por rota agora ordena por `ordem_rota → nome_curto`

## Resultado

Escolas com `ordem_rota=0` aparecem PRIMEIRO.
Órgãos com `ordem_rota=99` aparecem DEPOIS.
Dentro da mesma ordem_rota, ordena alfabeticamente por nome_curto.

## Como aplicar

```bash
unzip patch-ordenacao-ordem-rota.zip -d .
git add -A
git commit -m "fix: ordenação por ordem_rota respeitada em produção, romaneio e impressão"
git push
```
