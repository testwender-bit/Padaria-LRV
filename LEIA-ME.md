# v9.7 — Controle de Estoque + Receitas específicas por lanche

## O que mudou

1. **Renomeado "Insumos" → "Controle de Estoque"** no menu e no título do dashboard
2. **Receitas específicas por lanche** — cada lanche pode ter sua própria receita com ingredientes diferentes
3. **Cálculo de consumo inteligente** — usa receita específica do lanche quando disponível, fallback para genérica

## O problema do lanche

Antes, o sistema tratava "LANCHE" como um único produto com uma única receita genérica.
Mas existem **vários lanches diferentes** (lanche regular, lanche bifásica, etc.), cada um
com ingredientes próprios. O sistema multiplicava o total de lanches pela receita genérica,
ignorando que lanches diferentes usam insumos diferentes.

## A solução

### Novo campo `lanche_id` na Receita

```prisma
model Receita {
  produto_tipo         String  // PF, PCQ, LANCHE
  insumo_id            String
  quantidade_por_unidade Float
  lanche_id            String?  // NOVO: lanche específico (null = genérico)
  lanche Lanche? @relation(...)
  @@unique([produto_tipo, insumo_id, lanche_id])
}
```

- `lanche_id = null` → receita genérica de LANCHE (fallback para qualquer lanche sem receita própria)
- `lanche_id = "xxx"` → receita específica daquele lanche

### Página de Receitas atualizada

Ao cadastrar uma receita com `produto_tipo = "LANCHE"`, aparece um seletor:
- **"Genérico (todos os lanches — fallback)"** — para a receita padrão
- Lista de lanches ativos — para receitas específicas

As receitas são agrupadas por tipo + lanche, com badges indicando "Específica" ou "Fallback".
Cada receita tem botão de excluir (DELETE).

### Cálculo de consumo (calcularInsumosSemana)

Para cada insumo, o cálculo de lanche agora:

1. Olha quais lanches são servidos na semana (via `lanches_servidos`)
2. Para cada lanche servido, procura receita específica (`lanche_id = lanche.id`)
3. Se encontrou, multiplica: `quantidade_do_lanche × receita_específica`
4. Se não encontrou, usa a receita genérica de LANCHE como fallback

**Resultado**: se você tem lanche A (1000 unidades) e lanche B (500 unidades), e cadastrou
receitas específicas para ambos, o sistema calcula o consumo de cada um separadamente.

### `calcularTotaisSemana` atualizada

Agora retorna `lanches_servidos: [{ lanche_id, lanche_nome, quantidade }]` — quais lanches
foram servidos e em qual quantidade, para o cálculo usar.

## Schema completo

O `prisma/schema.prisma` no patch é o **schema completo e definitivo**, com TODOS os campos:
- `provider = "postgresql"` + `directUrl`
- `ordem_pcq` em Escola
- `pao_fixo` em Escola
- `escala_impressao` em CardapioNutricional
- `alergenos_bloqueados` + `alergenos_forcados` em Preparacao
- `lanche_id` em Receita (NOVO)
- `receitas` em Lanche (NOVO — relation)

## Arquivos incluídos

```
prisma/schema.prisma                              # schema completo + lanche_id em Receita + receitas em Lanche
src/lib/menu-config.ts                            # "Insumos" → "Controle de Estoque"
src/lib/custo-utils.ts                            # lanches_servidos + receita específica por lanche
src/app/api/receitas/route.ts                     # GET com lanche + POST com lanche_id + DELETE
src/app/(app)/custos/receitas/page.tsx            # seletor de lanche + agrupar por lanche + excluir
src/app/(app)/custos/page.tsx                     # título "Controle de Estoque"
```

## Como aplicar

```bash
git checkout -b fix/estoque-lanches

unzip -o estoque-lanches-v97.zip -d .

npx prisma generate
npx prisma db push

git add -A
git commit -m "feat(v9.7): Controle de Estoque + receitas específicas por lanche"
git push -u origin fix/estoque-lanches
```

## Verificação

### Renomeação

1. O menu lateral deve mostrar **"Controle de Estoque"** (antes "Insumos")
2. O título do dashboard deve ser **"Controle de Estoque"**

### Receitas específicas por lanche

1. Vá em **Controle de Estoque → Receitas**
2. Clique em **Nova Receita**
3. Selecione produto = "Lanche"
4. Deve aparecer um seletor **"Lanche Específico (opcional)"**
5. Selecione um lanche específico (ex.: "Lanche Regular")
6. Cadastre os insumos daquele lanche
7. Repita para outro lanche (ex.: "Lanche Bifásica") com insumos diferentes
8. As receitas aparecem agrupadas: "Lanche — Genérica (Fallback)" e "Lanche — Lanche Regular (Específica)"
9. Clique no ícone de lixeira para excluir uma receita

### Cálculo de consumo

1. Vá no **Dashboard do Controle de Estoque**
2. O sistema agora calcula o consumo de insumos considerando:
   - Receitas específicas de cada lanche (quando cadastradas)
   - Fallback para receita genérica (quando não há específica)
3. Os totais devem refletir os ingredientes corretos de cada lanche
