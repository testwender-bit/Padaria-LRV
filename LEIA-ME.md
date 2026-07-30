# Lista de Compras v2.0 — Reestruturação Completa

## Visão geral

Reescrevi completamente a página **Nutrição → Lista de Compras** para
atender aos dois fluxos solicitados:

### Modo 1: PREVISÃO DE REDE

> "para prever quanto e quais alimentos vou precisar para cobrir x tempo
> em toda a rede... o fluxo seria escolher quais escolas se é 1 2 3 ou 24
> e talvez escolher no calendário de que dia a que dia, então a lista de
> compra me dá quais alimentos e quantidade preciso para esse x tempo."

**Como usar:**
1. Selecione o modo **"Previsão de Rede"**.
2. Escolha o período (data início + data fim) via calendário.
3. Selecione as escolas (use os botões rápidos: Todas, por Motorista, por
   Categoria, ou marque individualmente).
4. Clique em **Gerar Lista de Previsão**.

O sistema busca todos os cardápios que têm semanas cujo período se
sobrepõe ao solicitado, agrega os ingredientes × alunos das escolas
selecionadas e retorna a lista consolidada.

### Modo 2: PEDIDO SEMANAL

> "para fazer os pedidos semanais das unidades uma vez que o cardápio já
> tem os itens seria fácil o sistema entregar quais itens são necessário
> para x escola para essa semana... aqui tem uma particularidade, apesar
> do cardápio tratar como semana o pedido semanal das escolas devem
> cobrir de terça de uma semana até segunda da outra semana. Com exceção
> das escolas do interior (rural) que os pedidos devem cobrir de quarta
> até terça da outra semana."

**Como usar:**
1. Selecione o modo **"Pedido Semanal"**.
2. Selecione UMA escola no dropdown.
3. Escolha uma data de referência (qualquer dia da semana desejada).
4. Clique em **Gerar Pedido Semanal**.

O sistema calcula automaticamente o período:
- **Escolas URBANAS** (REGULAR, INTEGRAL, BIFASICA, CRECHE): **Terça da
  semana atual → Segunda da semana seguinte** (7 dias).
- **Escolas do INTERIOR** (categoria=INTERIOR): **Quarta da semana atual
  → Terça da semana seguinte** (7 dias).

A página mostra um aviso amarelo/azul explicando qual regra foi aplicada
com base na categoria da escola selecionada.

## Normalização de nomes de ingredientes

Implementei um módulo `lista-compras-utils.ts` que:

1. **Define uma LISTA_CANONICA** com ~190 ingredientes na ordem EXATA
   que você forneceu, agrupados em 10 categorias:
   - HORTIFRUTI (legumes e verduras)
   - FRUTAS
   - POLPAS
   - LATICINIOS
   - CARNES_PROTEINAS
   - BEBIDAS_LACTEAS (inclui leite integral, pão de forma integral)
   - PADARIA
   - MERCEARIA_SECA
   - ESPECIARIAS (condimentos)
   - PADARIA_CONFEITARIA (atacado)

2. **Mapeia variações para nomes canônicos**: ~250 variações mapeadas.
   Por exemplo:
   - `"Mandioca descascada"`, `"Mandioca"`, `"Aipim"`, `"Macaxeira"` →
     `"Mandioca descascada"`
   - `"Cenoura ralada"`, `"Cenoura picada"`, `"Cenoura"` → `"Cenoura"`
   - `"Carne moída"`, `"Patinho moído"` → `"Carne bovina moída"`
   - `"Maisena"` → `"Amido de milho"`
   - `"PTS"` → `"Proteína de soja (kg)"`
   - `"Colorau"`, `"Colorífero"` → `"Condimento: Colorau (pct 500gr)"`
   - `"Açafrão"`, `"Cúrcuma"` → `"Condimento: Açafrão (30g)"`
   - etc.

3. **Algoritmo de normalização**:
   - Remove acentos e converte para lowercase
   - Remove qualificadores de preparo (cozido, cru, picado, ralado,
     descascado, fresco, seco, inteiro, maduro, em cubos, em isca, etc.)
   - Procura no mapa de variações
   - Se não encontrar, retorna o nome limpo (title case) — vai para a
     categoria "OUTROS" no final da lista

4. **Consolidação por nome canônico**: se dois alimentos do banco
   mapeiam para o mesmo nome canônico (ex: "Mandioca" e
   "Mandioca descascada"), as quantidades são SOMADAS e aparece como
   um único item na lista.

5. **Ordenação**: itens aparecem na ordem exata da LISTA_CANONICA.
   Itens não mapeados vão para o final (categoria "OUTROS") em ordem
   alfabética.

## Visualização

A lista é exibida **agrupada por categoria**, cada categoria em um card
separado com:
- Título da categoria + badge com nº de itens e total em kg
- Tabela com colunas: Item, Qtd (kg), Qtd (g), Unidade de Compra, e
  (no modo Previsão) número de escolas que usam o item
- Se o nome canônico for diferente do nome original do banco, mostra o
  original em itálico abaixo

**Filtros disponíveis:**
- Busca por texto (procura no nome canônico)
- Filtro por categoria específica

**Exportações:**
- **CSV** (com BOM UTF-8 — abre direto no Excel)
- **XLSX** com 3-4 abas: Itens Consolidados, Resumo por Categoria, Por
  Escola (somente Previsão), Escolas

**Salvar snapshot**: salva a lista atual no banco (tabela ListaCompras)
para consulta posterior.

## Arquivos incluídos

```
src/lib/lista-compras-utils.ts                              # NOVO: normalização + categorias + ordem
src/app/api/nutricao/lista-compras/route.ts                 # REESCRITO: suporte a modo=PREVISAO/PEDIDO + legado
src/app/(app)/nutricao/lista-compras/page.tsx               # REESCRITO: 2 modos (Previsão/Pedido)
```

