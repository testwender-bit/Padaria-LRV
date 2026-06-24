# Patch v6 — Categoria FRUTA + ACOMPANHAMENTO + Fix bug item novo + Botão "Reordenar semana"

Corrige os 2 problemas que você reportou após o patch v5:

1. **"Ainda não respeita a ordem"** — itens novos adicionados a um slot com ordem manual iam para o TOPO da lista (porque `0 < 1`), empurrando os itens com ordem manual. Bug clássico.
2. **"Categorizar os itens corretamente criando uma categoria para frutas"** — adicionar FRUTA e ACOMPANHAMENTO como categorias no banco, usando-as como referência primária na ordenação (mais confiável que palavra-chave no nome).
3. **"Botão deve ser para ordenar a semana toda"** — não só o dia.

---

## 📦 Arquivos deste patch

### Modificados (4 arquivos)

| Arquivo | O que mudou |
|---|---|
| `src/lib/preparacao-categorias.ts` | Adicionadas 2 novas categorias no enum: **FRUTA** e **ACOMPANHAMENTO** |
| `src/lib/ordenacao-preparacoes.ts` | (1) Usa `preparacao.categoria` do banco como referência primária (exceto SALADA/ARROZ/FEIJAO/PROTEINA/CUSCUZ que mantêm detecção por nome por terem posição fixa). (2) Fix bug "item novo com ordem=0": itens sem ordem vão para o FIM da lista (depois dos manuais), não para o topo. (3) Nova função `detectarPerfilSlotAvancado` que aceita categoria do banco. |
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | (1) Removido botão "Reordenar dia" do header de cada dia. (2) Adicionado botão **"Reordenar"** no header da SEMANA (ao lado de "Diferenciar"). (3) Trocada handler `handleReordenarDia` por `handleReordenarSemana`. |
| `PATCH-README.md` | Este arquivo |

### Novos (3 arquivos)

| Arquivo | Função |
|---|---|
| `src/app/api/nutricao/cardapios/[id]/reordenar-semana/route.ts` | Endpoint POST que re-aplica ordem canônica em TODOS os slots de TODOS os dias da semana (5 dias × N refeições) |
| `scripts/marcar-frutas-categoria.ts` | Script dry-run + `--apply` que marca preparações existentes com FRUTA ou ACOMPANHAMENTO baseado em palavras-chave no nome |
| `scripts/test-ordenacao-v6.ts` | 18 testes cobrindo: categoria do banco tem precedência, fix bug item novo, 3 perfis, detecção, botão Reordenar semana |

### Removidos (1 arquivo)

| Arquivo | Por quê |
|---|---|
| `src/app/api/nutricao/cardapios/[id]/reordenar-dia/route.ts` | Substituído por `/reordenar-semana` (botão agora é por semana, não por dia) |

---

## 🚀 Como aplicar no Codespace

### Passo 1 — Aplicar o patch

```bash
unzip -o patch-v6-categoria-fruta-reordenar-semana.zip
```

### Passo 2 — Rodar os testes (opcional, recomendado)

```bash
# Teste da nova ordenação v6 (18 casos)
npx tsx scripts/test-ordenacao-v6.ts

# Teste v5 ainda passa (18 casos)
npx tsx scripts/test-ordenacao-v5.ts

# Teste de alérgenos continua passando (23 casos)
npx tsx scripts/test-alergenos-correcao.ts
```

Todos devem passar.

### Passo 3 — Marcar frutas e acompanhamentos existentes (IMPORTANTE)

Como as preparações antigas estão com `categoria='PREPARACAO'` (default), precisamos marcar as que são frutas/acompanhamentos. O script faz isso automaticamente por palavra-chave:

```bash
# DRY-RUN primeiro (vê o que será marcado, não modifica nada)
npx tsx scripts/marcar-frutas-categoria.ts

# Se concordar com a classificação, aplicar:
npx tsx scripts/marcar-frutas-categoria.ts --apply
```

