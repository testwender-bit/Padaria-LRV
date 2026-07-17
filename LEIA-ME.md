# Fix — Ordenação definitiva + Produção Extra na impressão

## 1. Ordenação corrigida (definitiva)

**Causa raiz:** A função `consolidarProducaoSemana` (producao-semana-utils.ts)
tinha um `sort((a, b) => a.ordem - b.ordem)` que ordenava por `ordem` (que
vinha de `ordensEscola` que era `undefined` na chamada da página — tudo ficava
999 = aleatório). Depois a página fazia OUTRO sort. Os dois conflitavam.

**Fix:** O sort final agora usa a MESMA lógica da página:
```
rota (asc) → ordem_rota (asc) → nome_curto (asc alfabético)
```

Isso garante que mesmo que todas as escolas tenham `ordem_rota=0`, elas
ficam ordenadas alfabeticamente por `nome_curto`.

## 2. Produção Extra na impressão

Adicionada nova página na impressão (entre PCQ/Lanches e Romaneio):
```
PRODUÇÃO EXTRA — INSTITUIÇÕES
┌──────────────┬─────────┬──────┬──────┬─────┐
│ INSTITUIÇÃO  │ PRODUTO │ DIA  │ QTD  │ OBS │
├──────────────┼─────────┼──────┼──────┼─────┤
│ Sec. Educação│ PF      │ Seg  │ 50   │ —   │
│ CRAS         │ LANCHE  │ Qua  │ 30   │ —   │
└──────────────┴─────────┴──────┴──────┴─────┘
```

Só aparece se houver produções extras cadastradas.

## Como aplicar

```bash
unzip -o patch-ordenacao-extra-print.zip -d .
git add -A
git commit -m "fix: ordenação alfabética definitiva + produção extra na impressão"
git push
```
