# Patch v9.10.9 — PCQ + complemento p/ todas as unidades + página Romaneio inativada

> **Arquivo:** `patch-v9.10.9.zip` · **Requisito:** aplicar por cima da
> **v9.10.8** (sem mudanças de banco — nada de `prisma db push` nesta versão).

**O que resolve (2 ajustes):**

**Ajuste 1 — PF Complemento agrupado com o PCQ para TODAS as unidades.**
Na folha do motorista (impressão da Produção), o "PCQ + PF Complemento" das
unidades aparecia no formato **"2 + PF 20"** (2 formas de PCQ + 20 pães
franceses de complemento) — mas isso valia **só para creches e bifásicas**.
Qualquer outra unidade com PCQ + complemento cadastrados tinha o complemento
**somado dentro do PF regular** (número escondido, sem o formato agrupado).

Agora **toda unidade cadastrada com PCQ + complemento** (pf_comp
segunda/quarta/sexta > 0 em Configurações → PCQ) segue o mesmo formato:

1. Na tabela **PCQ** da folha do motorista, o dia mostra **"2 + PF 20"**
   (formas + complemento) — para **qualquer categoria** (Fundamental, Médio,
   Interior, Creche, Bifásica...).
2. O **TOTAL GERAL (FORMAS)** do dia mostra **"X + PF YY"** quando houver
   complemento no dia (somando todas as escolas da rota).
3. O complemento **não soma mais no PF regular** da unidade (o PF da tabela de
   Pão Francês passa a ser só o PF do café da manhã — para creches/bifásicas
   isso já era assim; agora é para todas).
4. Regras preservadas: complemento só faz sentido com PCQ (PCQ zerado por
   ajuste/feriado zera o complemento — v9.8.7); unidades **sem** complemento
   cadastrado não mudam NADA; unidades INTERIOR especiais seguem como estavam
   (v9.9.0); totais da folha somam todas as unidades.

**Ajuste 2 — Página Romaneio (/romaneio) INATIVADA.**
O romaneio do motorista já sai na impressão da Produção (botão Imprimir) e a
página separada não era usada. Acessos removidos:

1. **Menu lateral (desktop e mobile)**: item "Romaneio" removido (restam
   Dashboard, Produção, Cardápio).
2. **Produção**: o botão **"Romaneio →"** (que ficava ao lado de Imprimir) foi
   removido.
3. **Dashboard**: o card de acesso rápido "Romaneio" foi removido (ficam
   Produção, Cardápio e Configurações).
4. **/romaneio agora redireciona para /producao** — links antigos/favoritos
   não quebram (mesmo padrão da /lanches na v9.9.0). O código da página antiga
   está no histórico do git e pode voltar se um dia precisar.
5. **A API /api/romaneio continua ATIVA** — é ela que alimenta a folha do
   motorista impressa pela Produção.

## Ordem de aplicação (GitHub Codespace)

Com o terminal aberto **na raiz do projeto** (pasta que contém `package.json`),
envie o arquivo `patch-v9.10.9.zip` para dentro dela e rode:

```bash
# 1) Extrai por cima, sobrescrevendo os arquivos:
unzip -o patch-v9.10.9.zip

# 2) Esta versão NÃO altera o schema — NÃO precisa de `prisma db push`.

# 3) Gere o build e reinicie:
npm run build
npm run start   # ou o supervisor de sempre
```

## Como conferir

1. **Complemento geral**: cadastre PCQ + complemento (pf_comp) em uma unidade
   que NÃO seja creche (Configurações → PCQ). Imprima a Produção: na folha do
   motorista, a unidade aparece na tabela de PCQ como **"2 + PF 20"** nos dias
   com PCQ — e o total do dia mostra "X + PF YY".
2. **PF da unidade**: na mesma folha, a tabela de Pão Francês mostra só o PF
   regular da unidade (sem o complemento somado).
3. **Creches/bifásicas**: continuam exatamente como estavam.
4. **Romaneio**: o item sumiu do menu lateral, o botão sumiu da Produção, o
   card sumiu do Dashboard — e acessar /romaneio pelo navegador cai na
   página de Produção.
5. **Impressão da Produção**: a folha do motorista continua saindo no final
   da impressão, agora como ÚNICA fonte do romaneio.

### Regras de negócio

- O formato agrupado **"X + PF YY"** aparece **somente nos dias em que a
  unidade tem PCQ > 0 E complemento > 0**; dias sem PCQ continuam "—".
- A **coluna TOTAL** da tabela de PCQ continua mostrando só as FORMAS (o
  complemento é indicado nos dias e no total do dia, como já era nas creches).
- Unidades **sem complemento configurado**: nenhum comportamento muda (nem na
  tabela de PF, nem na de PCQ).
- **Feriado/ajuste** zerando o PCQ do dia zera também o complemento
  (v9.8.7, inalterada) — nunca aparece "0 + PF 20".
- A página /romaneio **não tem mais lógica própria**: qualquer acesso cai em
  /producao. Mudanças futuras na folha do motorista são feitas SOMENTE na
  impressão da página de Produção.

## Arquivos do patch

| Arquivo | Mudança |
|---|---|
| `src/app/api/romaneio/route.ts` | **Ajuste 1**: pf_comp vai SEPARADO (agrupado no PCQ) para QUALQUER escola com complemento — removida a restrição creche/bifásica/interior |
| `src/app/(app)/producao/page.tsx` | **Ajuste 1**: formato "PCQ + PF XX" sem checagem de categoria + **Ajuste 2**: botão "Romaneio →" e import Link removidos |
| `src/lib/menu-config.ts` | **Ajuste 2**: item "Romaneio" removido do menu principal (desktop + mobile) |
| `src/app/(app)/dashboard/page.tsx` | **Ajuste 2**: card "Romaneio" e import Truck removidos |
| `src/app/(app)/romaneio/page.tsx` | **Ajuste 2**: página substituída por `redirect('/producao')` (código antigo no git) |

## Validação e commit

- Testes: `scripts/test-complemento-romaneio-v9109.ts` (45 asserts: ROTA REAL
  com db mockado — complemento separado p/ FUNDAMENTAL/CRECHE/INTERIOR, PF sem
  complemento somado, totais, PCQ zerado zera complemento; fonte do menu/
  botão/card/redirect; preservação v9.10.5–v9.10.8) + regressão completa
  sincronizada — todos verdes; `tsc --noEmit` 0 erros; `npm run build` OK.
- Sugestão de commit (rode na raiz do projeto, após conferir o build):
```bash
git add .
git commit -m "v9.10.9: PCQ + complemento agrupado ('X + PF YY') para todas as unidades na folha do motorista + página /romaneio inativada (menu, botão e card removidos; redirect para /producao; API ativa)"
git push
```

> `git add .` (a partir da raiz) já pega os arquivos sobrescritos pelo
> `unzip -o` e o `LEIA-ME.md` atualizado. Se quiser conferir antes:
> `git status` e `git diff --stat`.