O script vai mostrar 3 grupos:
- 🍎 **FRUTAS** — preparações com nome de fruta (banana, maçã, mamão, etc.) → marca `categoria='FRUTA'`
- 🥗 **ACOMPANHAMENTOS** — preparações com nome de legume/purê/macarrão/salada → marca `categoria='ACOMPANHAMENTO'`
- 🍽️ **PREPARAÇÕES** — continuam como PREPARACAO (proteínas, arroz, feijão, etc.)

Você pode revisar as listas no dry-run e, se alguma fruta/acomp. não foi detectada, marcar manualmente depois via tela `/nutricao/preparacoes`.

### Passo 4 — Restart do dev server

```bash
# Ctrl+C se estiver rodando, depois:
npm run dev
```

### Passo 5 — Validar no navegador

1. Abra `/nutricao/preparacoes` → confirme que as frutas estão marcadas como FRUTA, e os acompanhamentos como ACOMPANHAMENTO
2. Abra um cardápio com itens em ordem bagunçada
3. No header da semana (ao lado de "Diferenciar"), clique no botão **"Reordenar"**
4. Confirme que TODOS os slots da semana foram re-ordenados:
   - Slots com pão: Bebida → Pão → Fruta
   - Slots com cuscuz: Cuscuz → Acompanhamento → Fruta
   - Slots de comida: Salada → Arroz → Feijão → Proteína → Acompanhamento → Fruta
5. Adicione um item novo a um slot que já tem ordem manual → o item novo deve ir para o FIM da lista (não para o topo)

### Passo 6 — Commit

```bash
git add src/lib/preparacao-categorias.ts \
        src/lib/ordenacao-preparacoes.ts \
        src/app/api/nutricao/cardapios/[id]/reordenar-semana/route.ts \
        src/app/(app)/nutricao/cardapios/[id]/page.tsx \
        scripts/marcar-frutas-categoria.ts \
        scripts/test-ordenacao-v6.ts \
        PATCH-README.md

# Remover o endpoint antigo:
git rm src/app/api/nutricao/cardapios/[id]/reordenar-dia/route.ts

git commit -m "feat(cardapio): v6 — categoria FRUTA + ACOMPANHAMENTO + fix item novo + Reordenar semana

Categorias (Problema 1):
- Adicionada categoria FRUTA no enum Preparacao.categoria
- Adicionada categoria ACOMPANHAMENTO no enum
- Agora a nutricionista pode categorizar no cadastro da preparação
- Ordenação usa categoria do banco como referência primária (mais confiável que palavra-chave)
- Exceção: SALADA, ARROZ, FEIJAO, PROTEINA, CUSCUZ mantêm detecção por nome (posição fixa no cardápio)

Fix bug 'item novo com ordem=0' (Problema 2):
- Antes: item novo com ordem=0 ia para o TOPO (0 < 1), bagunçando a lista
- Agora: itens com ordem=0 vão para o FIM da lista, ordenados entre si pela prioridade canônica
- Mantém ordem manual dos itens já reordenados

Botão Reordenar semana (Problema 3):
- Removido botão 'Reordenar dia' do header de cada dia
- Adicionado botão 'Reordenar' no header da SEMANA (ao lado de 'Diferenciar')
- Novo endpoint POST /reordenar-semana reordena TODOS os slots de TODOS os dias da semana
- Removido endpoint /reordenar-dia (substituído)

Script de migração:
- scripts/marcar-frutas-categoria.ts — marca preparações existentes
  com FRUTA ou ACOMPANHAMENTO baseado em palavras-chave no nome
- Dry-run por default, --apply para aplicar
- Não toca em preparações que já têm categoria definida

Testes:
- 18 casos v6 (categoria do banco, fix item novo, perfis, botão Reordenar)
- 18 casos v5 continuam passando
- 23 casos alérgenos continuam passando"
```

---

## 🎯 Detalhes técnicos dos 3 fixes

### Fix 1: Categoria FRUTA + ACOMPANHAMENTO no banco

