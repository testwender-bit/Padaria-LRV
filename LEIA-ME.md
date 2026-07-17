# Fix v9.5.2 — Ordenação DEFINITIVA + "Produção Extra" em preto

## 1. Bug de ordenação — causa raiz DEFINITIVA

### Sintoma relatado pelo usuário

> "quando vou mudando os numero de ordem de rota das escolas ele só muda
> a que ta em primeiro e joga par ao meio se eu mudar uma escola que
> esteja la no final ela não mexe. preciso de algo definitivo"

### Causa raiz

O campo `ordem_rota` **existia no banco** e **era salvo corretamente**
pela API `/api/escolas` (PUT). Porém, a API de produção
(`/api/producao/route.ts`) **NÃO estava repassando `ordem_rota`** para os
objetos `ItemProducao` que ela monta.

A função `consolidarProducaoSemana` fazia:
```ts
ordem_rota: (item as any).ordem_rota ?? 0
```

Como `item.ordem_rota` era sempre `undefined`, todas as escolas caíam no
fallback `0`. A ordenação terminava no desempate por `nome_curto`
(alfabético) — que é o que parecia "aleatório mas estável".

**Por que mudar a primeira escola funcionava?** — Acontecia de a escola
alterada ter um `nome_curto` que, combinado com a nova posição
alfabética, mudava visualmente de lugar. Mas a `ordem_rota` em si nunca
foi usada.

### Fix definitivo

1. **`ItemProducao` agora tem `ordem_rota` como campo obrigatório**
   (era opcional/`as any` antes).

2. **API de produção passa `ordem_rota: escola.ordem_rota ?? 0`** em
   todos os 5 lugares onde monta `ItemProducao`:
   - `itensPfDomingo.push` (domingo → segunda)
   - `itensPf.push` (PF seg→sexta)
   - `itensPcq.push` (PCQ seg/qua/sex)
   - `itensPf.push` (PF_COMP integrado ao PF)
   - `itensLanche.push` (Lanche)

3. **API de romaneio passa `ordem_rota`** e faz `sort()` explícito dentro
   de cada rota: `ordem_rota → nome_curto`.

4. **Todas as APIs (`/escolas`, `/producao`, `/romaneio`)** agora usam
   `orderBy: [{ rota: 'asc' }, { ordem_rota: 'asc' }, { nome_curto: 'asc' }]`
   no Prisma — o `nome_curto` foi adicionado como **tie-breaker** para
   evitar ordem não-determinística quando duas escolas têm a mesma
   `ordem_rota`.

5. **`consolidarProducaoSemana`** usa `item.ordem_rota` (campo tipado,
   sem `as any`).

### Resultado

A ordem que você define em **Configurações → Editar Escola → Ordem** é
agora **respeitada 100%** em:
- Página de produção (visão semana)
- Impressão PF (1ª e 2ª via)
- Impressão PCQ/Lanches
- Romaneios por motorista

## 2. "Produção Extra" em preto

Renomeado o cabeçalho **"OUTRAS INSTITUIÇÕES"** → **"Produção Extra"**
com **letra preta** (antes era branca com `!important` no CSS).

Foi criada uma nova classe CSS `print-row-separator-black` (mantendo o
fundo escuro, mas com texto preto e sem `uppercase`) para não conflitar
com a regra `!important` existente da classe `print-row-separator`.

## Arquivos incluídos

```
src/lib/producao-utils.ts            # ItemProducao.ordem_rota obrigatório
src/lib/producao-semana-utils.ts     # usa item.ordem_rota (sem as any)
src/lib/romaneio-utils.ts            # EscolaRomaneio.ordem_rota opcional
src/app/api/escolas/route.ts         # orderBy + nome_curto tie-breaker
src/app/api/producao/route.ts        # 5× ordem_rota: escola.ordem_rota
src/app/api/romaneio/route.ts        # ordem_rota + sort dentro da rota
src/app/(app)/producao/page.tsx      # "Produção Extra" + diasComExtra tipado
src/app/print.css                    # nova classe print-row-separator-black
```

## Como aplicar

```bash
# Na RAIZ do projeto (onde está o package.json):
unzip -o patch-ordem-definitiva-v9.5.2.zip -d .

# Commit
git add -A
git commit -m "fix(v9.5.2): ordenação definitiva por ordem_rota + Produção Extra em preto"
git push
```

Após o push, a Vercel fará o redeploy automaticamente.

## Verificação

1. **Vá em Configurações → Escolas** e ajuste os números de Ordem.
2. **Salve** e volte para a página de Produção.
3. **As escolas devem aparecer na ordem exata que você definiu** dentro
   de cada motorista (José, Aroldo, Busca Própria).
4. **Imprima** (Ctrl+P) — a ordem deve ser a mesma na impressão PF,
   PCQ/Lanches e Romaneios.
5. **O cabeçalho "Produção Extra"** deve aparecer em preto sobre fundo
   escuro, separando as instituições da rota OUTROS das demais.

## Nota técnica

O `Array.prototype.sort` em JS moderno (Node 12+/V8) é **estável**
(especificação ES2019). Combinado com o `orderBy` do Prisma (que também
é estável no PostgreSQL), a ordem final é deterministicamente:
```
rota (asc) → ordem_rota (asc) → nome_curto (asc alfabético)
```

Qualquer alteração de `ordem_rota` em Configurações é refletida
imediatamente após recarregar a página de produção.
