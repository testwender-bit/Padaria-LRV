# Patch v9.10.12 — Decimais no ajuste de PCQ/Inst. Extra + produção excepcional direto no "Por Dia"

> **Arquivo:** `patch-v9.10.12.zip` · **Requisito:** aplicar por cima da
> **v9.10.11** · ⚠️ **ESTA VERSÃO MUDA O SCHEMA — o `prisma db push` é
> OBRIGATÓRIO** (primeira mudança de banco desde a v9.7.x; sem perda de dados).

**O que resolve (2 ajustes):**

1. **Ajuste de PCQ aceita DECIMAIS** (ex.: **0,5 forma**). Antes o campo
   cortava com parseInt: digitou "0,5" virava **0**. Aceita vírgula OU ponto
   ("0,5" / "0.5"), no ajuste de qualquer produto — e também no
   **Inst. Extra** (produção extra de pão/lanches), que tinha o mesmo corte.
   Para isso o banco passou a guardar esses valores como **número decimal
   (Float)**: `Ajuste.qtd_original/ajuste/qtd_final` e
   `ProducaoExtra.quantidade`. Registros inteiros antigos continuam válidos —
   nada é perdido.
2. **View POR DIA mostra escolas com PCQ habilitado mesmo em dias sem
   produção padrão** (terça/quinta): a escola aparece com quantidade **"—"** e
   o selo **"Excepcional"** — clicando em **Ajustar** você programa a produção
   excepcional da hora (ex.: PCQ na quinta para um evento). Ao salvar, a
   escola some da lista de "excepcionais" e entra como produção normal
   (mecanismo da v9.10.4). A **view Semanal continua filtrando como está** —
   nada muda lá.

**Preservado:** dias padrão (seg/qua/sex) continuam listando todas as escolas
elegíveis como sempre; escolas sem PCQ habilitado não aparecem; v9.10.4
(itens excepcionais só quando existe ajuste) intacta; v9.10.9/v9.10.10/
v9.10.11 (formatos de impressão) intactas.

## Ordem de aplicação (GitHub Codespace)

Com o terminal aberto **na raiz do projeto** (pasta que contém `package.json`),
envie o arquivo `patch-v9.10.12.zip` para dentro dela e rode:

```bash
# 1) Extrai por cima, sobrescrevendo os arquivos:
unzip -o patch-v9.10.12.zip

# 2) ⚠️ OBRIGATÓRIO NESTA VERSÃO — aplica a mudança de schema (Int → Float):
npx prisma db push

# 3) Gere o build e reinicie:
npm run build
npm run start   # ou o supervisor de sempre
```

> O `prisma db push` ajusta as colunas de `Ajuste` e `ProducaoExtra` para
> número decimal e já atualiza o Prisma Client. É seguro: é um alargamento de
> tipo (inteiro → decimal), os dados existentes não são tocados.

## Como conferir

1. **Produção** → clique numa célula/forma de PCQ → **Ajustar** → digite
   **0,5** → o Delta mostra **"+0,5"** → salvar. Na lista a escola mostra
   **0,5** formas.
2. **Inst. Extra** → adicionar produção extra → Quantidade **0,5** com produto
   Pão de Cachorro Quente → salvar → entra no romaneio com 0,5.
3. **Produção → Por Dia → Quinta**: as escolas com PCQ habilitado aparecem
   com **"—"** e o selo **"Excepcional"**. Clique em **Ajustar**, digite a
   quantidade (ex. **2**) e salve: a linha vira produção normal da quinta.
4. **View Semanal**: continua mostrando apenas o que sempre mostrou (nada
   mudou).
