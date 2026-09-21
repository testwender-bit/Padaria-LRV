# Patch v9.9.3 — Lista de Compras: canonização corrigida + Unidade Compra real

## 🎯 O que este patch corrige

Auditoria completa do módulo **Nutrição → Lista de Compras**. O motor de
normalização de ingredientes tinha uma falha grave que misturava produtos
diferentes na mesma linha de compra:

### 1. "Carne suína" virava "Carne bovina de 2ª em cubo" ❌ → ✅ CORRIGIDO

**Causa raiz:** o limpador de nomes TACO (`limparNomeTaco`) tratava as palavras
`bovina`, `bovino`, `suina`, `moido`, `em cubos`, `em isca`, `sem osso`,
`acem` como "descritores cosméticos" e as **descartava**. Assim:

> `"Carne, suína, cru"` → limpava para `"carne"` (genérico) → caía no alias
> `'carne'` → **"Carne bovina de 2ª em cubo"** (default antigo)

Todas as carnes colapsavam para o mesmo item. **Correção:** essas palavras
**distinguem produtos de compra diferentes** e não são mais descartadas. Cada
carne agora resolve para o item certo da licitação:

| Nome no cardápio (TACO) | Antes | Depois |
|---|---|---|
| Carne, suína, cru | Carne bovina de 2ª em cubo ❌ | **Carne Suína** ✅ |
| Carne, bovina, de 1ª, sem gordura | Carne bovina de 2ª em cubo ❌ | **Carne bovina de 1ª (patinho)** ✅ |
| Carne, bovina, de 2ª, em isca | Carne bovina de 2ª em cubo ❌ | **Carne bovina de 2ª em isca** ✅ |
| Carne, bovina, moída | Carne bovina de 2ª em cubo ❌ | **Carne bovina moída** ✅ |
| Carne, ovino | Carne bovina de 2ª em cubo ❌ | **Carne de Ovino** ✅ |
| "Carne" (genérica) | 2ª em cubo | 2ª em cubo (default mantido) |

### 2. Outras misturas corrigidas

- **"Coxa e sobrecoxa S/ osso" colapsava em "Coxa e sobrecoxa"** — eram 2 itens
  de licitação somados numa linha só (`sem osso` era descartado). Agora são
  itens separados.
- **"Queijo" ia para "Nata"** — alias errado removido; queijo aparece em OUTROS
  com o nome honesto (não está na licitação).
- **"Extrato de tomate" virava "Extrato de tomate 1,7kg)"** — parêntese
  fantasma que jogava o item em OUTROS.
- **"Cebolinha" caía em OUTROS** — agora vai para Cheiro verde (salsa +
  cebolinha = cheiro verde, como já acontecia com a salsa).
- **"Biscoito de Arroz (90g)"** — item da licitação que não existia na lista
  canônica (adicionado + mapeado).
- **"Pera, cru" gerava linha vazia** — 'pera' é descritor da laranja; agora há
  um fallback que preserva o nome.
- Milho: desambiguação explícita (`milho verde espiga` = fresco ·
  `milho enlatado` = lata 1,7kg).

### 3. Coluna "Unidade Compra" agora converte de verdade

Antes, itens vendidos por embalagem mostravam **kg disfarçado de unidade**:
óleo de soja (900ml) com 3.01 kg mostrava "3.01 unid" (seriam ~3.34 garrafas).
Agora a quantidade é **dividida pela embalagem declarada no nome**:

| Item | Antes (com 3.01 kg) | Depois |
|---|---|---|
| Óleo de soja (900ml) | 3.01 unid ❌ | **3.34 unid** ✅ |
| Vinagre branco (750ml) | 0.86 unid ❌ | **1.15 unid** ✅ |
| Manteiga (500g) | kg disfarçado ❌ | **unid de 500g** ✅ |
| Leite integral (cx 12 litros) | kg disfarçado ❌ | **caixas** ✅ |
| Ovos de galinha (dz) | kg disfarçado ❌ | **dúzias** (1 ovo ≈ 50 g) ✅ |
| Baldes (5/10/15kg) e saco 25kg | kg disfarçado ❌ | **baldes/sacos** ✅ |
| Itens granel (arroz, feijão, sal...) | kg | kg (mantido) ✅ |

A coluna "Qtd (kg)" continua existindo — a conversão é só na "Unidade Compra".

## 📦 Arquivos incluídos (3)

