# Patch v8.14 — Bifásica Refinada + Fix de Transação + PDF Slots Vazios

## 3 correções neste patch

### 1. Bug: "Transaction not found" ao criar/clonar cardápio

**Causa:** O Supabase free tier com `pgbouncer=true` em modo transação mata
transações longas. Criar um cardápio novo envolvia 133 INSERTs em UMA transação
(1 cardápio + 22 semanas + 110 dias). O pgbouncer fechava a conexão antes de
terminar, gerando "Transaction API error: Transaction not found".

**Fix:** Removida a `$transaction` das APIs:
- `src/app/api/nutricao/cardapios/route.ts` (POST — criar cardápio)
- `src/app/api/nutricao/cardapios/[id]/clonar/route.ts` (POST — clonar cardápio)

Agora fazem creates sequenciais com `createMany` para os dias (1 query por
semana em vez de 5). Em caso de erro no meio, deleta o cardápio criado
(cascade cuida da limpeza).

### 2. Bug: PDF não mostrava slots vazios (ex: LANCHE_PRE_ESCOLA)

**Causa:** O PDF só listava tipos de refeição que tinham pelo menos 1 item na
semana. Como a bifásica recém-clonada da creche tem o slot LANCHE_PRE_ESCOLA
vazio em todos os dias, ele não aparecia no PDF.

**Fix:** Agora o PDF carrega TODOS os tipos da categoria via
`/api/nutricao/categorias-refeicao` e mescla com os tipos que aparecem nos
itens. Slots vazios aparecem como "—" (ou "≡ igual à creche" para
LANCHE_PRE_ESCOLA).

### 3. Bifásica v8.14 (refinamento da estrutura)

```
1. CAFE_MANHA (Café da Manhã) — 07h30 — 20%
   ↳ FRUTA (Fruta) — 08h45 / 13h30 — 15% [SUB — mesma fruta 2x, cálculo 1x]
2. LANCHE_PRE_ESCOLA (Lanche Pré-Escola) — 09h00 / 15h00 — 10%  [slot próprio]
3. ALMOCO (Almoço) — 10h00 — 30%
4. JANTAR (Jantar) — 15h30 — 25%
Total: 100% · 4 linhas no PDF · cabe em 1 folha A4 paisagem ✓
```

Mudanças:
- FRUTA_MANHA renomeado para "Fruta" (genérico, 2 horários)
- HIDRATACAO removido da BIFASICA (5% absorvido pela FRUTA)
- LANCHE_PRE_ESCOLA vira slot próprio (deixou de ser sub), 2 horários
- LANCHE_PRE_ESCOLA fica cronologicamente acima do ALMOCO (09h00 < 10h00)

## Arquivos

| Arquivo | O que mudou |
|---------|-------------|
| `prisma/schema.prisma` | Campo `sub_de_codigo` em `TipoRefeicao` (v8.13) |
| `scripts/setup-bifasica-v813.ts` | Setup v8.14: renomeia FRUTA, remove HIDRATACAO, LANCHE_PRE_ESCOLA slot próprio |
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Editor: múltiplos subs + fix WebkitAppearance |
| `src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx` | PDF: carrega categorias-refeicao + mostra slots vazios |
| `src/app/(app)/nutricao/cardapios/[id]/replicar/page.tsx` | Replicação CRECHE ↔ BIFASICA |
| `src/app/api/nutricao/cardapios/route.ts` | POST: sem $transaction, usa createMany |
| `src/app/api/nutricao/cardapios/[id]/route.ts` | Inclui `sub_de_codigo` no select |
| `src/app/api/nutricao/cardapios/[id]/replicar/route.ts` | Usa categoria da escola destino |
| `src/app/api/nutricao/cardapios/[id]/clonar/route.ts` | Sem $transaction, usa createMany |
| `src/app/print.css` | Classes para sub-slot e badge "igual à creche" |

## Como aplicar

1. **Descompacte** o zip na RAIZ do projeto (preserva pastas):
   ```bash
   unzip patch-bifasica-v814.zip -d .
   ```

2. **Rode `prisma db push`** (necessário por causa do campo `sub_de_codigo`):
   ```bash
   npx prisma generate
   npx prisma db push --accept-data-loss
   ```
   ⚠️ **NÃO causa perda de dados** — apenas adiciona coluna nullable.

3. **Rode o script de setup v8.14** (idempotente):
   ```bash
   npx tsx scripts/setup-bifasica-v813.ts --apply
   ```

4. Faça commit e push:
   ```bash
   git add -A
   git commit -m "fix(v8.14): transação + PDF slots vazios + bifásica refinada"
   git push
   ```

## Após aplicar — teste os 2 bugs corrigidos

1. **Criar cardápio:** `/nutricao/cardapios` → "Novo Cardápio" → preencha → Criar
   - Antes: erro 500 "Transaction not found"
   - Agora: deve criar com sucesso e redirecionar para o editor

2. **Clonar creche → bifásica:** abra um cardápio CRECHE → "Clonar" → selecione escola bifásica
   - Antes: erro 500 (mesmo motivo)
   - Agora: deve clonar com sucesso

3. **PDF da bifásica:** abra um cardápio BIFASICA → "PDF"
   - Antes: faltava a linha LANCHE_PRE_ESCOLA (slot vazio)
   - Agora: mostra 4 linhas incluindo LANCHE_PRE_ESCOLA com "—" nos dias vazios
