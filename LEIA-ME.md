# Patch v9.10.7 — Lanche extra também separadinho na folha do motorista

> **Arquivo:** `patch-v9.10.7.zip` · **Requisito:** aplicar por cima da
> **v9.10.6** (sem mudanças de banco — nada de `prisma db push` nesta versão).

**O que resolve:**

Na v9.10.6 o lanche extra FORA da semana (preparação diferente do lanche da
semana) passou a aparecer separadinho na **folha de produção de Lanches**, mas
na **folha do motorista (romaneio)** ele ainda aparecia **misturado** dentro dos
blocos do dia do lanche da semana — só com uma anotação cinza minúscula ao lado
da instituição — e ainda **inflava os totais do dia** (ex.: "■ QUARTA — 370
unid." somavam 270 do lanche da semana + 100 do extra, uma preparação
diferente). O motorista não conseguia ver claramente o que levar.

Agora a folha do motorista recebe o **mesmo tratamento da folha de produção**:

1. **Tabela do lanche da semana** (por dia / cruzada) mostra **só o lanche da
   semana** — os extras fora da semana saíram das linhas e dos **totais do dia
   e do TOTAL GERAL** (não mistura preparações diferentes; o "■ QUARTA" volta a
   significar lanche da semana).
2. **Bloco próprio "PREPARAÇÃO EXTRA — <nome do lanche>"** na **MESMA folha do
   motorista** (mesma página, sem quebra), logo abaixo da tabela do lanche:
   DIA / INSTITUIÇÃO · QUANTIDADE + **TOTAL EXTRA** próprio — mesmo formato do
   bloco da folha de produção de Lanches (v9.10.6). Vários lanches diferentes =
   um bloco por preparação (agrupamento ignora maiúsculas/minúsculas, extras
   ordenados por dia).
3. Funciona nas **duas impressões**: a saída pelo botão Imprimir da **Produção**
   (romaneio impresso no fim) e a página **Romaneio** (/romaneio) — impressão e
   tela (na tela, o bloco aparece dentro do card de Lanches, abaixo da tabela).
4. **Rota que só tem lanche extra fora da semana** (sem lanche da semana
   nenhum) agora imprime a folha PCQ/Lanches do motorista só com o bloco do
   extra (antes a folha inteira desaparecia se não houvesse lanche de escolas).
5. Extras de **Pão Francês e PCQ** não mudam nada (seguem com o separador
   "Produção Extra" nas tabelas de PF e PCQ do motorista — v9.10.5/6).
6. Lanche extra **igual ao da semana** (regular/bifásico) não muda: entra
   normalmente nas linhas e nos totais (é o lanche da semana mesmo).

## Ordem de aplicação (GitHub Codespace)

Com o terminal aberto **na raiz do projeto** (pasta que contém `package.json`),
envie o arquivo `patch-v9.10.7.zip` para dentro dela e rode:

```bash
# 1) Extrai por cima, sobrescrevendo os arquivos (caminhos preservados):
unzip -o patch-v9.10.7.zip

# 2) Esta versão NÃO altera o schema — NÃO precisa de `prisma db push`.

# 3) Gere o build e reinicie:
npm run build
npm run start   # ou o supervisor de sempre
```

> O `unzip -o` substitui os 4 arquivos listados em "Arquivos do patch" e deixa
> o `LEIA-ME.md` na raiz com o histórico desta versão.

## Como conferir

1. Cadastre um Inst. Extra com **produto = um lanche diferente do lanche da
   semana**, motorista José ou Aroldo.
2. Imprima a Produção: na folha do motorista escolhido, a seção de lanches do
   dia mostra só o lanche da semana e, logo abaixo, o bloco
   "PREPARAÇÃO EXTRA — <lanche>" com a instituição, o dia e a quantidade.
3. O mesmo aparece na página Romaneio (impressão e tela).
4. Os totais do dia e o TOTAL GERAL da tabela de lanches voltam a conter só o
   lanche da semana; o extra soma no "Total:" do bloco dele.

### Regras de negócio

- O total do dia na folha do motorista é **do lanche da semana**; cada bloco
  "PREPARAÇÃO EXTRA" tem **total próprio** (mesma regra da folha de produção).
- A classificação mesmo/fora-da-semana é **dinâmica** (compara com o lanche da
  semana impresso, ignorando maiúsculas/minúsculas e espaços): se a semana
  mudar de lanche, o extra pode migrar do bloco para dentro da tabela (e
  vice-versa) automaticamente.
- O extra continua **entrando no romaneio** (é entrega real, soma para o
  motorista levar) — só não mistura com os totais do lanche da semana.
- Extras de lanche fora da semana seguem **sem ajuste/feriado** (cadastro
  manual pontual) e **aparecem na tela** de Romaneio com a preparação listada.
- Registros antigos (sem motorista) continuam fora do romaneio até serem
  recadastrados (regra da v9.10.5, inalterada).

## Arquivos do patch

| Arquivo | Mudança |
|---|---|
| `src/lib/romaneio-utils.ts` | `ExtraLancheFora` + `RomaneioMotorista.extras_lanche_fora?` + `agruparExtrasLancheFora()` (agrupa por preparação, ordena por dia) |
| `src/app/api/romaneio/route.ts` | API calcula `extras_lanche_fora` por rota (lanche fora da semana) e **exclui** esses extras dos totais do lanche da semana; extras continuam em `escolas` com `extra_lanche` (compat) |
| `src/app/(app)/producao/page.tsx` | Folha do motorista (romaneio impresso da Produção): linhas do dia excluem extras fora da semana + blocos "PREPARAÇÃO EXTRA" com total próprio na mesma folha |
| `src/app/(app)/romaneio/page.tsx` | Mesmo tratamento na página Romaneio (impressão PF/PCQ/Lanches + tela no card de Lanches); folha imprime mesmo quando a rota só tem extra fora da semana |

## Validação e commit

- Testes: `scripts/test-extra-romaneio-v9107.ts` (74 asserts: rota real com db
  mockado, asserts de fonte e 200 semanas aleatórias) + regressões completas
  v9.9.0→v9.10.6 (855 asserts) — todos verdes; `tsc --noEmit` 0 erros;
  `npm run build` OK.
- Sugestão de commit (rode na raiz do projeto, após conferir o build):
```bash
git add .
git commit -m "v9.10.7: lanche extra fora da semana separadinho também na folha do motorista (bloco PREPARAÇÃO EXTRA na mesma folha, fora dos totais do lanche da semana; tela e impressão da Produção e do Romaneio)"
git push
```

> `git add .` (a partir da raiz) já pega os arquivos sobrescritos pelo
> `unzip -o` e o `LEIA-ME.md` atualizado. Se quiser conferir antes:
> `git status` e `git diff --stat`.