| Arquivo | Mudança |
|---|---|
| `src/lib/lista-compras-utils.ts` | Descritores separados (preparo × variedade); espécie/corte de carne NÃO são mais descartados; ~25 chaves novas de carnes/cortes; correções queijo/extrato/cebolinha/biscoito de arroz; item "Biscoito de Arroz (90g)"; guard anti-vazio; novo `converterUnidadeCompra()` |
| `src/app/api/nutricao/lista-compras/route.ts` | Modos PREVISAO e PEDIDO usam `converterUnidadeCompra()` (Unidade Compra real) |
| `LEIA-ME.md` | Este arquivo |

> ℹ️ **Sem mudança de schema e sem migração.** Não rode `prisma db push`.
> Os valores gravados (percapitas, cardápios, alimentos) não mudam — a correção
> é na camada de consolidação/exibição da lista.

## 🚀 Como aplicar

```bash
# 1. Backup + branch
git stash
git checkout -b fix/v9.9.3-lista-compras-canonizacao

# 2. Extrair (sobrescreve os arquivos)
unzip -o patch-v9.9.3.zip

# 3. Build + testar (NÃO precisa prisma generate/db push)
npm run build
npm run dev
```

## 🧪 Como testar (checklist)

1. **Build passa** — `npm run build` sem erros de tipo.
2. **Nutrição → Lista de Compras (modo Previsão)**, mesmo período do seu exemplo:
   - "Carne suína" aparece como **Carne Suína** (linha própria, sem somar com
     bovina).
   - Carnes bovinas separadas corretamente: patinho / isca / cubo / moída.
   - "Coxa e sobrecoxa" e "Coxa e sobrecoxa S/ osso" em **linhas separadas**.
   - "Extrato de tomate" na Mercearia Seca (sem parêntese, não em OUTROS).
3. **Unidade Compra:** óleo em garrafas (qtd kg ÷ 0,9), vinagre ÷ 0,75,
   manteiga em pacotes de 500 g, leite em caixas de 12 L, ovos em dúzias,
   doces de leite em baldes, farinha em sacos.
4. **CSV/XLSX exportados** — coluna "Unidade Compra" com os valores convertidos.
5. Itens que não estão na licitação (ex.: Queijo, Morango) continuam aparecendo
   na categoria **OUTROS** no final — é o comportamento esperado para você
   revisar.

## ⚠️ Pergunta importante (não alterei sem sua confirmação)

A função `calcularPercapitaTotal` (`cardapio-base-utils.ts`) tem uma
**inconsistência nos casos de mescla Parcial/Integral**:

- Escola **só com alunos integrais**: cada integral conta **×1** por refeição
  (comentário no código: "já é por refeição").
- Escola com parciais **E** integrais **sem a flag "Mescla Parcial/Integral"**:
  cada integral conta **×2** em TODAS as refeições ("2 refeições").

Os dois casos se contradizem. Se as escolas da sua rede estão sem a flag de
mescla no cadastro, as quantidades dos integrais estão sendo **dobradas** na
lista de compras. **Me diga qual é o modelo correto** (×1 por refeição, como o
caso "só integral"? ou ×2 é intencional?) que eu ajusto no próximo patch.

## 🔄 Como commitar e voltar para main

```bash
git add -A
git commit -m "fix(v9.9.3): lista de compras — canonizacao de carnes/cortes + unidade de compra real"
git checkout main
git merge fix/v9.9.3-lista-compras-canonizacao
git push origin main
git branch -d fix/v9.9.3-lista-compras-canonizacao
```

## 📝 Notas técnicas

- **Estratégia da canonização:** nomes TACO ("Carne, suína, cru") são limpos em
  2 grupos de descritores — PREPARO (cru, cozido, picado...) e VARIEDADE
  (verde, pera, fuji...). Palavras de espécie/corte (bovina, suína, moída,
  em cubos, em isca, sem osso) nunca são descartadas; chaves exatas cobrem os
  nomes TACO completos (com "ª") e o fallback por substring prioriza as chaves
  mais longas.
- **Conversão de embalagem:** `parseMassaEmbalagemKg()` extrai a medida do
  próprio nome canônico (500g, 900ml, 1,7kg, pct 500gr, cx 12 litros, balde
  10kg, saco 25kg). Ovos: 1 dz = 12 × 50 g = 600 g (constante no código, fácil
  de ajustar).
- **Integridade auditada por testes:** (a) todo destino do mapa de variações
  existe na LISTA_CANONICA; (b) todos os 132 itens da sua lista de licitação
  estão cobertos; 58/58 testes passaram (`scripts/test-lista-compras-v993.ts`
  no ambiente de desenvolvimento). `tsc` 0 erros · `next build` OK.
