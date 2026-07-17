# Fix v9.5.4 — Produção Extra aparece + Ordem Sequencial Global + Print sem número

## 1. Produção Extra não aparecia — CORRIGIDO

### Sintoma

> "quando adiciono inst. extra ela não aparece na produção na onde verifica
> que nesse caso que adicionei era pão frances não aparece na produção nem
> na impressão da produção."

### Causa raiz

O patch v9.5.2 reescreveu `src/app/api/producao/route.ts` para adicionar
`ordem_rota`, mas **perdeu a busca em `db.producaoExtra`** que estava no
patch v9.5 original. A resposta JSON voltou a não incluir `producaoExtra`,
então a página fazia `setProducaoExtra(prodJson.producaoExtra || [])` →
sempre array vazio.

Além disso:
- O **Prisma schema não tinha o model `ProducaoExtra`** no stage/.
- A **API `/api/producao/extra/route.ts`** (POST/GET/DELETE) não estava
  sendo entregue nos patches recentes.
- A visão **Por Dia** usava `data.dias` em vez de `diasComExtra`.

### Fix

1. **`prisma/schema.prisma`**: adicionado `model ProducaoExtra` (com
   campos `ano`, `semana`, `nome_instituicao`, `produto`, `dia_semana`,
   `quantidade`, `observacao`) e campo `pao_fixo` na `Escola`.
2. **`src/app/api/producao/extra/route.ts`**: incluída (GET/POST/DELETE).
3. **`src/app/api/producao/route.ts`**: agora busca `producaoExtra` no
   banco e retorna no JSON da resposta (com try/catch — se a tabela não
   existir ainda, retorna `[]` em vez de quebrar).
4. **`src/app/(app)/producao/page.tsx`**: a visão **Por Dia** agora usa
   `diasComExtra` (não `data.dias`), então extras aparecem também lá.

### IMPORTANTE — Migração do banco

Após aplicar o patch, é necessário rodar `prisma db push` para criar a
tabela `ProducaoExtra` no banco:

```bash
npx prisma db push
# ou
npx prisma migrate dev --name add-producao-extra
```

Sem isso, a API retorna `producaoExtra: []` (silenciosamente) e nada
aparece — mas não quebra a aplicação.

## 2. Ordenação agora é SEQUENCIAL GLOBAL

### Sintoma

> "ele está agrupando por rota ou seja ele primeiro vem rota do motorista
> aroldo 1 2 3 4. depois para buscar 1 2 3, depois rota do motorista jose
> 1 2 3. não quero que ele organize assim. quero que ordem seja sequencia
> mesmo vou demonimar o numero de ordem 1 2 3 4 para cada um el
> independente do motorista ele via ficar na ordem."

### Fix

- **`consolidarProducaoSemana`** agora ordena APENAS por
  `ordem_rota → nome_curto` (sem comparar `rota`).
- **`sortEscolas`** na página também faz o mesmo.
- **Botão "Renumerar"** agora atribui números GLOBAIS (1..N) a todas as
  escolas, independente do motorista. A ordenação inicial ainda segue
  `rota → nome_curto` para ser estável/previsível, mas os números em si
  são globais — então você pode trocar livremente e a sequência final
  respeita só o número.

### Importante: Romaneio continua agrupado por motorista

O **romaneio** (página de impressão por motorista) ainda agrupa por rota
— isso é necessário porque cada motorista leva só as escolas da sua rota.
A mudança de ordenação sequencial vale apenas para a **página de produção**
(visão consolidada) e a **impressão da produção** (PF, PCQ, Lanches).

## 3. Número da ordem SOME na impressão

### Sintoma

> "na impressão no pão frances ficou numeração junto nome da escola não
> quero isso."

### Fix

O `<span>` que mostra o `ordem_rota` ao lado do nome agora tem a classe
`print:hidden` do Tailwind. Resultado:
- **Na tela** (visão semana e dia): continua aparecendo o número em cinza
  claro ao lado do nome, para você conferir a ordem.
- **Na impressão** (Ctrl+P): o número some, só aparece o nome da escola.

## Arquivos incluídos

```
prisma/schema.prisma                                    # ProducaoExtra model + pao_fixo
src/app/api/producao/route.ts                           # retorna producaoExtra no JSON
src/app/api/producao/extra/route.ts                     # CRUD de ProducaoExtra (NOVO)
src/app/api/romaneio/route.ts                           # ordem_rota + sort
src/app/api/escolas/route.ts                            # orderBy + nome_curto tie-breaker
src/app/(app)/producao/page.tsx                         # usa diasComExtra na visão Por Dia + print:hidden
src/app/(app)/configuracoes/page.tsx                    # Renumerar GLOBAL
src/app/print.css                                       # (mantido do v9.5.3)
src/lib/producao-utils.ts                               # ItemProducao.ordem_rota obrigatório
src/lib/producao-semana-utils.ts                        # sort sem rota
src/lib/romaneio-utils.ts                               # EscolaRomaneio.ordem_rota
```

## Como aplicar

```bash
# Na RAIZ do projeto:
unzip -o patch-extra-show-ordem-global-v9.5.4.zip -d .

# CRIAR A TABELA ProducaoExtra NO BANCO (importante!):
npx prisma db push

# Commit
git add -A
git commit -m "fix(v9.5.4): extra aparece + ordem sequencial global + print sem número"
git push
```

## Verificação

1. **Configurações → Escolas → Renumerar** → todas as escolas recebem
   números 1..N (globais, sem agrupar por motorista).
2. **Página de Produção** → as escolas aparecem na sequência 1, 2, 3, 4
   ... sem agrupar por motorista. (O número aparece em cinza claro ao
   lado do nome.)
3. **Imprimir (Ctrl+P)** → o número SOME na impressão, só fica o nome.
4. **Cadastre uma Produção Extra** (botão "+ Produções Extras"):
   - Escolha PF, dia (ex: segunda), quantidade.
   - Salve.
   - Na página de produção (visão semana ou dia), a instituição extra
     aparece na lista com a quantidade correta.
   - Na impressão, aparece na seção "Produção Extra" ao final.
5. **Romaneio** (página de impressão por motorista) → continua agrupado
   por motorista, com as escolas de cada motorista ordenadas por
   `ordem_rota` dentro daquela rota.

## Nota técnica

A busca de `producaoExtra` na API de produção foi envolvida em
`try/catch` com fallback `[]`. Isso garante que se a tabela não tiver
sido criada ainda (esquecimento do `prisma db push`), a aplicação não
quebra — apenas os extras não aparecem. Após rodar `prisma db push`,
eles passam a aparecer normalmente.