## Como aplicar

```bash
# Na RAIZ do projeto:
unzip -o patch-lista-compras-v2.zip -d .

git add -A
git commit -m "feat: reestruturação completa da Lista de Compras (modo Previsão + modo Pedido semanal)"
git push
```

**Nenhuma migration necessária** — o schema Prisma não foi alterado.
Todos os campos usados já existem (CardapioSemanaNutri.data_inicio/
data_fim, Escola.categoria, etc.).

## Verificação

### Modo Previsão de Rede

1. Acesse **Nutrição → Lista de Compras**.
2. Selecione **"Previsão de Rede"**.
3. Escolha um período (ex.: 01/08/2026 a 31/08/2026 — um mês inteiro).
4. Clique em **"Todas"** para selecionar todas as escolas.
5. Clique em **Gerar Lista de Previsão**.
6. A lista deve aparecer:
   - KPIs no topo (modo, escolas, itens, total kg, período)
   - Resumo por categoria (cards com nº itens e kg)
   - Lista detalhada agrupada por categoria, na ORDEM que você definiu
   - Ingredientes com nomes consolidados (ex: "Mandioca descascada"
     mesmo se o banco tem "Mandioca", "Aipim", etc.)
7. Clique em **CSV** ou **XLSX** para exportar.

### Modo Pedido Semanal

1. Selecione **"Pedido Semanal"**.
2. Escolha uma escola urbana (ex.: "EMEF Érico Veríssimo" — categoria
   INTEGRAL).
3. Escolha uma data de referência (ex.: 20/08/2026 — quarta).
4. Aparecerá um aviso azul: "Escola REGULAR/URBANA — pedido cobre de
   TERÇA da semana atual até SEGUNDA da semana seguinte".
5. Clique em **Gerar Pedido Semanal**.
6. A lista deve aparecer com o período calculado automaticamente
   (Terça 18/08 a Segunda 24/08, no exemplo).

### Teste de escola do Interior

1. Selecione uma escola com categoria INTERIOR (ex.: EMEIF Fredolino
   Vieira Barros).
2. Escolha a mesma data (20/08/2026).
3. Aparecerá um aviso amarelo: "Escola do INTERIOR — pedido cobre de
   QUARTA da semana atual até TERÇA da semana seguinte".
4. O período será Quarta 19/08 a Terça 25/08.

## Notas técnicas

### Como o período do pedido é calculado

```ts
function calcularPeriodoPedido(categoria, refDate) {
  const isInterior = categoria.toUpperCase() === 'INTERIOR'
  if (isInterior) {
    // Quarta da semana atual → terça da semana seguinte (7 dias)
    const inicio = paraDiaSemana(refDate, 3)  // 3 = quarta
    const fim = addDays(inicio, 6)
  } else {
    // Terça da semana atual → segunda da semana seguinte (7 dias)
    const inicio = paraDiaSemana(refDate, 2)  // 2 = terça
    const fim = addDays(inicio, 6)
  }
}
```

`paraDiaSemana(d, alvo)` ajusta a data para o dia da semana alvo
(0=domingo, 1=segunda, ..., 6=sábado) na mesma semana.

### Como os cardápios são selecionados

Para cada escola-alvo (no modo Previsão) ou a escola selecionada (no
modo Pedido), o sistema busca o cardápio na seguinte ordem:

1. **Cardápio próprio da escola** (`CardapioNutricional.escola_id = escola.id`)
2. **Cardápio base da categoria** (`escola_id = null AND categoria_escola = escola.categoria`)
3. **Qualquer cardápio base** (`escola_id = null`)

Dentro do cardápio, busca as semanas cujo período
(`data_inicio` a `data_fim`) se sobrepõe ao período solicitado
(modo Previsão) ou ao período calculado do pedido (modo Pedido).

### Compatibilidade com a página antiga

A API mantém o **modo legado**: se `modo` for omitido, aceita os
parâmetros antigos (`cardapio_id`, `semanas`, `escolas_ids`) e retorna
o formato antigo (sem normalização). Isso garante que outras páginas
que possam estar usando a API antiga não quebrem.

### Ingredientes não mapeados

Se um ingrediente do banco não for reconhecido na LISTA_CANONICA, ele
aparece numa categoria **"Outros (não mapeados)"** no final da lista,
com o nome limpo (sem acentos). Para mapeá-lo, edite
`src/lib/lista-compras-utils.ts` e adicione uma entrada no
`MAPA_VARIACOES`:

```ts
'novo ingrediente': 'Nome Canônico',
```

E adicione o `Nome Canônico` na `LISTA_CANONICA` com a categoria e
unidade apropriadas.

## Limitações conhecidas

1. **Unidade de compra**: por padrão, todas as quantidades são
   convertidas para kg (gramas / 1000). Itens como "Manteiga (500g)"
   têm a unidade canônica `unid`, mas a conversão ainda usa kg como
   aproximação. Refinamentos podem ser feitos adicionando fatores de
   conversão específicos no futuro.

2. **Cardápios RASCUNHO**: o modo Pedido só considera cardápios com
   `status = 'APROVADO'`. Cardápios em rascunho são ignorados. O modo
   Previsão considera todos os cardápios (aprovados ou não) que tenham
   semanas no período.

3. **Snapshot depende de cardapio_id**: o modelo `ListaCompras` exige
   `cardapio_id` (não-nulo). No modo Previsão, pode haver múltiplos
   cardápios; o snapshot usa o primeiro da lista. Isso é uma limitação
   do schema atual — para suportar múltiplos cardápios por snapshot,
   seria necessário alterar o schema.
