# Fix v9.6 — Lista de Compras: 3 bugs corrigidos

## Bug 1: Semana errada sendo puxada (mexerica de 21/08 no período 11-17/08)

### Problema

> "ele detectou mexerica mas no cardapio mexerica está no dia 21/08 sendo
> que está selecionado Período 11/08/2026 → 17/08/2026"

### Causa

A API filtrava ao nível de **SEMANA** (data_inicio/data_fim da semana),
não de **DIA**. Quando o período do pedido é Ter 11/08 → Seg 17/08:

- Semana 1: data_inicio 10/08 (Seg) → data_fim 14/08 (Sex) → incluída
  (correto: Ter 11, Qua 12, Qui 13, Sex 14)
- Semana 2: data_inicio 17/08 (Seg) → data_fim 21/08 (Sex) → **também
  incluída** porque 17/08 ≤ 17/08 e 21/08 ≥ 11/08 (sobreposição)

Mas a semana 2 cobre Seg 17/08 → Sex 21/08, e o pedido só vai até Seg
17/08. Então itens de Ter 18/08 → Sex 21/08 (como mexerica de 21/08)
eram **erroneamente incluídos**.

### Fix

Adicionada função `dataRealDoDia(dataInicioSemana, diaSemana)` que
calcula a data real (YYYY-MM-DD) de cada dia baseado no `data_inicio`
da semana (sempre segunda-feira) + offset do dia (segunda=0, terca=1,
etc.).

Agora, para cada dia de cada semana, a API:
1. Calcula a data real do dia
2. Verifica se está dentro de `[dataInicioPedido, dataFimPedido]`
3. **SÓ processa o dia se a data real estiver dentro do período**

Resultado: mexerica de 21/08 (Sex da semana 2) não é mais incluída,
porque 21/08 > 17/08 (fim do pedido).

Aplicado em **ambos os modos** (PREVISAO e PEDIDO).

## Bug 2: Algumas escolas não puxam cardápio

### Problema

> "algumas escolas não estão puxando cardapio"

### Causa

A busca de cardápio tinha dois problemas:
1. Filtrava por `status: 'APROVADO'` — se o cardápio estava em
   `RASCUNHO`, era ignorado mesmo tendo semanas válidas.
2. `findFirst` retornava o primeiro cardápio que matche o `where` (ex:
   `escola_id = X`), mas o `include.semanas.where` filtrava as semanas
   DENTRO do cardápio. Se o cardápio existia mas não tinha semanas no
   período, retornava com `semanas: []` — e o código tratava como
   "não encontrou".

### Fix

- **Removido o filtro `status: 'APROVADO'`** — agora busca qualquer
  cardápio (aprovado ou rascunho).
- **Lógica de fallback melhorada**: se o primeiro `findFirst` retorna
  um cardápio mas com `semanas.length === 0`, tenta o próximo fallback
  (base da categoria → qualquer base) em vez de parar.
- **Ordenação por `atualizado_em: 'desc'`** — pega o cardápio mais
  recentemente atualizado.
- **Aviso na resposta**: se nenhum cardápio com semanas no período for
  encontrado, a API retorna um campo `aviso` com mensagem explicativa.
  A UI exibe esse aviso em um card amarelo.

## Bug 3: 41 ingredientes em "Outros" (normalizador não reconhecia TACO)

### Problema

> 41 itens na categoria "Outros" com nomes como:
> - "Abobrinha, Verde"
> - "Acucar, Cristal"
> - "Alface, Crespa, Crua"
> - "Arroz, Tipo 1, Cru"
> - "Banana, Nanica, Crua"
> - "Carne, Bovina, Acem, Moido, Cozido"

### Causa

O normalizador anterior (`semQualificadores`):
1. **Não removia vírgulas** — "Abobrinha, Verde, Crua" continuava com
   vírgulas → não batia com a chave do mapa "abobrinha verde".
2. **Não removia descritores de variedade TACO** — "Verde", "Crespa",
   "Tipo 1", "Fuji", "Pera", "Acem", "Cristal", "Branca" etc. não
   estavam na lista de qualificadores.
3. **Não fazia match por substring** — se o nome limpo não batia
   exatamente com uma chave do mapa, ia direto para "OUTROS".

### Fix

Reescrito completamente o normalizador:

#### Nova função `limparNomeTaco(s)`:
1. **Substitui vírgulas por espaços** — "Abobrinha, Verde, Crua" →
   "abobrinha  verde  crua"
2. **Remove parênteses e conteúdo** — "Extrato de tomate (1,7kg)" →
   "extrato de tomate"
