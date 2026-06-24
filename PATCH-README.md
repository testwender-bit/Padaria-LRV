# Patch v6.4 — Fix "Suco de maracujá não obedece ordem" + Botão "Trocar dia"

Corrige 2 problemas reportados:

1. **Bug "Suco de maracujá não obedece ordem"** — quando um slot tinha itens com ordem manual (Pão=1, Banana=2) e você adicionava Suco de maracujá (novo, sem ordem), ele ia para o FIM da lista — ignorando que Bebida deveria vir primeiro.
2. **Feature "Trocar dia"** — queria poder trocar TODAS as preparações de um dia com outro dia (sem precisar mover item por item).

---

## 📦 Arquivos deste patch

### Modificados (2 arquivos)

| Arquivo | O que mudou |
|---|---|
| `src/lib/ordenacao-preparacoes.ts` | Fix do "caso misto" na função `atribuirOrdemParaItensSemOrdem`: itens sem ordem agora são **inseridos na posição correta por prioridade** em vez de irem para o fim da lista |
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | (1) Novo state `diaTrocaOrigem` para o modo de troca. (2) Novo handler `handleTrocarDia`. (3) Botão "Trocar dia" (ícone `ArrowLeftRight`) no header de cada dia. (4) Card do dia fica clicável quando em modo de troca — origem fica destacada em dourado com badge "ORIGEM". (5) Import do ícone `ArrowLeftRight` do lucide-react |

### Novos (2 arquivos)

| Arquivo | Função |
|---|---|
| `src/app/api/nutricao/cardapios/[id]/trocar-dia/route.ts` | Endpoint POST que troca TODOS os itens entre dois dias da semana (snapshot + delete + create cruzado) |
| `scripts/test-caso-misto.ts` | 8 testes do fix do caso misto (incluindo o caso exato do Suco de maracujá) |

### Atualizados (1 arquivo)

| Arquivo | Mudança |
|---|---|
| `scripts/test-ordenacao-v6.ts` | Atualizado teste "Slot com 3 itens ordenados + 2 novos" para refletir a nova regra (itens novos inseridos por prioridade, não no fim) |

---

## 🚀 Como aplicar

### Passo 1 — Aplicar o patch

```bash
unzip -o patch-v6.4-trocar-dia-suco-maracuja.zip
```

### Passo 2 — Rodar os testes

```bash
# Teste do fix do caso misto (8 casos)
npx tsx scripts/test-caso-misto.ts

# Teste do caso da torta (5 casos, ainda passa)
npx tsx scripts/test-caso-torta.ts

# Teste v6 (18 casos, atualizado)
npx tsx scripts/test-ordenacao-v6.ts
```

### Passo 3 — Restart do dev server

```bash
npm run dev
```

### Passo 4 — Validar no navegador

**Validação 1 — Bug do Suco de maracujá:**

1. Abra um cardápio
2. Em um slot (lanche, por exemplo), reordene manualmente alguns itens (use os botões ↑/↓ para criar ordem manual: Pão=1, Banana=2)
3. Adicione "Suco de maracujá" ao slot
4. **Deve aparecer PRIMEIRO** (não no fim) ✅
   - Antes: Pão → Banana → Suco ❌
   - Agora: Suco → Pão → Banana ✅

**Validação 2 — Botão "Trocar dia":**

1. Abra um cardápio com vários dias preenchidos
2. No header de um dia (ex: quinta), clique no botão **⟷** (ícone ArrowLeftRight)
   - O header fica **dourado** com badge "ORIGEM"
   - Aparece toast: "Clique em outro dia para trocar com Quinta"
3. Clique em **outro dia** (ex: sexta) — em qualquer lugar do card dele
   - Os dois dias trocam de lugar: quinta fica com o conteúdo da sexta, e vice-versa
   - Aparece toast: "Dias trocados (N itens)"
4. **Para cancelar:** clique no botão ⟷ do dia origem de novo (ou clique no mesmo dia origem)

### Passo 5 — Commit e push