Em `src/lib/preparacao-categorias.ts`, o enum agora tem 7 categorias (era 5):

| Categoria | Quando usar | Posição no cardápio |
|---|---|---|
| `PREPARACAO` | Prato normal (default) | Meio |
| `PAO` | Pão francês/QC/forma | Início (perfil PAO_LANCHE) |
| `LANCHE` | Lanche especial (rosca, pão doce) | Início (perfil PAO_LANCHE) |
| `BEBIDA` | Suco, leite, chá, vitamina | Início |
| `ACOMPANHAMENTO` | **NOVO** — legumes, purê, macarrão, salada | Meio (após proteína) |
| `FRUTA` | **NOVO** — fruta in natura, salada de frutas | Fim |
| `SOBREMESA` | Doce, gelatina, pudim | Fim |

### Fix 2: Ordenação usa categoria do banco

Em `src/lib/ordenacao-preparacoes.ts`, a função `detectarCategoria(nome, categoriaBanco?)` agora:

1. Primeiro checa palavras-chave "fortes" no nome (SALADA, PROTEINA, ARROZ, FEIJAO, CUSCUZ) — essas SEMPRE têm precedência, mesmo se o banco disser outra coisa. Ex: "Salada de alface" marcada como ACOMPANHAMENTO continua sendo SALADA (vai primeiro no cardápio).
2. Depois checa a categoria do banco (FRUTA, BEBIDA, ACOMPANHAMENTO, PAO, LANCHE, SOBREMESA) — usa ela diretamente.
3. Senão, fallback para palavra-chave no nome.

Isso garante que:
- Frutas marcadas como FRUTA sempre vão para o fim (mesmo se o nome for "Fruta do conde" que não tem palavra-chave)
- Acompanhamentos marcados como ACOMPANHAMENTO sempre ficam após proteína (mesmo se o nome for "Mistura especial da casa")
- Saladas sempre ficam primeiro, mesmo se marcadas como ACOMPANHAMENTO

### Fix 3: Bug "item novo com ordem=0"

**Antes (v5):**
```typescript
const temOrdemManual = itens.some(i => (i.ordem ?? 0) > 0)
if (temOrdemManual) {
  return [...itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  // ❌ Item novo com ordem=0 vai para o TOPO (0 < 1)
}
```

**Agora (v6):**
```typescript
function atribuirOrdemParaItensSemOrdem(itens, tiposRefeicao) {
  const comOrdem = itens.filter(i => (i.ordem ?? 0) > 0)
  const semOrdem = itens.filter(i => (i.ordem ?? 0) === 0)

  if (semOrdem.length === 0) {
    // Todos têm ordem — só ordena por ordem
    return [...itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  }

  if (comOrdem.length === 0) {
    // Nenhum tem ordem — auto-sort canônico
    return [...itens].sort((a, b) => prioridadeCanonica(a) - prioridadeCanonica(b))
  }

  // Caso misto: com ordem primeiro, sem ordem DEPOIS (em ordem canônica entre si)
  const comOrdemSorted = [...comOrdem].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const semOrdemSorted = [...semOrdem].sort((a, b) => prioridadeCanonica(a) - prioridadeCanonica(b))
  return [...comOrdemSorted, ...semOrdemSorted]
}
```

Resultado: item novo adicionado a um slot com ordem manual vai para o FIM da lista (não para o topo), ordenado entre outros itens novos pela prioridade canônica.

### Fix 4: Botão "Reordenar semana"

- Removido botão ↕ do header de cada dia
- Adicionado botão "↕ Reordenar" no header da SEMANA (ao lado de "Diferenciar")
- Handler `handleReordenarSemana(semanaNumero)` chama `POST /reordenar-semana`
- Endpoint re-aplica `calcularOrdemCanonicaSlot` em TODOS os slots de TODOS os dias da semana

---

## 🛡️ Segurança e compatibilidade

