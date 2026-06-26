# Patch v8.17 Fix — Script APAE sem dependência externa

## Problema

O script `importar-cardapio-apae.ts` usava `import { parse } from 'csv-parse/sync'`
(biblioteca externa não instalada no projeto). Resultado: erro
`Cannot find module 'csv-parse/sync'` ao rodar.

## Fix

Reescrevi o parser CSV para ser **nativo** (sem dependências externas). O novo
parser suporta:
- Campos separados por vírgula
- Campos aspassados com `"` (podem conter vírgula e quebra de linha)
- Quebras de linha dentro de campos aspassados
- `"` escapado como `""` dentro de campo aspassado

## Como aplicar

1. Descompacte o patch na raiz do projeto:
   ```bash
   unzip patch-apae-v817-fix.zip -d .
   ```

2. Rode o importador (não precisa instalar nada):
   ```bash
   npx tsx scripts/importar-cardapio-apae.ts          # dry-run
   npx tsx scripts/importar-cardapio-apae.ts --apply  # aplicar
   ```

3. Commit + push:
   ```bash
   git add scripts/importar-cardapio-apae.ts
   git commit -m "fix: parser CSV nativo no importador APAE (sem csv-parse)"
   git push
   ```
