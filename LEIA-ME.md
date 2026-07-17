# Fix v9.5.1 — Corrige erro de Hooks + Produção Extra silenciosa

## Problema corrigido

```
Error: Minified React error #310
React has detected a change in the order of Hooks called by ProducaoPage.
Rendered more hooks than during the previous render.
```

### Causa raiz

O `useMemo(diasComExtra)` adicionado na v9.5 estava posicionado **depois**
do early return `if (loading || !data) return (...)`. Isso viola as
Rules of Hooks do React:

- Quando `loading=true`, o componente retornava antes de chegar ao `useMemo`
  (16 hooks executados).
- Quando `loading=false` (após carregar dados), o componente passava pelo
  early return e executava o `useMemo` (17 hooks).

React detecta a mudança na ordem/quantidade de hooks entre renders e aborta
com o erro #310.

### Fix

O `useMemo(diasComExtra)` foi **movido para ANTES do early return**, junto
com os demais hooks. O guard interno `if (!data || producaoExtra.length === 0)
return data?.dias || []` já trata o caso nulo com segurança.

## Produção Extra agora é silenciosa

Conforme solicitado pelo usuário:

> "Quero que quando colocar uma instituição extra ela silenciosamente agrege
> como última da produção do pão frances sem separação sem nada."

Mudanças:

1. **Removida a página de impressão "PRODUÇÃO EXTRA — INSTITUIÇÕES"** — não
   existe mais como página separada.

2. **As produções extras são agora injetadas como `ItemProducao`** nos
   arrays `itens_pf` / `itens_pcq` / `itens_lanche` do dia de produção
   correspondente, via `useMemo(diasComExtra)`.

3. **Aparecem como a última instituição da rota `OUTROS`** na tabela de
   produção, junto com as demais escolas — sem separação visual.

4. **`consolidarProducaoSemana` agora recebe `diasComExtra`** em vez de
   `data.dias`, então os totais da semana já incluem as extras.

### Mapeamento de dia (entrega → produção)

- **PF**: dia_semana = entrega → produção = D-1
  (segunda→domingo, terça→segunda, etc., via `PF_PRODUCAO_PARA_ENTREGA`)
- **PCQ / Lanche**: dia_semana = entrega = produção (mesmo dia, D-0)

### Ordenação das extras

As extras recebem `rota = 'OUTROS'` e `ordem_rota = 9999`, garantindo que
apareçam **por último** dentro do bloco "OUTRAS INSTITUIÇÕES" da impressão,
depois das escolas reais que estejam nessa rota.

## Arquivos incluídos

```
src/app/(app)/producao/page.tsx       # Fix principal (hooks + extra silenciosa)
src/lib/producao-semana-utils.ts      # Sort por rota → ordem_rota → nome_curto
```

## Como aplicar

```bash
# Na RAIZ do projeto (onde está o package.json):
unzip -o patch-fix-extra-hooks.zip -d .

# Commit
git add -A
git commit -m "fix(v9.5.1): corrige erro de hooks + produção extra silenciosa"
git push
```

Após aplicar, **rebuild e redeploy** (Vercel fará automaticamente após o
push).

## Verificação

1. Acesse a página `/producao` — não deve mais exibir o erro #310.
2. Cadastre uma produção extra (botão "+ Produções Extras").
3. A produção extra deve aparecer:
   - Na tabela de produção PF (ou PCQ/Lanche), como última linha do bloco
     "OUTRAS INSTITUIÇÕES".
   - Na impressão (PF 1ª via, PF 2ª via), sem página separada.
   - Os totais da semana devem incluir as extras.
4. **Não deve existir** mais a página "PRODUÇÃO EXTRA — INSTITUIÇÕES" na
   impressão.
