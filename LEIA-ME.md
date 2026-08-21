# Patch v9.8 — Excluir Lanches + Modo Lanche Bifásica (Pão ou Lanche)

## ⚠️ Antes de aplicar — ATENÇÃO

Este patch **adiciona um campo no banco de dados** (`lanche_bifasica_modo` em `CardapioSemestral`). Você PRECISA rodar `prisma db push` depois de extrair para sincronizar o banco Supabase com o schema novo.

## 📋 O que mudou (3 alterações)

### 1. 🗑️ Botão Excluir Lanche (página /lanches)

**Antes**: só dava para editar ou clonar lanches. Lanches errados ficavam para sempre (ou tinham que ser desativados via edição).

**Agora**:
- Cada card de lanche tem um botão vermelho 🗑️ (Trash2)
- **Clique normal** = soft delete (desativa, preserva histórico de produção)
- **Shift+clique** = hard delete (exclui definitivamente — só permite se o lanche NÃO estiver em uso em nenhum cardápio semestral)
- Checkbox "Mostrar inativos" no topo da página — quando ligado, mostra lanches inativos também (para reativar via Editar → marcar "Ativo")
- Bugfix SD-1: API agora retorna apenas lanches ativos por padrão (antes retornava tudo)

### 2. 🍞 Modo Lanche Bifásica (NOVO!)

**Problema relatado**: a bifásica estava recebendo 2 lanches na produção (o lanche das outras escolas + um "pão com manteiga" cadastrado errado como lanche). A distribuição ficava bagunçada.

**Realidade da bifásica** (confirmada com você):
- Bifásica **sempre recebe pão francês para o café da manhã** (controlado pelo `tipo_pao` do cardápio da semana — PADRAO, PROTEINA ou SEMPAO)
- Bifásica **pode ter lanche da tarde** que varia por semana: às vezes é o mesmo lanche das outras escolas (ex: bolacha), às vezes é pão (padrão ou proteína)

**Solução**: novo campo `lanche_bifasica_modo` no cardápio semestral com 3 valores:

| Valor | Significado | Resultado na produção |
|---|---|---|
| `LANCHE` (padrão) | Mesmo lanche das outras escolas | Bifásica recebe a quantidade de `LancheDistribuicao` do `lanche_regular_id` |
| `PAO_PADRAO` | Pão francês padrão como lanche | Bifásica recebe a quantidade do `PfQuantidade` do tipo PADRAO |
| `PAO_PROTEINA` | Pão francês proteína como lanche | Bifásica recebe a quantidade do `PfQuantidade` do tipo PROTEINA |

**Na UI**:
- Página `/cardapio` (Cardápio Semestral): o seletor antigo "Lanche Bifásica" foi substituído por "Modo Lanche Bifásica" com as 3 opções acima.
- O badge no resumo da semana agora mostra "B: Mesmo lanche das outras escolas" ou "B: Pão Francês Padrão" ou "B: Pão Francês Proteína" (com cor diferente para pão vs lanche).
- Na produção, itens de lanche que são pão (bifásica em modo PAO_*) aparecem com `obs: "Pão Padrão"` ou `obs: "Pão Proteína"` para fácil identificação.

### 3. 🐛 Bugfix: distribuição duplicada de lanche para bifásica

**Antes**: a API `/api/producao` buscava `LancheDistribuicao` de AMBOS os lanches (`lanche_regular_id` e `lanche_bifasica_id`), e escolas BIFASICA recebiam 2 lanches na produção (o regular + o bifásica).

**Agora**: a API busca apenas a distribuição do `lanche_regular_id`. A bifásica segue a mesma lógica das outras escolas quando em modo LANCHE (1 lanche por escola/dia). Em modos PAO_*, usa `PfQuantidade` (não `LancheDistribuicao`).

## 📦 Arquivos incluídos no patch

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | + campo `lanche_bifasica_modo String @default("LANCHE")` em CardapioSemestral |
| `src/lib/unit-options.ts` | + constante `LANCHE_BIFASICA_MODOS` (3 opções) |
| `src/app/api/lanches/route.ts` | + método DELETE (soft/hard) + GET agora filtra ativos por padrão (bugfix SD-1) |
| `src/app/api/cardapio/route.ts` | POST + PATCH aceitam `lanche_bifasica_modo` com validação |
| `src/app/api/producao/route.ts` | lógica nova do lanche bifásica + retorna `lancheBifasicaModo` |
| `src/app/(app)/lanches/page.tsx` | botão Excluir + checkbox "Mostrar inativos" + ajuste de fetch |
| `src/app/(app)/cardapio/page.tsx` | seletor "Lanche Bifásica" substituído por "Modo Lanche Bifásica" |
| `scripts/migrar-lanche-bifasica-modo.ts` | script para popular `lanche_bifasica_modo='LANCHE'` em semanas existentes |

