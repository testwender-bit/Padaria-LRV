# Patch v8.16 — 4 mudanças

## 1. Bug fix: Clonar creche → bifásica criava cardápio com categoria errada

**Problema:** Ao clonar um cardápio CRECHE para uma escola BIFASICA, o novo
cardápio era criado com `categoria_escola = 'CRECHE'` (herdada da origem).
Resultado: o editor não mostrava o slot LANCHE_PRE_ESCOLA (que só existe
em BIFASICA).

**Fix:** A API de clonar agora usa `escola.categoria` (categoria da escola
destino) em vez de `original.categoria_escola`.

Arquivo: `src/app/api/nutricao/cardapios/[id]/clonar/route.ts`

---

## 2. Replicar: opção para NÃO mexer no pão/lanche

**Novo:** Checkbox "Não mexer no pão/lanche (copiar direto)" na tela de
replicação. Quando marcado:
- O cardápio é copiado exatamente como está (sem realocar pão/lanche)
- Pula a validação que exigia dia de pão/lanche configurado
- Útil quando a origem já está no formato desejado

Arquivos:
- `src/app/(app)/nutricao/cardapios/[id]/replicar/page.tsx` (UI + flag)
- `src/app/api/nutricao/cardapios/[id]/replicar/route.ts` (API usa flag)

---

## 3. PDF: trocar header "Escola / Categoria / Fase" por texto da Secretaria

**Antes:**
```
Escola: EMEF X • Categoria: CRECHE • Fase: Creche (1 a 3 anos)
```

**Depois:**
```
SECRETARIA MUNICIPAL DE EDUCAÇÃO DE LUCAS DO RIO VERDE - MT
```

Texto em bold, uppercase, centralizado, preto forte (visível em P&B).

Arquivos:
- `src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx` (HTML)
- `src/app/print.css` (classes `.sp-meta-secretaria`)

---

## 4. Editor: ferramenta "Localizar e Substituir" preparação

**Novo botão "Substituir"** no header da semana (ao lado de "Reordenar").

**Como usar:**
1. Clique em "Substituir" → abre diálogo
2. Digite o nome da preparação a localizar (ex: "Suco")
3. Clique em "Buscar" → mostra todas as ocorrências no cardápio:
   - Agrupado por preparação
   - Lista semana/dia/refeição de cada ocorrência
   - Mostra total de ocorrências
4. Clique em "Substituir" na preparação desejada
5. Selecione a preparação substituta no dropdown
6. Clique em "Substituir TODAS (N)" → troca todas de uma vez

**Lógica inteligente:**
- Se a nova preparação já existe no slot (dia + tipo_refeicao): deleta a
  ocorrência atual (evita duplicata — respeita unique constraint)
- Se não existe: atualiza o `preparacao_id` do item
- Após substituir, recarrega o cardápio e re-busca automaticamente

Arquivos:
- `src/app/api/nutricao/cardapios/[id]/localizar-substituir/route.ts` (NOVO — API GET + POST)
- `src/app/(app)/nutricao/cardapios/[id]/page.tsx` (UI: botão + diálogo + handlers)

---

## Como aplicar

1. **Descompacte** o zip na raiz do projeto (preserva pastas):
   ```bash
   unzip patch-v816.zip -d .
   ```

2. Faça commit e push:
   ```bash
   git add -A
   git commit -m "feat(v8.16): clone categoria destino + replicar sem pão/lanche + PDF secretaria + localizar-substituir"
   git push
   ```

## Após aplicar — teste as 4 mudanças

### Teste 1: Clonar creche → bifásica
1. Abra um cardápio CRECHE
2. Clique em "Clonar" → selecione escola bifásica (Chico Mendes)
3. Abra o cardápio criado
4. ✅ Deve mostrar 5 slots incluindo LANCHE_PRE_ESCOLA

### Teste 2: Replicar sem mexer no pão/lanche
1. Abra um cardápio base
2. Clique em "Replicar p/ Escolas"
3. ✅ Marque "Não mexer no pão/lanche (copiar direto)"
4. ✅ Não vai pedir dia de pão/lanche — copia direto

### Teste 3: PDF com texto da Secretaria
1. Abra o PDF de qualquer cardápio
2. ✅ Header mostra "SECRETARIA MUNICIPAL DE EDUCAÇÃO DE LUCAS DO RIO VERDE - MT"
3. ✅ Não mostra mais Escola/Categoria/Fase

### Teste 4: Localizar e Substituir
1. Abra um cardápio no editor
2. Clique em "Substituir" (botão ao lado de "Reordenar")
3. Digite "Suco" → clique em "Buscar"
4. ✅ Mostra todas as ocorrências (ex: 22 semanas × 5 dias)
5. Clique em "Substituir" em uma preparação
6. Selecione a substituta → clique em "Substituir TODAS"
7. ✅ Todas as ocorrências são trocadas de uma vez

## Observações

- A ferramenta "Localizar e Substituir" é **irreversível** — use com cuidado
- Se a nova preparação já existir em algum slot, a ocorrência é removida
  (não cria duplicata — respeita a unique constraint do banco)
- A busca é case-insensitive e parcial (ex: "suco" encontra "Suco de maracujá")
- Mínimo 2 caracteres para buscar
