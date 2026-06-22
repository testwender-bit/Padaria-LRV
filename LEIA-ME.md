# Patch v8.7 — Horários Customizados + Média Corrigida + Ordem Cronológica

## O que mudou (4 features)

### 1. ✅ Média de nutrientes divide por dias COM preparação
**Problema**: Se segunda era feriado (sem itens), a média era dividida por 5 (todos os dias), dando valor artificialmente baixo.

**Correção**:
- `calcularResumoSemana` em `nutricao-utils.ts` agora filtra dias onde energia/proteínas/carbo são zero
- No PDF, `calcularResumoSemanaPDF` também pula dias onde `diaNutri.energia_kcal === 0 && diaNutri.proteinas_g === 0`
- Aplicado em **editor** e **PDF**

### 2. ✅ Horário editável da refeição (por cardápio)
**Problema**: Horário vinha fixo da tabela global `TipoRefeicao.horario`. Não dava para customizar por cardápio.

**Solução**:
- Novo modelo `CardapioHorarioRefeicao` no schema — relação `cardapio_id` + `tipo_refeicao_id` + `horario` (string livre) + `multiplicador` (auto-calculado)
- Nova API CRUD: `/api/nutricao/cardapios/[id]/horarios` (GET, POST, DELETE)
- API do cardápio (`/api/nutricao/cardapios/[id]`) agora inclui `horarios_refeicoes` no `findUnique`
- No editor: badge do horário virou **clicável** (cor cinza = default, cor dourada = customizado)
- Dialog com input + sugestões rápidas ("09h00 / 15h00", "07h30min", "11h00min", etc)
- Botão "Restaurar padrão" remove o override

### 3. ✅ Lanche em 2 horários (sem duplicar preparação)
**Problema**: Regular tem lanche servido às 09h00 E 15h00 — mas cadastrar a preparação 2x era confuso.

**Solução**:
- Basta editar o horário da refeição para `"09h00 / 15h00"`
- A preparação aparece **uma vez só** no cardápio (não duplicada)
- O badge mostra `"09h00 / 15h00"` — já discrimina os dois horários
- No PDF, mesma coisa: aparece uma linha "Lanche — 09h00 / 15h00"

### 4. ✅ Ordenação cronológica (não por campo `ordem`)
**Problema**: Interior tinha Almoço (ordem=3, 10h00) antes do Lanche (ordem=4, 15h00). Mas você quer Lanche primeiro (09h00) depois Almoço (11h00).

**Solução**:
- Nova função `parseHorarioToMinutes(horario)` em `horario-utils.ts` converte strings como `"09h00"`, `"09h00min"`, `"09:00"`, `"09h00 / 15h00"` (pega o primeiro horário) em minutos desde meia-noite
- Editor: `refeicoesForCategoria` agora usa `ordenarPorHorario()` em vez de `sort((a,b) => a.ordem - b.ordem)`
- PDF: `tiposRefeicao` agora ordena por horário efetivo (override ou default)
- Resultado: Lanche (09h00) aparece antes do Almoço (11h00), etc

## Arquivos incluídos (7 arquivos)

| Arquivo | Ação | Tamanho |
|---|---|---|
| `prisma/schema.prisma` | MODIFICADO — adiciona `CardapioHorarioRefeicao` + back-relations | 28 KB |
| `src/lib/horario-utils.ts` | **NOVO** — helpers de parse/ordenação de horário | 4 KB |
| `src/lib/nutricao-utils.ts` | MODIFICADO — `calcularResumoSemana` filtra dias vazios | 18 KB |
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | MODIFICADO — editor com dialog de horário + ordenação | 110 KB |
| `src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx` | MODIFICADO — PDF com horário efetivo + média corrigida + ordem cronológica | 18 KB |
| `src/app/api/nutricao/cardapios/[id]/route.ts` | MODIFICADO — inclui `horarios_refeicoes` no findUnique | 7 KB |
| `src/app/api/nutricao/cardapios/[id]/horarios/route.ts` | **NOVO** — API CRUD para horários customizados | 6 KB |

## Como aplicar

### 1. Aplicar o patch
```bash
unzip -o patch-v87-horarios-media.zip
```

### 2. Atualizar banco de dados (cria nova tabela `CardapioHorarioRefeicao`)
```bash
npm run db:generate   # regenera Prisma Client
npm run db:push       # cria a tabela nova no Supabase (não afeta dados existentes)
```

⚠️ Importante: este `db push` **NÃO apaga dados** — apenas cria a tabela nova vazia. Seus 15.756 registros continuam intactos.

### 3. Reiniciar e testar
```bash
npm run dev
```

## Testar

### Média corrigida (feriados)
1. Abra um cardápio que tenha feriado em algum dia da semana
2. Vá para essa semana
3. Compare a energia média (kcal) — deve ser mais alta que antes (porque agora divide por 4 e não por 5)

### Horário customizado
1. Abra um cardápio (ex: Regular)
2. Veja o badge do horário ao lado do nome da refeição (ex: `15h00min` em cinza)
3. **Clique no badge** → abre dialog
4. Edite para `09h00 / 15h00` → clique "Salvar Horário"
5. O badge fica **dourado** (indicando que é customizado) e mostra `09h00 / 15h00`
6. Clique novamente → "Restaurar padrão" volta para o default

### Ordem cronológica (Interior)
1. Abra um cardápio Interior
2. Vá para uma semana com itens
3. A ordem deve ser: Lanche (09h00) → Almoço (11h00) — se você ajustar os horários

### PDF
1. Gere o PDF de um cardápio
2. Verifique: as refeições aparecem na ordem cronológica (não mais por campo `ordem`)
3. O horário mostrado é o customizado (se existir)
4. A média de energia divide corretamente pelos dias com preparação

## Validação técnica
- ✅ `tsc --noEmit` — sem erros
- ✅ `eslint` — sem warnings
- ✅ `next build` — build completo (50+ rotas)
- ✅ Schema Prisma validado com `prisma validate`

## Notas sobre o modelo de dados

A nova tabela `CardapioHorarioRefeicao`:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | String (cuid) | PK |
| `cardapio_id` | String (FK) | CardápioNutricional.id |
| `tipo_refeicao_id` | String (FK) | TipoRefeicao.id |
| `horario` | String | Ex: `"09h00 / 15h00"` ou `"11h00min"` |
| `multiplicador` | Int | Auto-calculado: 2 se horário tem `/` |

Constraint única: `@@unique([cardapio_id, tipo_refeicao_id])` — um override por refeição por cardápio.

**Importante**: Não há migração de dados necessária. A tabela começa vazia. Quando não existe override para uma refeição, o sistema usa o `TipoRefeicao.horario` default (já preenchido no banco).
