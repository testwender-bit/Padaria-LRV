# Patch — 3 ajustes na produção

## 1. Aviso da semana na impressão

A observação cadastrada no cardápio semestral agora aparece na impressão:
- **Páginas de PF (1ª e 2ª via):** aviso sutil antes do footer
- **Página de PCQ/Lanches:** aviso sutil antes do footer
- **Romaneios (PF e PCQ/Lanche):** aviso sutil antes do footer

Estilo: caixa com borda cinza fina, fundo amarelo claro, fonte itálica 7.5pt.

## 2. Bug: células vazias não deixavam editar

**Problema:** Ao clicar numa célula vazia (quantidade=0) na edição manual,
não abria o diálogo de ajuste.

**Causa:** `if (quantidade <= 0) return` bloqueava células vazias.

**Fix:** Removida a verificação — agora pode clicar em qualquer célula
(com ou sem valor) para ajustar/adicionar.

## 3. Lanche agrupado por dia na impressão

**Antes:** Lanche mostrado em tabela com escolas × dias (igual PF/PCQ).

**Agora:** Lanche agrupado por dia:
```
SEGUNDA — 150 unid.
┌──────────────────────┬──────────┐
│ ESCOLA / UNIDADE     │ QTD      │
├──────────────────────┼──────────┤
│ Anjo da Guarda       │ 50       │
│ Chico Mendes         │ 60       │
│ São Cristóvão        │ 40       │
└──────────────────────┴──────────┘

TERÇA — 120 unid.
┌──────────────────────┬──────────┐
│ ...
```

Cada dia tem seu próprio mini-bloco com:
- Header cinza com nome do dia + total do dia
- Tabela simples: Escola × Quantidade
- Só aparecem dias que têm lanche

## Como aplicar

```bash
unzip patch-producao-ajustes3.zip -d .
git add -A
git commit -m "fix: aviso na impressão + editar células vazias + lanche agrupado por dia"
git push
```
