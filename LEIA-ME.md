# Fix v9.5.5 — Cardápio: título centralizado + página em branco + escala configurável

## 1. Título "SECRETARIA MUNICIPAL..." centralizado e em branco

### Problema

> "O título 'SECRETARIA MUNICIPAL DE EDUCAÇÃO DE LUCAS DO RIO VERDE - MT'
> na impressão está descentralizado e não aparece em fonte branca normal."

### Causa

O cabeçalho `.sp-header` usava `display: flex` com `justify-content:
space-between` e 3 elementos filhos (título, metadados, semana). Isso
deixava o título à esquerda, não centralizado.

Além disso, `.sp-meta-item` tinha `color: #666 !important` (cinza escuro)
e `.sp-meta-divider` tinha `color: #333 !important` — em fundo `#111`
escuro, ficavam **ilegíveis**.

### Fix

- `.sp-header` agora usa `flex-direction: column` + `align-items: center`
  + `justify-content: center` + `text-align: center` — todos os elementos
  ficam centralizados verticalmente empilhados.
- `.sp-title` agora tem `text-align: center`, `display: block`,
  `width: 100%` — ocupa toda a largura e centraliza o texto.
- `.sp-meta-item`, `.sp-meta-item strong`, `.sp-meta-divider` agora têm
  `color: #fff !important` — tudo branco no fundo escuro, legível.
- `.sp-header-meta` e `.sp-header-week` agora têm `justify-content: center`
  — metadados e semana também ficam centralizados.

## 2. Página 23 em branco eliminada

### Problema

> "está criando uma página 23 em branco sendo que o conteúdo acaba na 22"

### Causa

A regra `.semana-page { page-break-after: always }` força uma quebra de
página DEPOIS de cada semana. A regra `:last-child { page-break-after:
auto }` deveria cancelar isso na última, mas com **named pages**
(`page: landscape_cardapio`), o Chrome às vezes agenda a quebra antes
de processar a regra `:last-child`, criando uma página final em branco.

### Fix

- Adicionada a classe `.last-week` (além de `:last-child`) — aplicada
  explicitamente à ÚLTIMA semana via prop `isLast` no React.
- A regra agora é:
  ```css
  .semana-page:last-child,
  .semana-page.last-week {
    page-break-after: auto !important;
    break-after: auto !important;
  }
  ```
  O `!important` + `break-after` (modern CSS) força o cancelamento
  mesmo com named pages.

## 3. Escala de impressão configurável por cardápio

### Problema

> "quando vou salvar o cardápio de algumas escolas eu gosto de mudar a
> escala do cardápio para maior... o problema é que para conseguir mexer
> na escala não posso salvar o PDF comum, tenho que usar recurso como
> 'microsoft print to pdf' porém isso causa um problema no arquivo PDF
> além de parecer que ele fica mal estruturado o PDF fica irreconhecível
> as escrita como ficaria reconhecível no recurso 'salvar pdf'."

### Solução

Adicionei um **controle de escala (zoom) diretamente na página de PDF
do cardápio** — não precisa mais usar "Microsoft Print to PDF".

#### Como funciona

1. Na página `/nutricao/cardapios/[id]/pdf`, aparece um controle deslizante
   (slider) **Escala: [70% — 150%]** na barra superior.
2. O usuário ajusta a escala (ex.: 130% para escolas com poucas
   preparações, 95% para creches com muitas preparações).
3. A pré-visualização na tela mostra o resultado em tempo real (via
   CSS `zoom`).
4. Clica em **Salvar** — a escala é persistida no cardápio (campo
   `escala_impressao` no banco).
5. Clica em **Imprimir / Salvar PDF** — o Chrome abre o diálogo de
   impressão nativo, com a escala já aplicada. O usuário pode usar
   **"Salvar como PDF"** (não "Microsoft Print to PDF") — o PDF
   resultante tem **texto reconhecível** (pesquisável, selecionável,
   copiável) e preserva a qualidade visual.

#### Por que isso resolve o problema do "Microsoft Print to PDF"

- O **"Salvar como PDF"** do Chrome gera PDF vetorial com texto
  selecionável.
- O **"Microsoft Print to PDF"** rasteriza (transforma em imagem),
  por isso o texto fica irreconhecível.
- Antes, o usuário era forçado a usar o "Microsoft Print to PDF"
  porque o "Salvar como PDF" não permitia ajustar a escala no
  diálogo de impressão.
- Agora, com a escala configurada **no sistema** (não no diálogo
  de impressão), o "Salvar como PDF" funciona perfeitamente com a
  escala desejada.

#### Valores típicos

- **95%** — Creches com muitas preparações (cabe tudo numa página)
- **100%** — Default (maioria das escolas)
- **110-120%** — Escolas com preparações medianas
- **130%** — Escolas com poucas preparações (aproveita melhor a página)

#### Persistência

A escala é salva no campo `escala_impressao Int @default(100)` do
model `CardapioNutricional`. Cada cardápio tem sua própria escala,
que persiste entre sessões. Ao editar o cardápio novamente, a escala
salva é carregada automaticamente.

## Arquivos incluídos

```
add-escala-impressao.sh                                      # script que adiciona APENAS o campo (preserva Postgres)
src/app/print.css                                             # header centralizado + branco + página em branco
src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx            # slider de escala + aplica zoom + isLast
src/app/api/nutricao/cardapios/[id]/route.ts                  # PATCH aceita escala_impressao
```

## Como aplicar

```bash
# 1. Extraia o patch:
unzip -o patch-cardapio-print-v9.5.5.zip -d .

# 2. Rode o script para adicionar APENAS o campo escala_impressao
#    (não substitui o schema, preserva seu Postgres):
bash add-escala-impressao.sh

# 3. Rode prisma db push para criar a coluna no banco:
npx prisma db push

# 4. Commit e push:
git add -A
git commit -m "fix(v9.5.5): cardápio título centralizado + página em branco + escala configurável"
git push
```

## Verificação

1. Acesse **Nutrição → Cardápios → [um cardápio] → PDF**.
2. **Título** (ex.: "SECRETARIA MUNICIPAL DE EDUCAÇÃO DE LUCAS DO RIO
   VERDE - MT") deve aparecer **centralizado** no cabeçalho escuro,
   com **fonte branca legível** (todos os metadados também brancos).
3. **Controle de Escala** aparece na barra superior (slider 70-150%).
   Ajuste para 130% e veja a pré-visualização crescer.
4. Clique em **Salvar** para persistir a escala.
5. Clique em **Imprimir / Salvar PDF**:
   - No diálogo do Chrome, escolha **"Salvar como PDF"** (NÃO
     "Microsoft Print to PDF").
   - O PDF gerado terá a escala aplicada e o texto será **reconhecível**
     (pesquisável, selecionável).
6. Para cardápios semanal/semestral, **não deve mais aparecer uma
   página em branco no final**.

## Nota técnica sobre o `zoom` CSS

Usei a propriedade `zoom` (não `transform: scale()`) porque:
- `zoom` afeta o layout (o conteúdo reflowe e ocupa o espaço
  proporcional, sem overflow).
- `transform: scale()` apenas redimensiona visualmente sem reflow
  (deixaria buracos ou cortes).
- `zoom` é suportado em todos os navegadores modernos (Chrome 124+,
  Firefox 126+, Safari 17+).
