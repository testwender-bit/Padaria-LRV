# Patch v6.2 — Fruta sempre por último + Script carne moída fantasma

Corrige 2 problemas reportados:

1. **Ordenação ainda errada** — caso "Torta de carne moída + Laranja + Suco de maracujá" continuava bagunçado (fruta ia antes do suco)
2. **Novo fantasma** — "Carne moída ao molho" (fantasma) → "Carne bovina moída em molho" (real)

---

## 📦 Arquivos deste patch

### Modificados (1 arquivo)

| Arquivo | O que mudou |
|---|---|
| `src/lib/ordenacao-preparacoes.ts` | **Fruta sempre por último** em todos os perfis. No perfil COMIDA: Fruta passou de prioridade 5 → 6, Suco/Bebida passou de 6 → 5. No perfil CUSCUZ: Fruta mantém 3, mas Bebida/Suco passou de 4 → 2 (antes da fruta). PAO_LANCHE já estava correta. |

### Novos (2 arquivos)

| Arquivo | Função |
|---|---|
| `scripts/fix-carne-moida-fantasma.ts` | Script bulk SQL (mesma lógica do fix-arroz v2) que substitui "Carne moída ao molho" por "Carne bovina moída em molho" em todos os cardápios. Dry-run + `--apply`. |
| `scripts/test-caso-torta.ts` | Teste específico do caso reportado (Torta+Laranja+Suco) + 4 casos adicionais validando consistência da regra "fruta por último" |

---

## 🚀 Como aplicar

### Passo 1 — Aplicar o patch

```bash
unzip -o patch-v6.2-fruta-ultimo-carne-moida.zip
```

### Passo 2 — Rodar o teste do caso do usuário (validar fix)

```bash
npx tsx scripts/test-caso-torta.ts
```

Deve mostrar `✅ Caso do usuário RESOLVIDO — fruta agora fica por último` com 5/5 casos passando:
- Torta de carne + Laranja + Suco → Torta → Suco → Laranja ✅
- Almoço completo → ... → Suco → Banana (fruta no fim) ✅
- Lanche com pão → Suco → Pão → Banana ✅
- Cuscuz → Cuscuz → Carne → Suco → Banana ✅

### Passo 3 — Rodar o script de migração do fantasma carne moída

```bash
# DRY-RUN primeiro (vê o que será feito, não modifica)
npx tsx scripts/fix-carne-moida-fantasma.ts

# Se concordar com o par detectado, aplicar:
npx tsx scripts/fix-carne-moida-fantasma.ts --apply
```

O script vai:
1. Auto-detectar "Carne moída ao molho" (fantasma, palavra "ao") e "Carne bovina moída em molho" (correto, palavra "em")
2. Para cada CardapioItem do fantasma:
   - Se já existe item do correto no mesmo slot → MERGE (soma porções)
   - Senão → UPDATE (troca preparacao_id)
3. Incrementar vezes_usada do correto
4. Hard-delete do fantasma

Tudo em transação atômica de 30s com bulk SQL operations (mesma estratégia do fix-arroz v2 que funcionou).

### Passo 4 — Validar no navegador

1. Abra um cardápio que tinha "Carne moída ao molho" → deve mostrar só "Carne bovina moída em molho"
2. Clique no botão "Reordenar" no header da semana
3. Confirme que frutas agora ficam sempre por último (depois de suco/bebida)

### Passo 5 — Commit e push

```bash
git add src/lib/ordenacao-preparacoes.ts \
        scripts/fix-carne-moida-fantasma.ts \
        scripts/test-caso-torta.ts \
        PATCH-README.md

git commit -m "fix(ordenacao): fruta sempre por último + script carne moída fantasma (v6.2)

Ordenação:
- Perfil COMIDA: Fruta passou de prioridade 5 → 6 (sempre por último)
  Suco/Bebida passou de 6 → 5 (antes da fruta)
  Resultado: Salada → Arroz → Feijão → Proteína → Acompanhamento → Bebida → Fruta
- Perfil CUSCUZ: Bebida/Suco passou de 4 → 2 (antes da fruta)
  Resultado: Cuscuz → Acompanhamento → Bebida → Fruta
- Perfil PAO_LANCHE: já estava correto (Bebida → Pão → Fruta)

Script carne moída fantasma:
- scripts/fix-carne-moida-fantasma.ts
- Auto-detecta 'Carne moída ao molho' (fantasma, palavra 'ao')
  e 'Carne bovina moída em molho' (correto, palavra 'em')
- Bulk SQL operations (UPDATE...FROM, DELETE...WHERE EXISTS)
- Transação atômica 30s, dry-run + --apply
- Mesma lógica testada do fix-arroz-fantasma v2

Teste do caso do usuário:
- scripts/test-caso-torta.ts (5 casos)
- Valida: Torta+Laranja+Suco → Torta → Suco → Laranja
- Mais 4 casos de consistência (almoço completo, pão, cuscuz)"

git push
```

