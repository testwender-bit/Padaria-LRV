# Fix — Aviso aparecia em todas as semanas

## Problema

Ao cadastrar um aviso em uma semana, ele aparecia em TODAS as semanas no
dashboard e na produção.

## Causa

Quando a API não encontrava o cardápio exato da semana (ex: 2º semestre sem
semanas cadastradas), usava fallback e pegava o primeiro cardápio do ano —
que tinha o aviso. Resultado: o aviso da semana 1 aparecia em todas.

## Fix

Adicionado controle `matchExato`:
- **Match exato** (ano + semana ISO, ou por data): retorna o aviso ✓
- **Fallback genérico** (primeiro do ano, ou ISO sem ano): NÃO retorna o aviso ✗

Assim, o aviso só aparece na semana que realmente tem o cardápio cadastrado.

## Como aplicar

```bash
unzip patch-fix-aviso-semana.zip -d .
git add -A
git commit -m "fix: aviso da semana só aparece na semana correta"
git push
```