```bash
git add src/lib/ordenacao-preparacoes.ts \
        src/app/api/nutricao/cardapios/[id]/trocar-dia/route.ts \
        src/app/(app)/nutricao/cardapios/[id]/page.tsx \
        scripts/test-caso-misto.ts \
        scripts/test-ordenacao-v6.ts \
        PATCH-README.md

git commit -m "feat(cardapio): trocar dia inteiro + fix caso misto ordenacao (v6.4)

Bug 1 - Suco de maracujá não obedecia ordem:
- Causa: no 'caso misto' (itens com ordem manual + itens sem ordem),
  itens sem ordem iam para o FIM da lista ignorando prioridade canônica
- Fix: itens sem ordem agora são INSERIDOS na posição correta
  baseada na prioridade (BEBIDA entra antes de PAO com ordem manual)
- 8 testes do caso misto (todos passam)

Feature 2 - Botão 'Trocar dia':
- Novo endpoint POST /trocar-dia (snapshot + delete + create cruzado)
- Botão ArrowLeftRight no header de cada dia
- Modo de 2 cliques: clica origem (fica dourado com badge ORIGEM),
  depois clica destino → trocam todos os itens entre si
- Visual: cards ficam clicáveis em modo troca, com hover dourado
- Atualização otimista para resposta imediata na UI
- Cancela clicando no mesmo dia origem

Testes atualizados:
- test-ordenacao-v6: 1 teste ajustado para nova regra de inserção por prioridade
- 8 novos testes do caso misto (test-caso-misto.ts)
- Total: 78 testes, todos passam"

git push
```

---

## 🎯 Detalhes técnicos

### Fix 1: Bug do "caso misto"

**Antes (v6–v6.3):**
```typescript
// Caso misto: itens com ordem + itens sem ordem
const comOrdemSorted = [...comOrdem].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
const semOrdemSorted = [...semOrdem].sort(/* por prioridade */)
return [...comOrdemSorted, ...semOrdemSorted]  // ❌ sem ordem sempre no fim
```

**Agora (v6.4):**
```typescript
const resultado = [...comOrdemSorted]  // começa com os que têm ordem

for (const itemSemOrdem of semOrdemSorted) {
  const prioSemOrdem = getPrioridadePorPerfil(...)

  // Encontra PRIMEIRO item com-ordem cuja prioridade é MAIOR que a do sem-ordem
  let posicaoInsercao = resultado.length  // default: fim
  for (let i = 0; i < resultado.length; i++) {
    const prioItemComOrdem = getPrioridadePorPerfil(...)
    if (prioSemOrdem < prioItemComOrdem) {
      posicaoInsercao = i
      break
    }
  }

  resultado.splice(posicaoInsercao, 0, itemSemOrdem)  // insere na posição certa
}
return resultado
```

#### Exemplo visual

Slot com: Pão (ordem=1, prio 1), Banana (ordem=2, prio 6), Suco (sem ordem, prio 0)

| Versão | Resultado | Por quê |
|---|---|---|
| v6–v6.3 | Pão → Banana → Suco ❌ | Suco (sem ordem) ia pro fim |
| v6.4 | Suco → Pão → Banana ✅ | Suco (prio 0) entra ANTES do Pão (prio 1) |

#### Regra definitiva

- Item sem ordem com prioridade **MENOR** que algum item com ordem → entra **ANTES** desse item
- Item sem ordem com prioridade **IGUAL ou MAIOR** → entra **DEPOIS** dos itens com ordem

Isso garante que:
- Bebida/Suco (prio 0) sempre entram primeiro, mesmo sem ordem manual
- Salada (prio 0) sempre entra primeiro
- Fruta (prio 6) sempre entra por último
- Itens com mesma prioridade respeitam ordem manual primeiro

### Feature 2: Botão "Trocar dia"

**State:**
```typescript
const [diaTrocaOrigem, setDiaTrocaOrigem] = useState<string | null>(null)
// null = modo desativado
// 'quinta' = quinta é a origem, esperando clique no destino
```

**Fluxo:**
1. Usuário clica no botão ⟷ do dia quinta
   - `setDiaTrocaOrigem('quinta')`
   - Header fica dourado com badge "ORIGEM"
   - Toast: "Clique em outro dia para trocar com Quinta"
2. Usuário clica em qualquer lugar do card da sexta
   - `handleTrocarDia('sexta', currentSemana)` é chamado
   - Atualização otimista: troca os dias no state local
   - POST /trocar-dia com body `{ semana_numero, dia_a: 'quinta', dia_b: 'sexta' }`
   - Toast: "Dias trocados (N itens)"
   - Recarrega o cardápio do servidor para confirmar
3. Se clicar no mesmo dia origem → cancela modo

