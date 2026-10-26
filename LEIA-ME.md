# Patch v9.10.11 — Padrão do complemento na folha de produção ("0 + x" + totais limpos)

> **Arquivo:** `patch-v9.10.11.zip` · **Requisito:** aplicar por cima da
> **v9.10.10** (sem mudanças de banco — nada de `prisma db push` nesta versão).

**O que resolve (2 refinamentos no formato da v9.10.10):**

Refino do desdobramento do Pão Complemento na folha **PRODUÇÃO — PÃO FRANCÊS**
(1ª e 2ª vias), para um **padrão claro** em todas as células e totais limpos:

1. **Escola cujo pão vem SÓ do complemento (base 0 — ex.: creches)** agora
   mostra **"0 + x"** (ex.: **"0 + 10"** = 10 de complemento, nada da base).
   Antes a v9.10.10 mostrava só o número ("10") quando não havia pão base;
   agora TODA célula com complemento segue o mesmo padrão
   **base + complemento**.
2. **Coluna TOTAL da escola voltou à somatória pura** (ex.: **"560"**) —
   não mostra mais "+ 50". O desdobramento fica nas células do dia, onde é
   útil para a produção.
3. **Linha TOTAL GERAL também ficou limpa**: totais do dia (ex.: **"1.200"**)
   e total da semana (ex.: **"8.060"**) em soma pura, sem "+ x" — para não
   poluir os totais.
4. **Célula do dia com base + complemento continua igual à v9.10.10**:
   ex. **"100 + 30"** (soma 130 — nada mudou nos valores, só na apresentação).
5. Vale para **TODAS as escolas** (creche, fundamental, interior — qualquer
   uma) e para as **duas vias** da impressão (1ª e 2ª).
6. **Escolas sem complemento não mudam NADA** (número puro, como sempre) e
   dia sem produção continua com "—".
7. **A tela (view Semanal/Por Dia) continua igual** — o formato separado é só
   na folha impressa.
8. Regras preservadas: v9.10.9 (formato "X + PF YY" na folha do motorista —
   PCQ), v9.8.7 (PCQ zerado por ajuste/feriado zera o complemento), extras de
   instituições avulsas sem complemento saem como sempre.

## Ordem de aplicação (GitHub Codespace)

Com o terminal aberto **na raiz do projeto** (pasta que contém `package.json`),
envie o arquivo `patch-v9.10.11.zip` para dentro dela e rode:

```bash
# 1) Extrai por cima, sobrescrevendo os arquivos:
unzip -o patch-v9.10.11.zip

# 2) Esta versão NÃO altera o schema — NÃO precisa de `prisma db push`.

# 3) Gere o build e reinicie:
npm run build
npm run start   # ou o supervisor de sempre
```

## Como conferir

1. Abra **Produção** → **Imprimir**. Na folha **PRODUÇÃO — PÃO FRANCÊS (1ª
   via)**:
   - Escola com base + complemento: dia mostra **"100 + 30"**.
   - Creche (ou qualquer unidade) que recebe pão **só** do complemento: dia
     mostra **"0 + 10"**.
   - Coluna **TOTAL** da escola: **"560"** (soma pura, sem "+ 50").
   - Linha **TOTAL GERAL**: **"1.200"** no dia e **"8.060"** na semana (soma
     pura).
2. A **2ª via** (página seguinte) mostra exatamente o mesmo formato.
3. Escolas **sem** complemento continuam com o número puro (ex. **"150"**).
4. A folha do motorista (PCQ, no fim da impressão) continua com o formato
   "2 + PF 20" da v9.10.9 — nada mudou lá.
