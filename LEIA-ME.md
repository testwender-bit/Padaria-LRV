# Patch v9.9.1 — Legenda discreta de conversão do PCQ para unidades Busca Própria

## 🎯 O que este patch faz

Nas unidades marcadas como **Busca Própria** (Configurações → aba Escolas → Rota =
"Busca Própria"), a quantidade de **PCQ (pão de cachorro quente)** agora vem acompanhada
da **conversão em pães**, entre parênteses, ao lado do número:

> **Bombeiro 1 (60)**  →  1 forma = 60 pães de cachorro quente

A conversão usada é: **1 forma inteira = 60 pães de cachorro quente**.
Exemplos: `1 (60)` · `0,5 (30)` · `1,5 (90)` · `2 (120)` · `3 (180)`.

### Onde a legenda aparece (somente PCQ, somente Busca Própria)

1. **Tela — view "Por Dia"** (/producao): na tabela "Pão de Cachorro Quente", o número
   da coluna Formas ganha o `(N)` ao lado (ex.: `1 (60)`).
2. **Tela — view "Semanal"** (/producao): células seg/qua/sex da tabela PCQ e a coluna
   Total ganham o `(N)` ao lado (ex.: Total `3 (180)`).
3. **Impressão da Produção — página "PRODUÇÃO — PCQ" (P3)**: mesmas células com o `(N)`
   em fonte menor e cinza (discreto), além da coluna Total.
4. **Nota de legenda**: quando houver pelo menos 1 unidade Busca Própria com PCQ na
   semana, aparece uma linha pequena e discreta abaixo da tabela PCQ (na tela e na
   impressão): *(N) = pães de cachorro quente · 1 forma = 60 pães · unidades Busca
   Própria*.

### O que NÃO muda

- Escolas que NÃO são Busca Própria continuam exibindo apenas o número de formas.
- PF (pão francês) e Lanches não recebem legenda — é apenas para o PCQ.
- A quantidade impressa/gravada continua em **formas**; o `(N)` é só informativo
  (conversão ×60). Nenhum cálculo de produção, ajuste, romaneio, estoque ou histórico
  foi alterado.
- Totais gerais do dia/semana continuam em formas (sem conversão).

## 📦 Arquivos incluídos (4)

| Arquivo | Mudança |
|---|---|
| `src/lib/producao-utils.ts` | Constante `FORMA_PCQ_PAES = 60` + helpers `ehBuscaPropria()` e `legendaPcqPaes()` |
| `src/lib/producao-semana-utils.ts` | `EscolaConsolidada` agora propaga o flag `busca_propria` (usado pela view Semanal e impressão) |
| `src/app/(app)/producao/page.tsx` | Legenda `(N)` no PCQ: view Por Dia, view Semanal, impressão P3 + nota de legenda discreta |
| `LEIA-ME.md` | Este arquivo |

> ℹ️ Não houve mudança de schema, de API nem de migração. A API `/api/producao` já
> enviava o flag `busca_propria` em cada item — o patch apenas passa a exibi-lo.
> Não rode `prisma db push`: nada mudou no banco.

## 🚀 Como aplicar

```bash
# 1. Backup + branch
git stash
git checkout -b feat/v9.9.1-legenda-pcq-busca-propria

# 2. Extrair (sobrescreve os arquivos)
unzip -o patch-v991.zip

# 3. Build + testar (NÃO precisa prisma generate/db push)
npm run build
npm run dev
```

## 🧪 Como testar (checklist)

1. **Build passa** — `npm run build` sem erros de tipo.
2. **Marque uma unidade como Busca Própria** (se ainda não tiver): /configuracoes →
   aba Escolas → editar (ex.: Bombeiro) → Rota = "Busca Própria" → salvar.
3. **/producao → view Semanal → card "Pão de Cachorro Quente":** a linha dessa unidade
   mostra `1 (60)` nos dias seg/qua/sex (e `3 (180)` no Total, se somar 3 formas na
   semana). Escolas normais continuam só com o número.
4. **/producao → view "Por Dia":** na tabela PCQ, a unidade mostra `1 (60)` na coluna
   Formas; com meio formulário, `0,5 (30)`.
5. **Imprimir** (/producao → Imprimir): na página "PRODUÇÃO — PCQ", a unidade Busca
   Própria traz o `(60)` discreto ao lado do número e a linha de legenda no rodapé da
   tabela. As páginas de PF, Lanches e Romaneio não mudam.
6. **Ajuste semanal continua funcionando:** clique na célula da unidade Busca Própria,
   ajuste para 2 → mostra `2 (120)` com badge "Ajustado" e a célula âmbar.
7. **Feriado zerando PCQ:** valor riscado NÃO mostra legenda (não faz sentido converter
   quantidade zerada).

## 🔄 Como commitar e voltar para main

```bash
git add -A
git commit -m "feat(v9.9.1): legenda discreta de conversao PCQ (1 forma = 60 paes) para unidades Busca Propria"
git checkout main
git merge feat/v9.9.1-legenda-pcq-busca-propria
git push origin main
git branch -d feat/v9.9.1-legenda-pcq-busca-propria
```

## 📝 Notas técnicas

- **Quem é "Busca Própria"?** O helper `ehBuscaPropria()` considera os dois sinais que
  existem no sistema: `rota === 'BUSCA_PROPRIA'` (o seletor "Rota" nas Configurações —
  é o marker visível na UI) OU o flag booleano `busca_propria` do cadastro (legado,
  sem checkbox na UI). Se os dois divergirem, vale qualquer um dos dois.
- **Conversão centralizada:** `FORMA_PCQ_PAES = 60` em `producao-utils.ts`. Se um dia a
  receita mudar (ex.: forma com 50 pães), basta alterar essa constante — tela, impressão
  e nota de legenda atualizam juntos.
- **`legendaPcqPaes(qtd)`** formata o `(N)`: multiplica formas × 60, com separador de
  milhar pt-BR (ex.: `10 (600)`) e tolera casas decimais incomuns sem quebrar.
- View Semanal/impressão usam `EscolaConsolidada.busca_propria` (novo campo propagado a
  partir do primeiro item da escola na consolidação — o flag vem da escola, não do
  produto). Nenhum consumidor externo de `consolidarProducaoSemana()` é afetado (é usado
  só pela página de Produção).
- A legenda não aparece quando a quantidade está zerada (feriado/ajuste zerando), nem
  nas colunas neutras ("—") dos dias sem produção de PCQ.