**Endpoint `/trocar-dia`:**
```typescript
// 1. Snapshot dos itens de ambos os dias
const itensA = await tx.cardapioItem.findMany({ where: { dia_id: diaAData.id } })
const itensB = await tx.cardapioItem.findMany({ where: { dia_id: diaBData.id } })

// 2. Apaga todos os itens de ambos os dias
await tx.cardapioItem.deleteMany({ where: { dia_id: diaAData.id } })
await tx.cardapioItem.deleteMany({ where: { dia_id: diaBData.id } })

// 3. Recria itens de A no dia B (preservando ordem, porções, etc)
for (const item of itensA) {
  await tx.cardapioItem.create({ data: { dia_id: diaBData.id, ... } })
}

// 4. Recria itens de B no dia A
for (const item of itensB) {
  await tx.cardapioItem.create({ data: { dia_id: diaAData.id, ... } })
}
```

Por que snapshot + delete + create (em vez de update direto)?
Porque `CardapioItem` tem constraint unique `(dia_id, tipo_refeicao_id, preparacao_id)`. Se tentar atualizar `dia_id` diretamente, pode violar a constraint se ambos os dias têm a mesma preparação na mesma refeição.

---

## 🛡️ Segurança e compatibilidade

| Aspecto | Status |
|---|---|
| Não toca em banco (sem migration) | ✅ |
| Não quebra slots só com ordem manual | ✅ — continua respeitando |
| Não quebra slots só sem ordem | ✅ — continua auto-sort |
| Não quebra drag-and-drop de item individual | ✅ — ainda funciona |
| Botão "Trocar dia" só ativo quando explicitamente clicado | ✅ |
| Modo troca pode ser cancelado | ✅ — clique no mesmo dia origem |
| Atualização otimista para UI responsiva | ✅ |
| Transação atômica (rollback em erro) | ✅ |
| Hot-reload pega mudanças | ✅ |

---

## ❓ Troubleshooting

### Suco de maracujá ainda não obedece ordem
Pode ser que tem ordem manual > 0 nele. Verifique:
1. Abra o slot
2. Clique no botão "Reordenar" no header da semana (reseta ordem manual)
3. Adicione Suco de maracujá novamente
4. Deve aparecer primeiro

Se ainda não funcionar, me avise com:
- Lista de itens do slot
- Categoria de cada um (no banco)
- Ordem manual de cada um (se tiver)

### Botão "Trocar dia" não aparece
Reinicie o `npm run dev`. A página do editor é grande, hot-reload pode demorar.

### Cliquei num dia mas não trocou
Verifique se:
1. Você clicou no botão ⟷ primeiro (header deve estar dourado com badge "ORIGEM")
2. Depois clicou em outro dia diferente (não o mesmo)
3. O outro dia não estava vazio (se ambos vazios, nada acontece, mas sem erro)

### Erro ao trocar dias
Pode ser problema de permissão no Supabase. Veja o toast de erro. Se for `Transaction not found` (P2028), me avise que aumento o timeout.

---

## 📝 Notas técnicas

### Por que botão em vez de arrastar o dia inteiro?

1. **Mais confiável** — drag-and-drop de containers inteiros é frágil (browser confunde com scroll, especialmente em mobile)
2. **Mais óbvio** — usuário vê claramente que está trocando dia, sem ambiguidade
3. **Funciona em mobile** — drag de elementos grandes é difícil no touch
4. **Mesma lógica do backend** — reusa o padrão snapshot+delete+create já testado

### Por que prioridade canônica vence ordem manual?

Porque a regra PNAE é fixa: bebida antes de pão, fruta sempre por último. Se o usuário reordenou Pão=1 e Banana=2 manualmente, mas adiciona Suco depois, o Suco **deve** aparecer antes do Pão (é a regra canônica). O usuário pode sempre reordenar manualmente de novo se quiser uma ordem diferente.

Se o usuário quiser FORÇAR uma ordem não-canônica (ex: Suco depois do Pão), basta usar os botões ↑/↓ para dar ordem manual a TODOS os itens do slot — aí a ordem manual vence.

### Performance

- Fix do caso misto: O(n²) por slot no pior caso (n = nº de itens, normalmente 3-8)
- Botão Trocar dia: ~2N queries (snapshot + delete + create), onde N = nº de itens por dia
- Para 5 dias × 3 refeições × 5 itens = 75 itens por semana, roda em <1s