3. **Remove ~60 descritores** (preparo + variedade TACO):
   - Preparo: cozido, cru, picado, ralado, descascado, fresco, seco,
     inteiro, maduro, em cubos, em isca, em tiras, em rodelas
   - Variedade: verde, crespa, fuji, pera, gala, tipo 1, branca,
     cristal, acem, moido, sem osso, com osso, bovina, suina, de vaca,
     de galinha, sem gordura, com sal, natural, organico
4. **Colapsa espaços múltiplos** → "abobrinha verde"

#### Novo algoritmo `normalizarNomeIngrediente(nome)`:
1. Remove acentos → lowercase
2. Limpa profundamente (vírgulas, parênteses, descritores)
3. **Match exato** no MAPA_VARIACOES
4. **Match por SUBSTRING** (NOVO): para cada chave do mapa (ordenada
   por length decrescente — mais específica primeiro), verifica se o
   nome limpo CONTÉM a chave. Ex: "carne bovina acem moido" contém
   "carne bovina" → match.
5. Se não encontrar, retorna nome limpo em title case → vai para OUTROS

#### Novas entradas no MAPA_VARIACOES:
- `farinha de trigo` → `Farinha Pura (25kg)` (TACO: "Farinha, de Trigo")
- `margarina` → `Margarina balde (15kg)` (genérico)
- `coco` → `Coco ralado (Kg)` (TACO: "Coco, Cru")
- `vinagre tinto` → `Vinagre branco (750ml)` (alias)
- `extrato de tomate 1,7kg` → corrigido (typo anterior tinha `)`)
- `flocos de milho` → `Flocão de milho (pacote 500gr)` (TACO: "Flocos de Milho (cuscuz)")
- `macarrao trigo` → `Macarrão espaguete (500g)` (TACO: "Macarrão, Trigo, Cru")
- `carne bovina acem` → `Carne bovina de 2ª em cubo`
- `ovo de galinha` → `Ovos de galinha (dz)` (TACO: "Ovo, de Galinha, Cru")
- `agua` → `Água` (não está na lista canônica, vai para OUTROS — mas
  com nome limpo em vez de "Agua, " com vírgula)

### Resultado esperado

Com essas mudanças, a maioria dos 41 itens de "Outros" deve ser
reconhecida e movida para suas categorias corretas. Apenas ingredientes
verdadeiramente novos (que não têm correspondente na lista canônica)
continuarão em "Outros".

## Arquivos incluídos

```
src/lib/lista-compras-utils.ts                              # normalizador reescrito + novas entradas
src/app/api/nutricao/lista-compras/route.ts                 # filtro ao nível de DIA + fallback melhorado
src/app/(app)/nutricao/lista-compras/page.tsx               # exibe aviso quando não há cardápio
```

## Como aplicar

```bash
# Na RAIZ do projeto:
unzip -o patch-lista-compras-v2-fix-v9.6.zip -d .

git add -A
git commit -m "fix(v9.6): lista de compras - filtrar dias por data real + normalizador TACO + fallback cardápio"
git push
```

## Verificação

### Bug 1 (semana errada)

1. Acesse **Nutrição → Lista de Compras → Pedido Semanal**.
2. Selecione uma escola que tenha cardápio com semanas consecutivas.
3. Escolha uma data de referência que faça o período cobrir parcialmente
   duas semanas (ex.: Ter 11/08 → Seg 17/08).
4. Gere o pedido.
5. **Itens de depois de 17/08 NÃO devem aparecer** (ex.: mexerica de
   21/08 deve sumir).

### Bug 2 (escolas sem cardápio)

1. Selecione uma escola que antes não puxava cardápio.
2. Gere o pedido.
3. Se ainda não houver cardápio com semanas no período, aparecerá um
   **card amarelo com aviso** explicando o que houve.
4. Se a escola tem cardápio em RASCUNHO, agora ele é usado (antes era
   ignorado).

### Bug 3 (ingredientes em Outros)

1. Gere um pedido ou previsão.
2. A categoria "Outros" deve ter **muito menos itens** (antes 41, agora
   deve ser ~5-10 — apenas os que realmente não têm correspondente na
   lista canônica).
3. Itens como "Abobrinha, Verde, Crua" agora devem aparecer como
   "Abobrinha Verde" em HORTIFRUTI.
4. "Carne, Bovina, Acem, Moido, Cozido" agora deve aparecer como
   "Carne bovina moída" em CARNES_PROTEINAS.
5. "Farinha, de Trigo" agora deve aparecer como "Farinha Pura (25kg)"
   em PADARIA_CONFEITARIA.
