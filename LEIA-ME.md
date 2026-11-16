# Patch v9.10.15 — Feriado no DOMINGO não cancela mais o Pão Complemento de segunda (Seg Mad)

> **Arquivo:** `patch-v9.10.15.zip` · **Requisito:** aplicar por cima da
> **v9.10.14** · ✅ **SEM mudança de schema** — não precisa `prisma db push`.

**O bug (com dados reais de 15/11/2026):** o feriado "Proclamação da
República" caiu no **domingo 15/11** e o sistema cancelou **todo o pão
complemento de segunda-feira das creches** — sumiu da produção, da impressão
da produção e da guia de separação. Na ficha do motorista, porém, a
quantidade continuava certa ("2 + PF x" no PCQ). Produção e romaneio
divergiam.

**Causa raiz:** o PF Complemento do bloco de "domingo" tinha um check extra
de feriado no **dia de produção (domingo)**. Mas desde a v9.7.3 esse bloco é
a **MADRUGADA DE SEGUNDA** ("Seg Mad") — a padaria não produz mais no
domingo. Feriado no domingo não cancela nada; o que cancela o complemento de
segunda é **feriado na segunda** (ou PCQ zerado por ajuste). O pão francês
comum nunca teve esse check (só checa a entrega) — por isso ele não sumiu. E
o romaneio sempre checou só a entrega — por isso ficou certo.

**A correção (1 arquivo: `src/app/api/producao/route.ts`):**

1. Removido o check de feriado no domingo para o complemento de segunda.
   Agora ele checa **apenas o dia de entrega (segunda)** — igual ao pão comum
   do mesmo bloco e igual à ficha do motorista. Com feriado no domingo, o
   complemento de segunda aparece normalmente na produção, na impressão e na
   guia de separação (manhã/tarde), batendo com o romaneio.
2. **O que continua zerando (regressões verificadas por teste):**
   - Feriado na **segunda**: pão comum, complemento e PCQ de segunda zerados
     (escolas não recebem);
   - **PCQ zerado por ajuste manual** → complemento zerado junto (regra
     v9.8.7 intacta);
   - Feriado na **terça/quinta**: complemento de **quarta/sexta** continua
     zerado (esses blocos são produzidos de verdade na terça/quinta — check
     de produção mantido).

**Intocadas:** folha de PCQ, romaneio dos motoristas, guia de separação
(1ª via, matriz manhã/tarde), telas Semanal/Por Dia, schema do banco.

## Ordem de aplicação (GitHub Codespace)

Com o terminal aberto na pasta do projeto:

```bash
unzip -o patch-v9.10.15.zip
npm run build
npm run start
```

Confirmação rápida: semana do **16/11/2026** em Produção → o complemento de
segunda das creches (ex.: "0 + 10") volta a aparecer no bloco de domingo e na
guia de separação (coluna Seg do bloco TARDE), igual à ficha do motorista.
Sem `db push`, sem migração.

Para registrar no git:

```bash
git add . && git commit -m "v9.10.15" && git push
```
