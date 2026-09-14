# Patch v9.9.2 — Somatória do PCQ corrigida + números em padrão pt-BR (vírgula)

## 🎯 O que este patch faz

Corrige a **linha "Total PCQ"** da produção, que estava exibindo o número quebrado
com resíduo binário de ponto flutuante:

> **Antes:** Total PCQ (sexta) = `50.20000000000001` ❌
> **Depois:** Total PCQ (sexta) = `50,2` ✅ · Total da semana = `91,7` ✅

Duas correções na mesma família:

1. **Causa raiz eliminada** — em JavaScript, `0.1 + 0.2 = 0.30000000000000004`.
   Com muitas formas quebradas (0.1, 0.2, 0.5 — a conversão 1 forma = 50 pães das
   unidades Busca Própria), a soma acumulada do dia produzia aquele resíduo.
   Agora toda a consolidação (por escola, por dia e total da semana) é
   **normalizada em centésimos inteiros** antes de ser exibida.
2. **Exibição padronizada em pt-BR** — as células de PCQ que mostravam o número
   cru com ponto (`2.5`, `0.1`) passam a usar vírgula decimal (`2,5`, `0,1`),
   ficando iguais à coluna Total, que já usava vírgula. Vale para a **tela
   (view Semanal)** e para a **impressão (página PRODUÇÃO — PCQ)**.

### O que NÃO muda

- **Nenhum cálculo, ajuste, romaneio, estoque ou histórico foi alterado** — é
  normalização de exibição/consolidação apenas. Os valores gravados no banco
  continuam exatamente como estavam.
- A legenda `(N)` das unidades Busca Própria continua igual — agora com
  **1 forma = 50 pães**, preservando a alteração que você já fez manualmente
  (`FORMA_PCQ_PAES = 50`). Extrair este patch **não** reverte o 60 → 50.
- PF e Lanches: números inteiros, exibição intocada.
- Romaneio: não foi tocado (unidades Busca Própria não aparecem lá; quantidades
  de rota são inteiras/meias, que não geram resíduo binário).

## 📦 Arquivos incluídos (5)

| Arquivo | Mudança |
|---|---|
| `src/lib/producao-utils.ts` | `FORMA_PCQ_PAES = 50` (preserva sua mudança) · novos helpers `arredondarFormas()` e `formatarFormas()` · `legendaPcqPaes()` blindada contra resíduo |
| `src/lib/producao-semana-utils.ts` | **Causa raiz**: `consolidarProducaoSemana()` normaliza todos os valores (escola/dia/total) em centésimos inteiros |
| `src/app/(app)/producao/page.tsx` | Células do PCQ com `formatarFormas()`: view Semanal (células + linha "Total PCQ") e impressão P3 (células + "TOTAL GERAL") |
| `src/app/api/producao/route.ts` | `total_pcq` do dia arredondado na fonte (alimenta view Por Dia, dashboard e snapshot do Histórico) |
| `LEIA-ME.md` | Este arquivo |

> ℹ️ **Sem mudança de schema e sem migração.** Não rode `prisma db push`.

## 🚀 Como aplicar

```bash
# 1. Backup + branch
git stash
git checkout -b fix/v9.9.2-somatoria-pcq-pontoflutuante

# 2. Extrair (sobrescreve os arquivos)
unzip -o patch-v9.9.2.zip

# 3. Build + testar (NÃO precisa prisma generate/db push)
npm run build
npm run dev
```

## 🧪 Como testar (checklist)

1. **Build passa** — `npm run build` sem erros de tipo.
2. **/producao → view "Semanal" → card "Pão de Cachorro Quente":**
   - A linha **"Total PCQ"** mostra `50,2` na sexta (e nunca mais
     `50.20000000000001`) e `91,7` no Total — com os dados da semana que você
     reportou.
   - As células agora usam vírgula: `2,5` · `0,1` · `0,5` — iguais à coluna Total.
   - As unidades Busca Própria continuam com a legenda: `0,5 (25)` · `1 (50)` ·
     `2 (100)` · `0,1 (5)` · `0,2 (10)`.
3. **Imprimir** (/producao → Imprimir): na página "PRODUÇÃO — PCQ", a linha
   "TOTAL GERAL (FORMAS)" também mostra os totais do dia com vírgula e sem resíduo.
4. **Ajuste semanal:** clique numa célula de PCQ e ajuste (ex.: 0,3) — o valor e a
   linha "Total PCQ" continuam somando corretamente, sem número quebrado.
5. **Dashboard:** KPI "PCQ formas na semana" continua correto (agora com total
   limpo vindo da API).

## 🔄 Como commitar e voltar para main

```bash
git add -A
git commit -m "fix(v9.9.2): somatoria do PCQ sem resíduo de ponto flutuante + exibicao pt-BR nas tabelas"
git checkout main
git merge fix/v9.9.2-somatoria-pcq-pontoflutuante
git push origin main
git branch -d fix/v9.9.2-somatoria-pcq-pontoflutuante
```

## 📝 Notas técnicas

- **Por que acontecia:** números decimais em binário (padrão IEEE 754) não são
  exatos — `0.1` e `0.2` viram aproximações infinitas. Somar dezenas de formas
  quebradas acumula o erro (`0.1 + 0.2 = 0.30000000000000004`). A linha "Total
  PCQ" exibia esse número cru, enquanto a coluna Total usava `toLocaleString`
  (por isso o "91,7" já aparecia limpo ali).
- **A correção (2 camadas):**
  1. `arredondarFormas(v)` = `Math.round(v * 100) / 100` — acumular em centésimos
     inteiros é exato em ponto flutuante. Aplicada na consolidação
     (`producao-semana-utils.ts`, tela Semanal + impressão) e no total do dia da
     API (`/api/producao`).
  2. `formatarFormas(v)` = `toLocaleString('pt-BR', {maximumFractionDigits: 2})`
     — garantia visual: vírgula decimal, até 2 casas, sem zeros à direita.
- **Legenda blindada:** `legendaPcqPaes()` também normaliza a entrada — se um
  valor vier com resíduo (ex.: `0.30000000000000004` formas), o `(N)` sai limpo:
  `(15)` e não `(15.000000000000002)`.
- **Conversão centralizada:** segue em `FORMA_PCQ_PAES = 50`
  (`src/lib/producao-utils.ts`). Para mudar de novo (ex.: 60), altere só essa
  constante — tela, impressão e legenda acompanham.
- **Validação:** `tsc --noEmit` 0 erros · `next build` completo OK · 31/31 testes
  de lógica passaram, incluindo a reprodução exata da sua tabela
  (`scripts/test-somatorio-v992.ts` no ambiente de desenvolvimento).