**7 arquivos modificados + 1 novo (script de migração). Mudança no schema do banco: SIM.**

## 🚀 Como aplicar

### Passo 1: Backup (recomendado)

```bash
git stash
git checkout -b fix/v9.8-lanches-bifasica
```

### Passo 2: Extrair o patch

```bash
unzip -o patch-v9.8-lanches-bifasica.zip
```

### Passo 3: Verificar arquivos modificados

```bash
git status
# Deve mostrar 7 modified + 1 untracked (script de migração)
```

### Passo 4: Sincronizar banco Supabase com novo schema

```bash
# Gera o client Prisma com o novo campo
npx prisma generate

# Sincroniza o banco (adiciona a coluna lanche_bifasica_modo com default 'LANCHE')
npx prisma db push
```

⚠️ **Atenção**: `prisma db push` é seguro para adicionar coluna com default — não vai apagar dados. Mas sempre bom ter backup.

### Passo 5: Rodar script de migração (recomendado)

```bash
npx tsx scripts/migrar-lanche-bifasica-modo.ts
```

Esse script vai garantir que todas as semanas existentes do cardápio semestral tenham `lanche_bifasica_modo = 'LANCHE'` (mesmo lanche das outras escolas). Idempotente — pode rodar quantas vezes quiser.

### Passo 6: Build + testar

```bash
npm run build
npm run dev
```

## 🧪 Como testar (smoke test)

### Teste 1 — Botão excluir lanche
1. Vá em **Lanches**
2. Cada card deve ter um botão vermelho 🗑️
3. Clique em um lanche → aparece confirmação "Desativar?"
4. Confirme → toast "Lanche desativado" → lanche some da lista
5. Marque checkbox "Mostrar inativos" → lanche aparece com badge "Inativo"
6. Clique em Editar → marque "Ativo" → Salvar → lanche volta para a lista normal
7. Shift+clique no botão excluir → aparece confirmação "Excluir DEFINITIVAMENTE?" (só permite se não estiver em uso em cardápio)

### Teste 2 — Modo Lanche Bifásica
1. Vá em **Cardápio** (Cardápio Semestral)
2. Clique em editar (✏️) alguma semana
3. O seletor "Lanche Bifásica" foi substituído por **"Modo Lanche Bifásica"**
4. Teste as 3 opções: "Mesmo lanche das outras escolas", "Pão Francês Padrão", "Pão Francês Proteína"
5. Salve → o badge no resumo deve mostrar a opção escolhida (com cor diferente para pão)
6. Vá em **Produção** → tabela Lanche → escolas BIFASICA devem aparecer com:
   - Quantidade correta conforme o modo escolhido
   - Se modo = PAO_*, a quantidade vem do PfQuantidade (PADRAO ou PROTEINA)
   - Se modo = LANCHE, a quantidade vem do LancheDistribuicao do lanche_regular

### Teste 3 — Verificar que não há mais duplicação
1. Vá em **Produção** → view Semanal → tabela Lanche
2. Escolas BIFASICA devem ter APENAS 1 linha por dia (não 2 como antes)
3. A quantidade da bifásica deve ser a mesma das outras escolas (se modo LANCHE) OU a do PfQuantidade correspondente (se modo PAO_*)

## 🔄 Como reverter

Se algo quebrar:

```bash
# Reverter código
git checkout -- src/ prisma/ scripts/

# Reverter banco (REMOVER coluna — só faça se tiver certeza)
# psql $DATABASE_URL -c "ALTER TABLE \"CardapioSemestral\" DROP COLUMN \"lanche_bifasica_modo\";"
```

## 📝 Notas técnicas

- **Compatibilidade**: o campo `lanche_bifasica_id` foi MANTIDO no schema (não removido) para não quebrar referências FK existentes. Ele só não é mais usado pela nova lógica de produção.
- **Idempotente**: rodar o script de migração várias vezes não tem efeito colateral.
- **Soft delete por padrão**: preserva histórico de produção (escolas com ajustes antigos continuam funcionando).
- **Hard delete segura**: recusa excluir lanche que está em uso em cardápio (retorna 409 com mensagem explicativa).

## 🎯 Próximos passos sugeridos

Após aplicar e testar:
1. Audite os lanches existentes — desative/exclua os que estavam errados (ex: "Pão com Manteiga" que deveria ser PfQuantidade)
2. Para cada semana do cardápio atual, escolha o modo bifásica correto (provavelmente LANCHE para a maioria das semanas)
3. Se a bifásica tem PfQuantidade de PROTEINA cadastrada, pode usar modo PAO_PROTEINA nas semanas que quiser pão de proteína como lanche
