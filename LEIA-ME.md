# Fix v2 — PF_COMP faltava ordem_rota (patch completo)

## Problema

O patch anterior só tinha 1 arquivo. Esse tem TODOS os arquivos para
garantir que nada fique desatualizado.

## O que tem neste patch (8 arquivos):

1. `prisma/schema.prisma` — modelo ProducaoExtra + campo pao_fixo
2. `src/app/api/producao/route.ts` — 6 ordem_rota (inclui PF_COMP) + producaoExtra
3. `src/app/api/producao/extra/route.ts` — API de produções extras
4. `src/app/api/romaneio/route.ts` — ordem_rota + ordenação
5. `src/app/(app)/producao/page.tsx` — UI produção extra + ordenação
6. `src/lib/producao-utils.ts` — ItemProducao com ordem_rota
7. `src/lib/producao-semana-utils.ts` — EscolaConsolidada com ordem_rota
8. `src/lib/romaneio-utils.ts` — EscolaRomaneio com ordem_rota

## Como aplicar

```bash
unzip -o patch-fix-pf-comp-v2.zip -d .
npx prisma generate
npx prisma db push --accept-data-loss
git add -A
git commit -m "fix: ordem_rota em todos os push + produção extra + schema"
git push
```
