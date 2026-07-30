# Fix v9.6.2 — Mapeamentos TACO finais + itens a IGNORAR

## O que mudou

Com base nos 13 ingredientes restantes em "Outros" que você reportou,
mapeei todos e adicionei a capacidade de **IGNORAR** itens que não são
de compra (água) ou são produzidos pela padaria (pães).

## Mapeamentos adicionados

| Nome TACO (limpo) | Mapeado para | Ação |
|---|---|---|
| Água | — | **IGNORAR** (não é item de compra) |
| Carne (genérico) | Carne bovina de 2ª em cubo | mapeado |
| Carne de Carneiro | Carne de Ovino | mapeado |
| Ervilha Enlatada Drenada | Ervilha verde congelada | mapeado (mesmo produto) |
| Extrato de tomate 1,7kg) | Extrato de tomate 1,7kg | mapeado (typo corrigido) |
| Frango Coxa sem Pele | Coxa e sobrecoxa | mapeado |
| Frango Peito com Pele | Filé de peito de frango | mapeado |
| Ovo Mexido | Ovos de galinha (dz) | mapeado |
| Pao Trigo Frances | — | **IGNORAR** (produzido pela padaria) |
| Pao Trigo Sovado | — | **IGNORAR** (produzido pela padaria) |
| Proteina Texturizada de Soja | Proteína de soja (kg) | mapeado |
| Trigo para Quibe | Farinha para kibe (500g) | mapeado |
| Uva Italia | Uva vermelha | mapeado |

## Novo recurso: itens a IGNORAR

Adicionei a constante `ITENS_IGNORAR` e a função `deveIgnorarIngrediente()`
em `lista-compras-utils.ts`. A API agora chama `.filter(item => !deveIgnorarIngrediente(item.nome_canonico))`
na construção final dos itens, removendo completamente:

- **Água** — água da torneira, não é item de compra
- **Pão Trigo Francês** — produzido pela própria padaria
- **Pão Trigo Sovado** — produzido pela própria padaria
- **Pão Francês** — produzido pela própria padaria
- **Pão Sovado** — produzido pela própria padaria

A função verifica tanto match exato quanto match por substring
(`pao trigo frances`, `pao trigo sovado`, etc.), cobrindo variações
como "Pao Trigo Frances Especial".

## Confirmação de ordem

A ordem da LISTA_CANONICA foi confirmada — está exatamente como você
listou (Hortifruti → Frutas → Polpas → Laticínios → Carnes → Bebidas
Lácteas → Mercearia Seca → Especiarias → Padaria/Confeitaria). Nenhuma
alteração na ordem foi necessária.

## Arquivos incluídos

```
src/lib/lista-compras-utils.ts                              # novos mapeamentos + ITENS_IGNORAR + deveIgnorarIngrediente
src/app/api/nutricao/lista-compras/route.ts                 # filtro deveIgnorarIngrediente nos modos PREVISAO e PEDIDO
```

## Como aplicar

```bash
# Na RAIZ do projeto:
unzip -o patch-lista-compras-mapeamentos-v9.6.2.zip -d .

git add -A
git commit -m "fix(v9.6.2): mapeamentos TACO finais + ignora água e pães da padaria"
git push
```

## Verificação

1. Acesse **Nutrição → Lista de Compras → Pedido Semanal**.
2. Gere um pedido.
3. **Água** não deve mais aparecer (antes eram 20.493 kg em "Outros").
4. **Pão Trigo Francês** e **Pão Trigo Sovado** não devem aparecer.
5. Os outros 10 ingredientes devem aparecer em suas categorias corretas:
   - "Carne" → Carnes e Proteínas como "Carne bovina de 2ª em cubo"
   - "Carne de Carneiro" → Carnes e Proteínas como "Carne de Ovino"
   - "Ervilha Enlatada Drenada" → Hortifruti como "Ervilha verde congelada"
   - "Extrato de tomate 1,7kg)" → Mercearia Seca como "Extrato de tomate 1,7kg"
   - "Frango Coxa sem Pele" → Carnes como "Coxa e sobrecoxa"
   - "Frango Peito com Pele" → Carnes como "Filé de peito de frango"
   - "Ovo Mexido" → Carnes como "Ovos de galinha (dz)"
   - "Proteina Texturizada de Soja" → Mercearia como "Proteína de soja (kg)"
   - "Trigo para Quibe" → Mercearia como "Farinha para kibe (500g)"
   - "Uva Italia" → Frutas como "Uva vermelha"
6. A categoria "Outros" deve estar **vazia** ou com muito poucos itens
   (apenas ingredientes verdadeiramente novos sem correspondente).

## Nota técnica

Se no futuro aparecer um novo ingrediente que deve ser ignorado, basta
adicionar o nome canônico à constante `ITENS_IGNORAR` em
`lista-compras-utils.ts`:

```ts
export const ITENS_IGNORAR: string[] = [
  'Água',
  'Pão Trigo Francês',
  'Pão Trigo Sovado',
  // adicionar aqui:
  'Novo Item Para Ignorar',
]
```

E se aparecer um ingrediente que deve ser mapeado para um item existente,
adicionar a variação no `MAPA_VARIACOES`:

```ts
'nova variacao taco': 'Nome Canônico Existente',
```