| Aspecto | Status |
|---|---|
| Não toca em banco de dados (sem migration) | ✅ — categoria é campo String, aceita qualquer valor |
| Preparações existentes continuam funcionando | ✅ — categoria='PREPARACAO' continua sendo default válido |
| Ordenação antiga continua funcionando para quem não categorizou | ✅ — fallback para palavra-chave no nome |
| Hot-reload pega mudanças | ✅ |
| Botão "Reordenar semana" só re-ordena a semana atual (não afeta outras) | ✅ |
| Script de migração é idempotente (pode rodar de novo) | ✅ — só marca preparações com categoria='PREPARACAO' |
| Endpoint `/reordenar-dia` removido sem quebrar nada | ✅ — só era chamado pelo botão que foi removido |

---

## ❓ Troubleshooting

### O botão "Reordenar" não aparece no header da semana
Reinicie o `npm run dev`. A página do editor é grande (~2900 linhas), o hot-reload pode não pegar de imediato.

### A ordenação ainda não respeita a ordem
Verifique se:
1. Você marcou as frutas/acompanhamentos com o script `marcar-frutas-categoria.ts --apply`
2. Clicou no botão "Reordenar" no header da semana para re-aplicar a ordem canônica
3. Se ainda assim algum item estiver fora do lugar, abra `/nutricao/preparacoes`, edite a preparação e confirme a categoria

### Alguma fruta não foi detectada pelo script
O script usa palavras-chave (banana, maçã, mamão, laranja, etc.). Se uma fruta não foi detectada, marque manualmente:
1. Abra `/nutricao/preparacoes`
2. Procure a preparação
3. Edite → mude categoria para FRUTA
4. Salve

### O item novo ainda vai para o topo
Isso não deveria mais acontecer. Se acontecer, verifique se o `npm run dev` reiniciou. Se persistir, me avise com o cenário específico (quais itens, quais ordens).

### Erro 404 ao clicar em "Reordenar"
Você aplicou o patch mas o endpoint `/reordenar-dia` ainda está sendo chamado. Verifique se:
1. O patch foi aplicado corretamente (`ls src/app/api/nutricao/cardapios/[id]/reordenar-semana/route.ts` deve existir)
2. O `npm run dev` reiniciou
3. O navegador não está com cache (Ctrl+Shift+R)

---

## 📝 Notas técnicas

### Por que SALADA/ARROZ/FEIJAO/PROTEINA/CUSCUZ têm precedência sobre a categoria do banco?

Porque essas categorias têm **posição fixa** no cardápio:
- Salada sempre vem primeiro (mesmo se a nutricionista marcou como ACOMPANHAMENTO)
- Arroz sempre vem após salada
- Feijão sempre vem após arroz
- Proteína sempre vem após feijão
- Cuscuz sempre é o primeiro no perfil CUSCUZ

Se deixássemos a categoria do banco vencer, uma salada marcada como ACOMPANHAMENTO ia ficar após a proteína — visualmente errado.

Já FRUTA, BEBIDA, ACOMPANHAMENTO, PAO, LANCHE, SOBREMESA são categorias "flexíveis" — a posição delas depende do perfil do slot, então faz sentido a categoria do banco ser a referência primária.

### Por que o script de migração não marca proteínas?

Porque proteínas têm detecção por palavra-chave muito robusta (KW_PROTEINA tem ~50 palavras). Não há ganho em marcar como categoria, e poderia confundir (ex: "Arroz com frango" é proteína pela palavra-chave, mas se marcar como PROTEINA não muda nada). Melhor deixar a detecção por nome funcionar.

Arroz e feijão também têm detecção por palavra-chave simples. Marcar como categoria só faria sentido se houvesse ambiguidade — e não há.

### Performance

- Detecção de categoria: O(1) por item (lookup em array de ~10 palavras-chave)
- Detecção de perfil: O(n) por slot
- Sort: O(n log n) por slot
- Reordenar semana: ~5 dias × ~3 slots × ~5 itens = ~75 updates por semana
