# Fix — Lanche compacto na impressão

## Problema

O lanche agrupado por dia estava com tabelas separadas demais — cada dia
tinha sua própria tabela com header, ocupando muito espaço e podendo não
caber numa folha só.

## Solução

Agora é UMA tabela só com 2 colunas (DIA/ESCOLA + QUANTIDADE), onde os dias
aparecem como sub-headers dentro da própria tabela:

```
┌──────────────────────────┬────────────┐
│ DIA / ESCOLA             │ QUANTIDADE │
├──────────────────────────┼────────────┤
│ SEGUNDA                  │ 150 unid.  │ ← sub-header bold
│   Anjo da Guarda         │ 50         │ ← indentado
│   Chico Mendes           │ 60         │
│   São Cristóvão          │ 40         │
│ TERÇA                    │ 120 unid.  │ ← sub-header bold
│   Anjo da Guarda         │ 50         │
│   Fredolino              │ 70         │
│ SEXTA                    │ 80 unid.   │
│   ...                    │            │
└──────────────────────────┴────────────┘
```

Vantagens:
- Ocupa muito menos espaço vertical
- Cabe numa folha só
- Fácil de ler — cada dia é um bloco visual dentro da tabela
- As escolas ficam indentadas (4mm) sob o dia

Aplicado tanto na produção (página 3) quanto nos romaneios por motorista.

## Como aplicar

```bash
unzip patch-lanche-compacto.zip -d .
git add -A
git commit -m "fix: lanche compacto numa tabela só na impressão"
git push
```
