# Patch — 2 ajustes na padaria

## 1. PCQ aceita valores decimais (1,5 / 0,75 etc.)

**Problema:** Campos de PCQ usavam `parseInt` que corta decimais. Ao digitar 1,5 salvava 1.

**Fix:**
- UI: trocado `parseInt` por `parseFloat` + adicionado `step="0.01"`
- Schema: trocado `Int` por `Float` nos 6 campos de PcqQuantidade

⚠️ **IMPORTANTE:** Após aplicar, rode `npx prisma db push --accept-data-loss` para atualizar o banco. Os valores Int existentes viram Float automaticamente (sem perda).

## 2. Produção mostra 1º semestre no 2º

**Problema:** A API buscava `CardapioSemestral` por `numero_semana_iso` SEM filtrar por `ano`. No 2º semestre as semanas ISO são 27-48, mas só existem registros 1-22 (1º semestre). Resultado: não encontrava nada e o fallback por data também falhava.

**Fix:** Adicionados múltiplos fallbacks em cascata:
1. Busca por `ano + numero_semana_iso` (mais específico)
2. Fallback por data (data_inicio/data_fim)
3. Fallback por `numero_semana_iso` sem ano (reutiliza cardápio de outro ano)
4. Fallback: primeiro cardápio do ano (para não ficar vazio)

## Como aplicar

```bash
unzip patch-padaria-ajustes.zip -d .
npx prisma generate
npx prisma db push --accept-data-loss
git add -A
git commit -m "fix: PCQ aceita decimais + produção encontra cardápio 2º semestre"
git push
```
