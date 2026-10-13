# Patch v9.10.8 — Brasão da Prefeitura como marca d'água na impressão do cardápio

> **Arquivo:** `patch-v9.10.8.zip` · **Requisito:** aplicar por cima da
> **v9.10.7** (sem mudanças de banco — nada de `prisma db push` nesta versão).

**O que resolve:**

Na impressão do cardápio (Nutrição → Cardápios → PDF), as folhas saíam sem
nenhuma identificação visual da Prefeitura além do cabeçalho. Este patch
adiciona o **brasão de Lucas do Rio Verde como marca d'água no fundo de cada
página impressa do cardápio**, sutil o suficiente para não atrapalhar a leitura
do conteúdo.

1. **Todas as páginas** recebem o brasão: tanto no modo **Semana** (1 folha)
   quanto no **Semestral** (uma folha por semana — o brasão se repete em cada
   uma delas automaticamente).
2. **Centrado na folha**, com cerca de 13 cm de largura e **opacity 8%** —
   aparece como um carimbo claro no fundo da folha; o cardápio continua 100%
   legível (incluindo em impressão preto e branco).
3. **Não atrapalha em nada**: é apenas uma imagem decorativa (`pointer-events:
   none`, invisível na tela — só existe na impressão), não muda texto, números,
   nutrientes, alérgenos, layout, escala/zoom nem paginação.
4. Usa um **PNG com fundo transparente** (`/brasao-marca-dagua.png`, derivado
   do brasão oficial): só os traços do brasão são carimbados — sem véu
   retangular sobre tabelas ou sobre o cabeçalho escuro.
5. **Só no cardápio**: as impressões de Produção e Romaneio não mudam (o
   cabeçalho delas continua com o brasão colorido original `/brasao.jpg`).

## Ordem de aplicação (GitHub Codespace)

Com o terminal aberto **na raiz do projeto** (pasta que contém `package.json`),
envie o arquivo `patch-v9.10.8.zip` para dentro dela e rode:

```bash
# 1) Extrai por cima, sobrescrevendo os arquivos (o PNG novo é criado):
unzip -o patch-v9.10.8.zip

# 2) Esta versão NÃO altera o schema — NÃO precisa de `prisma db push`.

# 3) Gere o build e reinicie:
npm run build
npm run start   # ou o supervisor de sempre
```

> O `unzip -o` substitui `print.css` e `pdf/page.tsx`, cria o
> `public/brasao-marca-dagua.png` e deixa o `LEIA-ME.md` na raiz com o
> histórico desta versão.

## Como conferir

1. Abra **Nutrição → Cardápios → (um cardápio) → PDF**.
2. Clique em **Imprimir / Salvar PDF**: o brasão aparece centrado, claro, no
   fundo de cada folha — atrás do conteúdo, sem cobrir nada.
3. Troque para o modo **Semestral** e confira: TODAS as semanas saem com a
   marca d'água.
4. Na tela (fora da impressão) nada muda — a marca d'água só existe no papel/PDF.
5. Imprima uma **Produção** e confirme que ela continua exatamente como antes
   (a marca d'água é exclusiva do cardápio).

### Regras de negócio

- A marca d'água é **estática e decorativa**: não aparece na tela, não entra
  nos dados, não afeta escala de impressão, nutrientes, alérgenos ou paginação.
- Opacidade/tamanho ficam em `src/app/print.css` (`.cardapio-watermark`):
  `opacity: 0.08` e `width: 130mm`. Para deixar mais clara/escura ou maior/
  menor, basta ajustar esses dois valores.
- O elemento é um único `<img position:fixed>` fora do `.semana-page` — por
  isso **não herda o zoom** da escala de impressão (v9.5.5) e o navegador o
  **repete em todas as folhas** automaticamente (Semana e Semestral).
- O `public/brasao.jpg` original permanece intacto (cabeçalho da impressão de
  Produção) — a marca d'água usa o novo `public/brasao-marca-dagua.png`.

## Arquivos do patch

| Arquivo | Mudança |
|---|---|
| `public/brasao-marca-dagua.png` | **NOVO** — brasão em traços transparentes (1200×1031, RGBA, derivado do `brasao.jpg` oficial) |
| `src/app/print.css` | Classe `.cardapio-watermark`: escondida na tela; na impressão, `position:fixed` centrada, 130mm, opacity 8%, `pointer-events:none`, z-index máximo |
| `src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx` | `<img class="cardapio-watermark">` único, fora do `.semana-page` (não herda o zoom; vale p/ Semana e Semestral) |

## Validação e commit

- Testes: `scripts/test-marca-dagua-v9108.ts` (47 asserts: asset RGBA com
  transparência real, posicionamento FORA do SemanaPrintPage, regras CSS,
  exclusividade no cardápio, preservação v9.10.5/6/7, simulador de paginação)
  + regressão completa v9.9.x→v9.10.7 — todos verdes; `tsc --noEmit` 0 erros;
  `npm run build` OK.
- Sugestão de commit (rode na raiz do projeto, após conferir o build):
```bash
git add .
git commit -m "v9.10.8: brasão da Prefeitura como marca d'água na impressão do cardápio (todas as páginas, centrado, opacity 8%, PNG transparente; sem afetar Produção/Romaneio nem a tela)"
git push
```

> `git add .` (a partir da raiz) já pega os arquivos sobrescritos pelo
> `unzip -o`, o PNG novo e o `LEIA-ME.md` atualizado. Se quiser conferir
> antes: `git status` e `git diff --stat`.
