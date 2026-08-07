# Fix v9.6.8 — Melhorias completas no sistema de Insumos

## Resumo das melhorias implementadas

1. **Nova página "Gerenciar Insumos"** (CRUD completo)
2. **Nova API `/api/insumos/[id]`** com PUT e DELETE
3. **Botão "Ajustar ao Físico"** na Contagem (reconcilia estoque)
4. **API de contagem** agora atômica + suporta `reconciliar=true`
5. **Filtros em Movimentações** (por insumo, tipo, data início/fim)
6. **API de movimentações** aceita query params de filtro + limite
7. **Link "Gerenciar Insumos"** adicionado no dashboard de custos

## Detalhes de cada melhoria

### 1. Página "Gerenciar Insumos" (`/custos/insumos`)

Nova página completa para CRUD de insumos:

- **Listar** todos os insumos (ativos e inativos, com toggle "Mostrar inativos")
- **Buscar** por nome (busca em tempo real)
- **Criar** novo insumo (dialog com nome, unidade, preço, estoque, mínimo, fornecedor, ativo)
- **Editar** insumo existente (mesmos campos)
- **Desativar/Reativar** (botão Power — soft delete via `ativo: false`)
- **Excluir permanentemente** (com confirmação — remove físico, cascata deleta movimentações/contagens)
- **Indicador visual** de estoque baixo (⚠ quando `estoque_atual < estoque_minimo`)
- Insumos inativos aparecem com opacidade reduzida

### 2. API `/api/insumos/[id]` (PUT + DELETE)

- **PUT**: atualiza campos enviados (nome, unidade, preço, estoque, mínimo, fornecedor, ativo)
- **DELETE**: soft delete por padrão (marca `ativo: false`). Com `?force=true`, exclui permanentemente
- Preserva histórico de movimentações e contagens (soft delete recomendado)

### 3. GET `/api/insumos` atualizado

- Aceita query param `?inativos=true` para listar TODOS (incluindo inativos)
- Sem o param, lista apenas ativos (comportamento padrão preservado)
- Ordenação: ativos primeiro, depois por nome

### 4. Botão "Ajustar ao Físico" na Contagem

Na página de Contagem, agora há DOIS botões:

- **Salvar Contagem** (azul) — salva a contagem como snapshot (comportamento original)
- **Ajustar ao Físico** (amarelo) — salva a contagem E ajusta o estoque do sistema:
  - Para cada insumo com diferença, cria uma `MovimentacaoEstoque` (ENTRADA ou SAIDA)
  - Atualiza `Insumo.estoque_atual` para o valor da contagem física
  - Tudo em UMA transação atômica
  - Confirmação com `window.confirm()` explicando a ação

### 5. API de Contagem — atômica + reconciliação

O POST foi reescrito:

- **Antes**: criava com placeholders, depois loop N+1 para atualizar (NÃO atômico)
- **Depois**: transação `db.$transaction(async (tx) => ...)` com tudo dentro:
  1. Busca estoque de todos os insumos de uma vez (evita N+1)
  2. Cria contagens com snapshot correto
  3. Se `reconciliar=true`, cria movimentações de ajuste + atualiza estoque
- Aceita `reconciliar: boolean` no body

### 6. Filtros em Movimentações

A página de Movimentações agora tem uma barra de filtros:

- **Filtro por insumo** (dropdown com todos os insumos)
- **Filtro por tipo** (Todos / Entrada / Saída)
- **Filtro por data** (Data início → Data fim)
- Botão "Limpar" para resetar filtros
- Contador de registros no header
- Coluna "Obs" adicionada na tabela (com truncate + tooltip)
- Mensagem "Nenhum resultado" quando filtros não encontram nada
- Limite aumentado de 100 para 500 (com parâmetro `?limite=`)

### 7. API de Movimentações com filtros

GET `/api/movimentacoes` agora aceita query params:

- `?data_inicio=YYYY-MM-DD`
- `?data_fim=YYYY-MM-DD`
- `?insumo_id=xxx`
- `?tipo=ENTRADA|SAIDA`
- `?limite=N` (default 100, máx 500)

## Arquivos incluídos

```
src/app/api/insumos/route.ts                              # GET aceita ?inativos=true
src/app/api/insumos/[id]/route.ts                         # NOVO: PUT + DELETE
src/app/api/contagem/route.ts                             # POST atômico + reconciliar
src/app/api/movimentacoes/route.ts                        # GET com filtros
src/app/(app)/custos/insumos/page.tsx                     # NOVO: CRUD completo
src/app/(app)/custos/contagem/page.tsx                    # Botão "Ajustar ao Físico"
src/app/(app)/custos/movimentacoes/page.tsx               # Filtros + coluna Obs
src/app/(app)/custos/page.tsx                             # Link "Gerenciar Insumos"
```

## Como aplicar

```bash
git checkout -b fix/insumos-completo

unzip -o insumos-completo-v968.zip -d .

git add -A
git commit -m "feat(v9.6.8): melhorias completas no sistema de insumos"
git push -u origin fix/insumos-completo
```

**Sem migração de banco** — todos os campos usados já existem (Insumo, MovimentacaoEstoque, ContagemEstoque). Nenhum campo novo foi adicionado ao schema.

## Verificação

### Gerenciar Insumos

1. Vá em **Insumos** (menu lateral) → no dashboard, clique no novo tile **"Gerenciar Insumos"**
2. Deve aparecer a lista de todos os insumos (ativos e inativos)
3. Clique em **"Novo Insumo"** → preencha o formulário → Salve
4. Edite um insumo existente (ícone lápis)
5. Desative um insumo (ícone power) — ele fica com opacidade reduzida
6. Marque "Mostrar inativos" para ver/ocultar inativos
7. Busque por nome (digite no campo de busca)

### Contagem com Ajuste ao Físico

1. Vá em **Insumos → Contagem**
2. Preencha as quantidades físicas dos insumos
3. Clique em **"Ajustar ao Físico"** (botão amarelo)
4. Confirme a ação no dialog
5. O sistema deve mostrar: "Contagem salva! X itens registrados. Y ajuste(s) de estoque criado(s)."
6. Vá em **Movimentações** — deve ver as movimentações de ajuste criadas
7. Vá em **Gerenciar Insumos** — os estoques devem refletir a contagem física

### Filtros em Movimentações

1. Vá em **Insumos → Movimentações**
2. Use os filtros: insumo, tipo, data início, data fim
3. A lista deve atualizar automaticamente
4. Clique "Limpar" para voltar a ver tudo
