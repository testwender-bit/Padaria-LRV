# Patch v9.10.10 — Complemento separado na folha de produção ("150 + 10")

> **Arquivo:** `patch-v9.10.10.zip` · **Requisito:** aplicar por cima da
> **v9.10.9** (sem mudanças de banco — nada de `prisma db push` nesta versão).

**O que resolve (1 ajuste):**

Na folha de impressão **PRODUÇÃO — PÃO FRANCÊS** (as duas vias: 1ª e 2ª), o
Pão Complemento aparecia **somado** junto com o pão francês normal da escola.
Se a escola tinha 150 pães de produção da semana + 10 de complemento, a folha
mostrava só **160** — sem dar para saber quanto era complemento.

Agora, **onde houver complemento, o número aparece separado**:

1. **Célula do dia**: escola com 100 pães base + 30 de complemento produzidos
   na terça mostra **"100 + 30"** (a soma continua 130 — nada mudou no total).
2. **Coluna TOTAL da escola**: complemento no decorrer da semana aparece
   desdobrado, ex. **"510 + 50"** (antes mostrava só "560").
3. **Linha TOTAL GERAL**: os totais do dia e da semana também desdobram o
   complemento quando houver (ex. **"1.200 + 30"**), sempre batendo com a soma
   das escolas acima.
4. Vale para **TODAS as escolas** com complemento cadastrado (creche,
   fundamental, interior — qualquer uma) e para as **duas vias** da impressão
   (1ª e 2ª), que usam a mesma folha.
5. **Escolas sem complemento não mudam NADA** (número puro, como sempre).
   Caso a escola tenha só complemento no dia (sem pão base), a célula mostra
   o número normal (nada a separar — nunca aparece "0 + 10").
6. **A tela (view Semanal/Por Dia) continua igual** — o formato separado é só
   na folha impressa.
7. Regras preservadas: v9.8.7 (PCQ zerado por ajuste/feriado zera o
   complemento), v9.10.9 (formato "X + PF YY" na folha do motorista), extras
   de instituições avulsas sem complemento saem como sempre.

## Ordem de aplicação (GitHub Codespace)

Com o terminal aberto **na raiz do projeto** (pasta que contém `package.json`),
envie o arquivo `patch-v9.10.10.zip` para dentro dela e rode:

```bash
# 1) Extrai por cima, sobrescrevendo os arquivos:
unzip -o patch-v9.10.10.zip

# 2) Esta versão NÃO altera o schema — NÃO precisa de `prisma db push`.

# 3) Gere o build e reinicie:
npm run build
npm run start   # ou o supervisor de sempre
```

## Como conferir

1. Abra **Produção** → **Imprimir**. Na folha **PRODUÇÃO — PÃO FRANCÊS (1ª
   via)**, a escola com complemento mostra o dia desdobrado (ex. **"100 + 30"**)
   e a coluna TOTAL desdobrada (ex. **"510 + 50"**).
2. A **2ª via** (página seguinte) mostra exatamente o mesmo formato.
3. A linha **TOTAL GERAL** do dia mostra o complemento separado quando houver
   (ex. **"1.200 + 30"**) e bate com a soma das escolas.
4. Escolas **sem** complemento continuam com o número puro (ex. **"150"**).
5. A folha do motorista (PCQ, no fim da impressão) continua com o formato
   "2 + PF 20" da v9.10.9 — nada mudou lá.
6. Na **tela** da Produção (view Semanal), os números continuam somados como
   sempre — a mudança é só na impressão.

### Regras de negócio

- O formato **"base + complemento"** aparece **somente** onde a célula contém
  complemento > 0 (dia com complemento, TOTAL da escola com complemento na
  semana, total do dia/da semana com complemento de alguma escola).
- A **soma impressa continua a mesma** de antes — é só uma separação visual;
  nada muda em produção de fato, entregas, romaneio ou histórico.
- Complemento zerado por ajuste/feriado (v9.8.7) → célula volta ao número puro
  (nunca "0 + 10" nem "100 + 0").
- Instituições avulsas (Produção Extra) não têm complemento → saem como sempre.

## Arquivos do patch

| Arquivo | Mudança |
|---|---|
| `src/app/api/producao/route.ts` | Itens de PF Complemento saem com flag `complemento: true` (2 blocos: domingo e D-1 ter/qui) — a soma no PF continua igual |
| `src/lib/producao-utils.ts` | Campo `complemento?: boolean` em `ItemProducao` + helper `formatarPfComComplemento()` (formata "150 + 10") |
| `src/lib/producao-semana-utils.ts` | Consolidador rastreia `pf_comp`/`total_pf_comp` por escola, por dia e no total geral (subconjunto do pf — soma intacta) |
| `src/app/(app)/producao/page.tsx` | Folha PF impressa (1ª e 2ª vias): células de dia, coluna TOTAL da escola e linha TOTAL GERAL com o formato separado |

## Validação e commit

- Testes: `scripts/test-pf-complemento-v91010.ts` (63 asserts: rota REAL com db
  mockado — flag nos itens certos, totais somados intactos, v9.8.7 preservada;
  consolidador REAL — pf_comp por escola/dia/total, extras sem poluir, higiene
  de decimais; helper REAL — "150 + 10" e casos de borda; fonte — 2 vias, tela
  intocada, v9.10.9 preservada; 200 semanas aleatórias com 0 violações) +
  suíte completa de regressão (15 arquivos, todos verdes); `tsc --noEmit`
  0 erros; `npm run build` OK.
- Sugestão de commit (rode na raiz do projeto, após conferir o build):
```bash
git add .
git commit -m "v9.10.10: Pão Complemento separado na folha de produção PF ('150 + 10') — células de dia, TOTAL da escola e TOTAL GERAL, nas duas vias"
git push
```

> `git add .` (a partir da raiz) já pega os arquivos sobrescritos pelo
> `unzip -o` e o `LEIA-ME.md` atualizado. Se quiser conferir antes:
> `git status` e `git diff --stat`.