---

## 🎯 Detalhes técnicos

### Fix 1: Fruta sempre por último

**Cenário problemático (v6.1):**
```
Torta de carne moída  (PROTEINA, prioridade 3)
Laranja               (FRUTA,    prioridade 5)  ← ia antes do suco
Suco de maracujá      (BEBIDA,   prioridade 6)
```
Resultado v6.1: Torta → Laranja → Suco ❌

**Cenário corrigido (v6.2):**
```
Torta de carne moída  (PROTEINA, prioridade 3)
Suco de maracujá      (BEBIDA,   prioridade 5)  ← agora antes da fruta
Laranja               (FRUTA,    prioridade 6)  ← sempre por último
```
Resultado v6.2: Torta → Suco → Laranja ✅

#### Tabela de prioridades v6.2 (perfil COMIDA)

| Categoria | v6.1 | v6.2 |
|---|---|---|
| SALADA | 0 | 0 |
| ARROZ | 1 | 1 |
| FEIJAO | 2 | 2 |
| PROTEINA | 3 | 3 |
| ACOMPANHAMENTO/PAO/LANCHE/CUSCUZ | 4 | 4 |
| OUTRO | 5 | 5 |
| **SUCO** | **6** | **5** ← mudou |
| **BEBIDA** | **6** | **5** ← mudou |
| **FRUTA** | **5** | **6** ← mudou |
| **SOBREMESA** | **5** | **6** ← mudou |

#### Tabela de prioridades v6.2 (perfil CUSCUZ)

| Categoria | v6.1 | v6.2 |
|---|---|---|
| CUSCUZ | 0 | 0 |
| PROTEINA/ACOMPANHAMENTO/ARROZ/FEIJAO | 1 | 1 |
| OUTRO | 2 | 2 |
| **BEBIDA** | **4** | **2** ← mudou |
| **SUCO** | **4** | **2** ← mudou |
| FRUTA | 3 | 3 |
| SOBREMESA | 3 | 3 |

#### Perfil PAO_LANCHE (não mudou)

Já estava correto: Bebida(0) → Pão(1) → Outro(2) → Fruta(3). Fruta já ficava por último.

### Fix 2: Script carne moída fantasma

**Lógica de auto-detecção:**

1. Busca preparações com nome contendo "carne" + "molho"
2. Filtra só as que têm "moída"/"moida"
3. Heurística:
   - Nome contém "ao molho" → FANTASMA
   - Nome contém "em molho" → CORRETO
   - Fallback: inativo/sem ingredientes → FANTASMA
4. Pega o com mais usos de cada lado (em caso de múltiplas ocorrências)

**Operações bulk (mesma lógica do fix-arroz v2 que funcionou):**

1. BULK MERGE: `UPDATE...FROM` soma porções onde ambos coexistem no mesmo slot
2. BULK DELETE: `DELETE...WHERE EXISTS` remove itens merged do fantasma
3. BULK UPDATE: `updateMany` troca preparacao_id nos restantes
4. UPDATE vezes_usada do correto
5. DELETE SobrescritaCardapio + PreparacaoSubstituicao
6. Sanity check COUNT
7. Hard-delete do fantasma

Tudo em transação atômica 30s. ~7 queries totais, executa em <1s.

---

## ✅ Validação

| Teste | Resultado |
|---|---|
| `test-caso-torta.ts` (caso do usuário + 4 adicionais) | 5/5 ✅ |
| `test-ordenacao-v6.ts` (18 casos v6) | 18/18 ✅ |
| `test-ordenacao-v5.ts` (18 casos v5) | 18/18 ✅ |
| `test-alergenos-correcao.ts` (23 casos) | 23/23 ✅ |
| `tsc --noEmit` strict=true em `ordenacao-preparacoes.ts` | 0 erros ✅ |

Total: **64 testes, todos passam**.

---

## ❓ Troubleshooting

### O script de carne moída não auto-detectou
Se o nome real no banco for ligeiramente diferente (ex: "Carne moída com molho"), rode:
```bash
npx tsx scripts/fix-carne-moida-fantasma.ts --apply --fantasma-id=XXX --correto-id=YYY
```

Para descobrir os IDs, rode no SQL Editor do Supabase:
```sql
SELECT id, nome, ativo FROM "Preparacao"
WHERE LOWER(nome) LIKE '%carne moída%' AND LOWER(nome) LIKE '%molho%';
```

### Ainda tem algum caso de ordenação errada
Me mande o nome exato das preparações + categorias delas no banco (`/nutricao/preparacoes` → editar → ver campo Categoria). Vou ajustar as prioridades ou palavras-chave conforme o caso.

### Fruta ainda aparece antes de bebida
Pode ser ordem manual. Clique no botão "Reordenar" no header da semana para resetar e re-aplicar a ordem canônica.
