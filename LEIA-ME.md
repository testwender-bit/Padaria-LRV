# Patch v8.11 — Suco primeiro quando há Cuscuz

## O que muda

**Bug corrigido:** Quando um slot de refeição tinha CUSCUZ + SUCO (ou outra bebida),
o suco aparecia DEPOIS do cuscuz e da proteína — enquanto em dias de PAO_LANCHE
o suco já aparecia primeiro. Inconsistente.

**Exemplo real do banco (Anjo da Guarda, Semana 3, sexta):**
- ANTES: Cuscuz → Leite com cacau (bebida em 2º)
- DEPOIS: **Leite com cacau → Cuscuz** (bebida em 1º ✓)

## Mudança na lógica

No arquivo `ordenacao-preparacoes.ts`, função `getPrioridadePorPerfil`,
perfil `CUSCUZ`:

| Categoria  | Antes (v8.9) | Agora (v8.11) |
|------------|--------------|---------------|
| BEBIDA     | 2            | **0** (primeiro) |
| SUCO       | 2            | **0** (primeiro) |
| CUSCUZ     | 0            | 1             |
| PROTEINA   | 1            | 2             |
| ACOMPANHAMENTO | 1        | 2             |
| ARROZ      | 1            | 2             |
| FEIJAO     | 1            | 2             |
| OUTRO      | 2            | 3             |
| FRUTA      | 3            | 4             |
| SOBREMESA  | 3            | 4             |

Agora o perfil CUSCUZ segue a mesma regra do PAO_LANCHE para bebidas: **bebida sempre primeiro**, depois o carboidrato (cuscuz), depois a proteína, depois a fruta.

## Arquivos

1. `ordenacao-preparacoes.ts` → substitui `src/lib/ordenacao-preparacoes.ts`
2. `recalcular-ordenacao-v11.ts` → coloque em `scripts/recalcular-ordenacao-v11.ts`

## Como aplicar

1. Substitua os 2 arquivos nos caminhos indicados.
2. Reinicie o `npm run dev` — a UI e o PDF já vão mostrar a nova ordem (a
   ordenação é dinâmica, aplicada em runtime por `sortItensByRefeicao`).
3. **OPCIONAL:** rode o script para persistir a ordem no banco:
   ```bash
   npx tsx scripts/recalcular-ordenacao-v11.ts          # dry-run (relatório)
   npx tsx scripts/recalcular-ordenacao-v11.ts --apply   # aplicar
   ```
   O script pode demorar vários minutos no Supabase free tier (~6500 itens).

## Observação

Apenas 22% dos itens no banco têm `ordem > 0` (ordem manual); os outros 78%
têm `ordem=0` e são ordenados dinamicamente em runtime. Isso significa que a
maioria dos slots já vai mostrar a nova ordem automaticamente sem precisar
rodar o script.
