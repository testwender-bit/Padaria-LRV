# Atualização v8 — Replicar Cardápio para Escolas

## Resumo

Esta versão **renomeia e reformula** o conceito que era chamado de "Ciclo PNAE" → **"Replicar Cardápio"**. O fluxo de trabalho agora segue exatamente como a nutricionista trabalha:

1. Cria um **Cardápio Base** (4 ou 5 semanas) por segmento (creche, regular, integral, etc.)
2. Marca as preparações de **pão** e **lanche** com categoria especial no cadastro
3. Vai no cardápio base → clica em **"Replicar p/ Escolas"**
4. Seleciona quais escolas receberão esse cardápio
5. Para cada escola, define o **dia de pão** e **dia de lanche** (SEG/TER/QUA/QUI/SEX)
6. O sistema replica o cardápio para cada escola, **trocando os dias** automaticamente (swap) conforme o configurado
7. A nutricionista entra em cada cardápio de escola e faz pequenos ajustes — usa o botão **"Diferenciar Semana"** para marcar semanas modificadas vs base
8. Pode usar a página **"Comparar c/ Base"** para ver um diff visual lado a lado

## Arquivos incluídos

### Novos
| Arquivo | Descrição |
|---------|-----------|
| `prisma/schema.prisma` | Schema atualizado com 3 novos campos (ver abaixo) |
| `scripts/migrate-v8.sql` | Migration SQLite (alternativa ao `prisma db push`) |
| `scripts/seed-v8-categorias.ts` | Heurística para marcar preparações existentes como PAO/LANCHE/BEBIDA/SOBREMESA |
| `src/lib/preparacao-categorias.ts` | Constantes e helpers para a nova classificação |
| `src/app/api/nutricao/cardapios/[id]/replicar/route.ts` | API POST para replicar cardápio base para múltiplas escolas com troca de dias |
| `src/app/api/nutricao/cardapios/[id]/diferenciar-semana/route.ts` | API POST para marcar semana como diferenciada |
| `src/app/(app)/nutricao/cardapios/[id]/replicar/page.tsx` | UI de replicação (substitui `/ciclo`) |
| `src/app/(app)/nutricao/cardapios/[id]/comparar/page.tsx` | UI de diff visual vs cardápio base |

### Modificados
| Arquivo | O que mudou |
|---------|-------------|
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Renomeado botão "Ciclo PNAE" → "Replicar p/ Escolas" (só para base); adicionado botão "Comparar c/ Base" (só para instâncias); badge "Modificada" na semana; botão "Diferenciar Semana"; marcação automática de diferenciada ao mover/remover itens |
| `src/app/(app)/nutricao/preparacoes/page.tsx` | Adicionado select "Categoria" no cadastro (PREPARACAO/PAO/LANCHE/BEBIDA/SOBREMESA); badge de categoria na lista |
| `src/app/api/nutricao/preparacoes/route.ts` | POST aceita campo `categoria` |
| `src/app/api/nutricao/preparacoes/[id]/route.ts` | PUT aceita campo `categoria` |

### Mantidos do v7 (já aplicados anteriormente)
- `src/app/(app)/nutricao/cardapios/[id]/page.tsx` (inclui melhorias v7: drag-and-drop, quick-add chips, porções inline, semáforo, mobile picker)
- `src/app/(app)/nutricao/lista-compras/page.tsx` (botão Excel 5 abas)
- `src/app/api/nutricao/cardapios/[id]/mover-item/route.ts`

## Mudanças no Schema Prisma

### `Preparacao` — novo campo `categoria`
```prisma
categoria  String  @default("PREPARACAO")
// PREPARACAO | PAO | LANCHE | BEBIDA | SOBREMESA
```

### `CardapioNutricional` — novos campos `dia_pao_frances` e `dia_lanche`
```prisma
dia_pao_frances  String?  // SEG | TER | QUA | QUI | SEX | null
dia_lanche       String?  // SEG | TER | QUA | QUI | SEX | null
```

### `CardapioSemanaNutri` — novo campo `diferenciada`
```prisma
diferenciada  Boolean  @default(false)
// true = semana foi manualmente ajustada vs base (badge "Modificada" no editor)
```

## Como aplicar

### Passo 1 — Extrair o ZIP na raiz do Codespace

```bash
cd /workspaces/Padaria-LRV
unzip -o atualizacao-v8-aplicada.zip
```

### Passo 2 — Aplicar migration do banco de dados

**Opção A (recomendada): usar Prisma**
```bash
npx prisma db push
npx prisma generate
```

**Opção B: usar SQL direto** (se Prisma reclamar de drift)
```bash
sqlite3 db/custom.db < scripts/migrate-v8.sql
npx prisma generate
```

### Passo 3 — Rodar seed de categorias (opcional, mas recomendado)

Marca automaticamente as preparações existentes com base no nome:

```bash
npx tsx scripts/seed-v8-categorias.ts
```

> Você pode revisar/ajustar manualmente depois no cadastro de preparações.

### Passo 4 — Instalar dependências

```bash
npm install
```

### Passo 5 — Build para validar

```bash
npm run build
```

### Passo 6 — Rodar em modo dev

```bash
npm run dev
```

## Como testar o novo fluxo

### 1. Marcar categorias nas preparações
- Vá em `/nutricao/preparacoes`
- Edite cada preparação de **pão** → categoria = `PAO`
- Edite cada preparação de **lanche** → categoria = `LANCHE`
- Edite bebidas → `BEBIDA`, sobremesas → `SOBREMESA`

