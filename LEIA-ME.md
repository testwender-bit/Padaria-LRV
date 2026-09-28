# Patch v9.9.7 — Nutrição > Cardápios: "Localizar" separado do "Substituir" (com navegação por clique)

## 📦 Conteúdo do patch

| Arquivo | Mudança |
|---|---|
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Editor de cardápio — botões separados + novo dialog "Localizar" com navegação |

Sem mudança de schema (não precisa `prisma db push`).
Sem mudança de API — continua usando a rota existente `/api/nutricao/cardapios/[id]/localizar-substituir` (GET).

## 🎯 O que mudou

Você pediu para **separar as funções**: substituir funciona bem, mas só localizar (para achar ONDE
uma preparação está) não era prático. Agora são **dois botões independentes** na barra superior do
editor do cardápio:

### 🔍 Botão "Localizar" (azul) — NOVO, somente consulta
- Digite o nome da preparação (mín. 2 letras, debounce 350ms) → busca em **todas as 22 semanas**.
- Cada preparação encontrada vira um card com **2 badges**:
  `6 ocorrências` e `3 sem.` (nº de **semanas distintas** em que aparece).
- Clique no card → expande a lista de **todas as ocorrências**: `S05 · Segunda · Almoço`.
- **Clique na ocorrência (Ir →)** → o dialog fecha, a tela **pula para aquela semana**, rola até o
  item e o **destaca com um ring âmbar por ~6 segundos**.
- Se a busca casar com **1 preparação só**, as ocorrências já abrem expandidas automaticamente.
- No mobile, além da semana, o **dia clicado é selecionado** no visualizador de 1 dia por vez.
- Se você clicar em outra ocorrência rapidamente (ex.: reabrindo o dialog), o destaque anterior é
  cancelado limpo — nada de piscar ou apagar cedo demais.

### 🔄 Botão "Substituir" (âmbar) — mesmo fluxo de antes, só renomeado
- Exatamente o dialog do v9.9.6 (localizar → marcar ocorrências → escolher substituta → lote ou
  parcial), com o título agora sendo **"Substituir Preparação"**.
- Proteções preservadas: substituta igual à original bloqueada, duplicata nunca fica no slot
  (servidor remove), semanas marcadas como "Modificada".

## 💡 Detalhes técnicos

- `irParaOcorrencia(o)`: `setCurrentSemana(o.semana_num)` + `setMobileDayView` (só mobile) +
  destaque por `item_id` + `scrollIntoView({ behavior: 'smooth', block: 'center' })` após 250ms
  (espera o React re-renderizar a semana) + limpeza do destaque após 6s.
- Timers guardados em `useRef` e limpos a cada navegação (evita corrida entre destaques).
- Linha do item no cardápio ganhou `id={cardapio-item-${item.id}}` (âncora do scroll) e classe de
  destaque condicional (ring âmbar), sem afetar drag-and-drop existente.
- Nenhuma alteração em produção, PCQ, romaneio ou Lista de Compra. v9.9.4/v9.9.5/v9.9.6 intactos.

## 🚀 Como aplicar no Codespace

```bash
# 1. Extraia o zip na RAIZ do projeto (mesmo nível de package.json):
unzip -o patch-v9.9.7-localizar-preparacao.zip

# 2. Não há migração de banco nem rota nova. Confira:
git status

# 3. Validação local (opcional, recomendado):
npx tsc --noEmit
npm run build
```

## ✅ Roteiro de teste

1. Abra **Nutrição > Cardápios > [um cardápio]**.
2. Na barra superior, confira os **2 botões**: "Localizar" (azul) e "Substituir" (âmbar).
3. **Localizar**: digite "arroz" (ou outra preparação que você sabe que existe) → veja os cards com
   `N ocorrências · M sem.` → clique num card → clique numa ocorrência `S12 · Quarta · Almoço` →
   a tela deve pular para a Semana 12 com o item **destacado em âmbar**.
4. No mobile (ou janela estreita): repita — deve pular para a semana E para o dia certo.
5. Busca que casa com 1 preparação só → lista de ocorrências já vem aberta.
6. **Substituir**: fluxo igual ao de sempre (renomeado) — substituição em lote e parcial funcionando.
