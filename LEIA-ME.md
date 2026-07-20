# Fix v9.5.7 — Pão Fixo na UI + Fim do subagrupamento por rota

## 1. Configuração "Pão Fixo" restaurada na UI

### Problema

> "a configuração de marcar para sempre usar quantidade padrão parece ter sumido."

### Causa

O campo `pao_fixo` foi adicionado ao `schema.prisma` no patch v9.5.4, mas
nunca foi implementado na UI da página de Configurações nem na lógica das
APIs de produção/romaneio.

### Fix

- **`src/app/(app)/configuracoes/page.tsx`**:
  - Adicionado campo `pao_fixo: boolean` à interface `Escola` local.
  - Adicionado checkbox **"Sempre usar quantidade padrão de Pão Francês"**
    no formulário de **Criar** e no de **Editar** escola (caixa amarela
    com explicação).
  - Ao clicar em Editar, o `pao_fixo` da escola é carregado no formulário.
  - O `handleRenumerar` também preserva o `pao_fixo` de cada escola.

- **`src/app/api/escolas/route.ts`**:
  - POST (create): aceita `pao_fixo` (default false).
  - PUT (update): aceita `pao_fixo`.

## 2. Produção sempre puxa pão das Outras Instituições

### Problema

> "Produção não está puxando o pão francês das outras instituições por que
> o cardápio escolar não tem pão na regular, mas eu já havia dito que a
> produção de pão das outras instituições deve sempre usar a quantidade
> padrão toda semana independente do cardápio escolar."

### Causa

A API de produção fazia:
```ts
const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPao)
if (!pfQ) continue  // ← pula a escola!
```

Se o `tipo_pao` do cardápio da semana fosse diferente do que a escola
tinha cadastrado (ex.: semana sem pão regular → `tipo_pao = 'SEMPAO'`),
a escola era **pulada** — não aparecia na produção.

### Fix

Em `/api/producao/route.ts` (2 lugares) e `/api/romaneio/route.ts` (1 lugar):

```ts
// v9.5.7: se escola.pao_fixo === true, SEMPRE usa PADRAO
const tipoPaoEfetivo = (escola as any).pao_fixo === true ? 'PADRAO' : tipoPao
const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPaoEfetivo)
  || escola.pf_quantidades.find((q) => q.tipo_pao === 'PADRAO')  // fallback
if (!pfQ) continue
```

Agora, se a escola tem `pao_fixo = true`:
- Ignora o `tipo_pao` do cardápio da semana.
- Sempre busca `pf_quantidades` do tipo `PADRAO`.
- Se mesmo assim não encontrar, cai no fallback (primeiro PADRAO
  disponível).
- Se ainda assim não encontrar, pula (não tem PF cadastrado).

### Como usar

1. Vá em **Configurações → Escolas**.
2. Edite uma Outra Instituição (Bombeiros, Ambulância, etc.).
3. Marque **"Sempre usar quantidade padrão de Pão Francês"**.
4. Salve.
5. Na página de Produção, essa instituição sempre aparecerá com a
   quantidade cadastrada como PADRÃO, mesmo em semanas onde o cardápio
   escolar não tem pão.

## 3. Fim do subagrupamento por rota na ordenação

### Problema

> "está reconhecendo o número pela 'ordem na rota' mas ao mesmo tempo
> ele buga pois está subagrupando por rota. Logo se 1 escola que está
> com tag de busca própria eu sinalizar como 1 ela fica como 1 do sub
> grupo de buscar não como primeira de todas. Preciso acabar com essa
> organização por subgrupo."

### Causa

Os `orderBy` do Prisma nas APIs `/api/escolas`, `/api/producao`, e
`/api/romaneio` tinham `rota: 'asc'` como **primeiro** critério:

```ts
orderBy: [{ rota: 'asc' }, { ordem_rota: 'asc' }, { nome_curto: 'asc' }]
```

Isso fazia o banco retornar as escolas **agrupadas por rota primeiro**,
depois ordenadas por `ordem_rota` dentro de cada rota. Resultado visual:
- Aroldo 1, 2, 3, 4...
- Busca Própria 1, 2, 3...
- José 1, 2, 3...