### 2. Replicar um cardápio base
- Vá em um cardápio base (escola_id = null)
- Clique no botão roxo **"Replicar p/ Escolas"**
- Selecione as escolas
- Para cada escola, defina **dia de pão** e **dia de lanche** (se o base tem)
- Marque "Expandir para 22 semanas (semestre)" se quiser gerar o semestre completo
- Clique em **"Replicar para N escola(s)"**
- Veja o resultado: lista de cardápios criados + trocas aplicadas

### 3. Editar um cardápio de escola
- Abra um cardápio recém-criado
- Note o badge **"Modificada"** ao lado da semana (aparece quando você edita algo)
- Faça uma alteração (mover item, remover, alterar porções)
- O sistema marca a semana como diferenciada automaticamente
- Você também pode clicar em **"Diferenciar"** para marcar manualmente
- Para reverter: **"Restaurar"**

### 4. Comparar com o base
- Em qualquer cardápio de escola, clique em **"Comparar c/ Base"**
- Veja o diff visual: 5 cards por dia, com cores indicando:
  - 🟢 Igual
  - 🔵 Adicionado (só na escola)
  - 🔴 Removido (só no base)
  - 🟡 Porções alteradas
  - 🟣 Preparação trocada
- Use o seletor de semana no topo para ver outras semanas
- Pode trocar o base de comparação no canto superior direito

## Conceitos

### Cardápio Base × Cardápio de Escola

- **Base**: `escola_id = null`. Modelo genérico para um segmento (ex: "Cardápio Creche 2025/1"). Não está vinculado a uma escola específica.
- **Escola**: `escola_id ≠ null`. Instância de um base, com o dia de pão/lanche realocado conforme a capacidade da padaria.

### Replicação (substitui "Ciclo PNAE")

A replicação faz:
1. Clona as 4-5 semanas base para cada escola
2. Detecta onde caiu o pão/lanche no base (lendo a categoria das preparações)
3. Aplica **swap**: troca o conteúdo do dia do pão com o dia destino configurado
4. Se "expandir para semestre" = true, gera as semanas 6..22 como réplicas da semana correspondente do ciclo

### Diferenciar Semana

Após replicar, todas as semanas são "cópia fiel do base" (`diferenciada = false`). Quando o nutricionista:
- Move um item (drag-and-drop)
- Remove um item
- Limpa um slot

O sistema **marca a semana como diferenciada automaticamente**. Isso é só um marcador visual — não bloqueia edições. Serve para:
- Identificar rapidamente quais semanas foram ajustadas
- Auditar mudanças vs base
- Saber quais semanas podem ser "sincronizadas" de novo com o base no futuro

### Comparar com Base

Página de diff visual mostrando semana a semana o que mudou entre o cardápio da escola e o base. Pode comparar com qualquer base disponível (não só a original).

## Compatibilidade

- ✅ **SQLite + Prisma**: requer `prisma db push` para aplicar os 3 novos campos
- ✅ **Next.js 16.1.x + Turbopack**: compila sem erros
- ⚠️ **Não destrutivo**: o SQL/migration apenas ADICIONA colunas, não remove nada. Cardápios e preparações existentes continuam funcionando.
- ⚠️ **Rota `/ciclo` antiga**: ainda existe (não foi removida). Se quiser remover, delete `src/app/(app)/nutricao/cardapios/[id]/ciclo/` e `src/app/api/nutricao/cardapios/[id]/gerar-ciclo/`. Recomendo manter por enquanto como fallback.

## Rollback (se precisar reverter)

```bash
cd /workspaces/Padaria-LRV

# Restaurar arquivos modificados
git checkout -- prisma/schema.prisma
git checkout -- src/app/\(app\)/nutricao/cardapios/\[id\]/page.tsx
git checkout -- src/app/\(app\)/nutricao/preparacoes/page.tsx
git checkout -- src/app/api/nutricao/preparacoes/route.ts
git checkout -- src/app/api/nutricao/preparacoes/\[id\]/route.ts

# Remover novos arquivos
rm -rf src/app/\(app\)/nutricao/cardapios/\[id\]/replicar
rm -rf src/app/\(app\)/nutricao/cardapios/\[id\]/comparar
rm -rf src/app/api/nutricao/cardapios/\[id\]/replicar
rm -rf src/app/api/nutricao/cardapios/\[id\]/diferenciar-semana
rm -f src/lib/preparacao-categorias.ts
rm -f scripts/migrate-v8.sql scripts/seed-v8-categorias.ts

# Reaplicar Prisma (não vai remover as colunas, mas o schema volta ao estado anterior)
npx prisma db push
npx prisma generate
```

> As colunas `categoria`, `dia_pao_frances`, `dia_lanche` e `diferenciada` ficam no banco mas não são mais usadas. Não há problema em mantê-las.

## Próximos passos sugeridos

- **Sincronizar com base**: se o base mudar, criar um botão "Sincronizar" que re-aplica as mudanças do base mas preserva semanas marcadas como `diferenciada = true`.
- **Tela de visão geral**: um dashboard mostrando todas as escolas replicadas e quantas semanas estão diferenciadas em cada uma.
- **Histórico de replicações**: log de quando cada replicação foi feita, por quem, e quais trocas.
- **Suporte a mais categorias especiais**: bebidas com dia fixo, sobremesas só em dias específicos, etc.
