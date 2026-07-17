# Fix v9.5.3 — Retrato OBRIGATÓRIO + Brasão sem caixa + Renumerar

## 1. Impressão sempre RETRATO (corrigido)

### Problema

A impressão da página de Produção estava saindo em **paisagem** (landscape)
em vez de retrato (portrait).

### Causa raiz

No `print.css`, havia DUAS regras `@page` dentro de `@media print`:

```css
/* linha 22 — topo do arquivo */
@page { size: A4 portrait; ... }

/* linha 768 — dentro do bloco "CARDÁPIO NUTRICIONAL — A4 PAISAGEM" */
@page { size: A4 landscape; ... }
```

`@page` em CSS **não pode ser scoped por seletor** — é sempre global.
Quando há múltiplas regras `@page`, a última vence (ordem do arquivo).
Como a regra `landscape` vinha depois da `portrait`, ela sobrescrevia a
orientação para TODAS as páginas, incluindo produção.

### Fix

Usado o recurso de **named pages** do CSS:

```css
@page { size: A4 portrait; ... }              /* default — todas as páginas */
@page landscape_cardapio {                    /* named page — só quando ativada */
  size: A4 landscape;
  margin: 4mm;
}

.semana-page { page: landscape_cardapio; }    /* ativa só no cardápio */
```

Agora produção/romaneio usam o default (retrato), e o cardápio continua
saindo em paisagem como antes.

## 2. Brasão sem caixa quadrada (corrigido)

### Problema

A imagem do brasão da prefeitura aparecia dentro de um quadrado com borda
preta, em vez de aparecer sozinha.

### Causa raiz

A classe `.print-doc-logo` tinha:
```css
width: 8mm;
height: 8mm;
border: 1.5pt solid #000;
```

Essa classe foi originalmente criada para uma letra "P" (logo textual) —
quando migrou para `<img>`, a borda ficou em volta da imagem.

### Fix

Atualizada a classe para:
- Sem borda (`border: none`)
- Altura de 12mm (proporcional ao header)
- Largura automática (respeita aspect ratio do brasão)

E adicionada regra específica para `img` dentro de `.print-doc-logo`:
```css
.print-doc-logo img {
  height: 12mm !important;
  width: auto !important;
  object-fit: contain !important;
  border: none !important;
  background: transparent !important;
}
```

O brasão agora aparece **sozinho, sem caixa**, no tamanho correto.

## 3. Botão "Renumerar" na tela de Configurações

### Contexto

Você notou que **números negativos funcionavam** mas **positivos não
pareciam ter efeito**. Isso acontecia porque a maioria das escolas estava
com `ordem_rota = 0` (default). Quando você mudava uma para `3`, ela ia
para depois do grupo de 0s — mas como todas as outras continuavam em 0,
a mudança parecia sutil. Já com `-1`, a escola ia para ANTES de todos os
0s, sendo uma mudança dramática e visível.

A ordenação v9.5.2 **está funcionando corretamente** — você validou isso
com o teste dos negativos.

### Solução

Adicionado botão **"Renumerar"** na aba Escolas em Configurações:

- Clica no botão → confirma
- O sistema agrupa as escolas por rota (José, Aroldo, Busca Própria,
  Outros)
- Dentro de cada rota, ordena por nome curto (alfabético)
- Atribui números sequenciais: 1, 2, 3, 4, ... (sem zeros, sem repetição)
- Salva todas via PUT em paralelo
- Recarrega a lista

Resultado: **cada escola tem um número único dentro de sua rota**.
Agora quando você quiser reordenar, basta trocar dois números (ex.: a
escola 3 vira 5, a 5 vira 3) e a ordem será exatamente a que você definiu.

### Display do número na produção

A tabela de produção agora mostra o número da ordem_rota ao lado do nome
da escola (em cinza claro, sutil):

```
1  CEI Anjo Gabriel
2  CEI Aquarela
3  CEI Balão Mágico
...
```

Isso permite **ver imediatamente** qual número cada escola tem, sem
precisar ir até Configurações.

## Arquivos incluídos

```
src/app/print.css                                       # named pages + brasão sem caixa
src/app/(app)/producao/page.tsx                         # mostra ordem_rota ao lado do nome
src/app/(app)/configuracoes/page.tsx                    # botão Renumerar
src/app/api/escolas/route.ts                            # orderBy + nome_curto tie-breaker
src/app/api/producao/route.ts                           # 5× ordem_rota
src/app/api/romaneio/route.ts                           # ordem_rota + sort
src/lib/producao-utils.ts                               # ItemProducao.ordem_rota obrigatório
src/lib/producao-semana-utils.ts                        # sem as any
src/lib/romaneio-utils.ts                               # EscolaRomaneio.ordem_rota
```

## Como aplicar

```bash
# Na RAIZ do projeto:
unzip -o patch-portrait-brasao-renumerar-v9.5.3.zip -d .

git add -A
git commit -m "fix(v9.5.3): retrato obrigatório + brasão sem caixa + botão renumerar"
git push
```

## Verificação

1. **Produção → Imprimir (Ctrl+P)** → deve abrir em **RETRATO** (A4 portrait).
2. **Brasão da prefeitura** aparece **sozinho, sem borda quadrada** no
   canto superior esquerdo do cabeçalho.
3. **Cardápio nutricional → Imprimir** → continua em **PAISAGEM** como
   antes (não quebrou).
4. **Configurações → Escolas** → aparece um botão azul **"Renumerar"**
   no topo da lista. Clique para atribuir 1, 2, 3... a todas as escolas
   automaticamente.
5. **Página de Produção** → cada escola agora mostra seu número de ordem
   em cinza claro antes do nome. Confira se está na ordem que você
   definiu.
6. Para reordenar duas escolas: vá em Configurações, edite uma, troque
   o número, salve. Volte para Produção e a ordem vai estar trocada.