Em vez da sequência global que o usuário quer: 1, 2, 3, 4...

Também o `handleRenumerar` em `configuracoes/page.tsx` ordenava por
`rota → nome_curto` ao atribuir os números sequenciais — também
subagrupava.

### Fix

- **`/api/escolas/route.ts`**: `orderBy: [{ ordem_rota: 'asc' }, { nome_curto: 'asc' }]`
- **`/api/producao/route.ts`**: idem
- **`/api/romaneio/route.ts`**: idem (romaneio ainda agrupa por motorista
  na saída via `.filter(rota)`, mas a ordem DENTRO de cada motorista
  respeita a sequência global).
- **`handleRenumerar`** em `configuracoes/page.tsx`: ordena APENAS por
  `nome_curto` (sem `rota.localeCompare`).

### Resultado

- **Configurações → Escolas**: lista mostra escolas na sequência 1, 2, 3...
  independente do motorista.
- **Produção → PF / PCQ / Lanche**: mesma sequência 1, 2, 3...
- **Impressão de Produção**: mesma sequência.
- **Romaneio por motorista**: cada motorista continua levando apenas as
  escolas da sua rota, mas **dentro** de cada motorista a ordem respeita
  a sequência global (não mais 1, 2, 3 reiniciando por motorista).

### IMPORTANTE: Romaneio não foi alterado na sua lógica

Conforme o usuário esclareceu:
> "isso deve continuar (repetindo apenas muda a ordem que as escolas
> aparecem uma antes que outra, e não qual escola aparece no romaneio
> de cada motorista — isso está funcionando corretamente)."

O romaneio continua mostrando apenas as escolas de cada motorista na
página correspondente. Apenas a **ordem dentro** de cada motorista
mudou (agora é global, não reinicia).

## Arquivos incluídos

```
src/app/(app)/configuracoes/page.tsx            # UI pao_fixo + handleRenumerar sem rota
src/app/(app)/producao/page.tsx                 # (mantém sort sem rota do v9.5.4)
src/app/api/escolas/route.ts                    # POST/PUT aceitam pao_fixo + orderBy sem rota
src/app/api/producao/route.ts                   # pao_fixo usa PADRAO + orderBy sem rota
src/app/api/romaneio/route.ts                   # pao_fixo usa PADRAO + orderBy sem rota
src/lib/producao-semana-utils.ts                # (mantém sort sem rota do v9.5.4)
```

## Como aplicar

```bash
# Na RAIZ do projeto:
unzip -o patch-pao-fixo-ordem-global-v9.5.7.zip -d .

git add -A
git commit -m "fix(v9.5.7): pão fixo na UI + produção sempre puxa PADRAO + fim do subagrupamento por rota"
git push
```

**Nota**: o campo `pao_fixo` já existe no schema (adicionado no patch
v9.5.4). Se você não rodou `prisma db push` na época, rode agora:

```bash
npx prisma db push
```

## Verificação

### Pão Fixo

1. **Configurações → Escolas** → editar uma Outra Instituição (Bombeiros,
   Ambulância, etc.).
2. Marque **"Sempre usar quantidade padrão de Pão Francês"** (caixa amarela).
3. Salve.
4. Vá para uma semana onde o cardápio escolar **não tenha pão regular**.
5. **Produção → PF**: a instituição deve aparecer com a quantidade
   cadastrada como PADRÃO (não zerada).

### Ordenação Global

1. **Configurações → Escolas** → clique em **Renumerar**.
2. As escolas recebem 1, 2, 3... em ordem alfabética por nome curto
   (sem agrupar por motorista).
3. Edite uma escola de Busca Própria e coloque ordem 1.
4. Salve e recarregue.
5. Na lista de Configurações, ela deve aparecer como a **primeira de
   todas**, não como "primeira do subgrupo de Busca Própria".
6. **Produção → PF**: a escola deve aparecer como a primeira da lista
   de produção (antes das escolas do Aroldo e do José).
7. **Romaneio por motorista**: cada motorista continua levando apenas
   suas escolas, mas a ordem dentro de cada motorista respeita a
   sequência global (não reinicia em 1).
