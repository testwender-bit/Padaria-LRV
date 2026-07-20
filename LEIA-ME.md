# Fix v9.5.6 — Cabeçalho do cardápio em UMA linha + Secretaria centralizada

## O que mudou

Ajuste fino do cabeçalho do PDF do cardápio conforme solicitado.

### Antes (v9.5.5)

```
┌─────────────────────────────────────────────────────────────┐
│ Cardápio Paulo Freire - 2º semestre de 2026                 │ ← título
│ Escola: CEI Paulo Freire • Categoria: REGULAR • Fase: ...   │ ← meta (3 linhas)
│ Semana 1  20/07 — 24/07                                     │ ← semana
└─────────────────────────────────────────────────────────────┘
```

Cabeçalho em 3 linhas, com metadados Escola/Categoria/Fase.

### Depois (v9.5.6)

```
┌─────────────────────────────────────────────────────────────┐
│ Cardápio Paulo Freire  SECRETARIA MUNICIPAL...   Semana 1   │
│                       DE EDUCAÇÃO DE LUCAS      20/07—24/07 │
└─────────────────────────────────────────────────────────────┘
```

Cabeçalho em **uma linha só**, com:
- **Esquerda**: título do cardápio (`Cardápio Paulo Freire - 2º semestre de 2026`)
- **Centro**: `SECRETARIA MUNICIPAL DE EDUCAÇÃO DE LUCAS DO RIO VERDE - MT`
- **Direita**: Semana + datas (`Semana 1  20/07 — 24/07`)
- Tudo em **branco**, **uppercase** para a Secretaria, **elegante**

## Detalhes técnicos

### Layout

- `.sp-header` agora é `flex-direction: row` + `justify-content: space-between`
  + `flex-wrap: nowrap` + `white-space: nowrap` — **uma linha só**, sem
  quebra.
- `.sp-header-brand` (título): `max-width: 45%`, com `overflow: hidden`
  + `text-overflow: ellipsis` — se o título for muito longo, mostra
  reticências em vez de quebrar.
- `.sp-header-meta` (centro): `flex: 1` + `justify-content: center` —
  ocupa o espaço central e centraliza o texto.
- `.sp-header-week` (direita): `flex-shrink: 0` + `justify-content: flex-end`.

### Nova classe `.sp-secretaria`

- `font-size: 8pt` (print) / `13px` (screen) — compacto mas legível.
- `font-weight: 600` — seminegrito para destacar.
- `color: #fff` — **branco**.
- `text-transform: uppercase` — tudo maiúsculo para destaque.
- `letter-spacing: 0.3pt` — espaçamento elegante.
- `text-align: center` — centralizado no espaço do meio.
- `white-space: nowrap` — não quebra linha.

### Substituição do conteúdo

O conteúdo do `.sp-header-meta` (que antes mostrava Escola/Categoria/Fase)
agora mostra **apenas** o texto fixo da Secretaria:

```jsx
<div className="sp-header-meta">
  <span className="sp-secretaria">
    Secretaria Municipal de Educação de Lucas do Rio Verde - MT
  </span>
</div>
```

## Arquivos incluídos

```
src/app/print.css                                             # header uma linha + .sp-secretaria
src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx            # substitui meta por .sp-secretaria
```

## Como aplicar

```bash
# Na RAIZ do projeto:
unzip -o patch-cardapio-header-v9.5.6.zip -d .

git add -A
git commit -m "fix(v9.5.6): cabeçalho do cardápio em uma linha + Secretaria centralizada"
git push
```

## Verificação

1. Acesse **Nutrição → Cardápios → [um cardápio] → PDF**.
2. O cabeçalho deve aparecer em **uma linha só**:
   - Esquerda: título do cardápio (ex.: `Cardápio Paulo Freire - 2º semestre de 2026`)
   - Centro: `SECRETARIA MUNICIPAL DE EDUCAÇÃO DE LUCAS DO RIO VERDE - MT`
   - Direita: `Semana 1  20/07 — 24/07`
3. Tudo em **branco**, legível, elegante.
4. Na impressão (Ctrl+P → Salvar como PDF), o cabeçalho mantém o
   mesmo layout de uma linha.
5. O controle de **Escala** (slider 70-150%) continua funcionando.
6. A **página em branco final** continua eliminada.

## Notas

- A escala de impressão (v9.5.5) e a eliminação da página em branco
  (v9.5.5) continuam funcionando — apenas o cabeçalho mudou.
- Se o título do cardápio for muito longo, ele mostra reticências
  (`...`) em vez de quebrar — mantém a linha única.
- A Secretaria aparece em **maiúsculas** (`text-transform: uppercase`)
  para destaque visual, mas o texto no código é em maiúsculas e
  minúsculas (preserva acentos).
