# Patch v9.9.5 — Nutrição > Cardápios: janela mais larga (fim do corte após "ing.") + barra de scroll visível + selecionadas sempre no topo

## 📦 Conteúdo do patch

| Arquivo | Mudança |
|---|---|
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Editor de cardápio — dialog de preparações (3 ajustes de UI) |

Sem mudança de schema (não precisa `prisma db push`).
Sem mudança de API.

## 🐛 1. Bug corrigido — "a janela está comendo as informações depois de 'ing.'"

**Causa raiz:** o `DialogContent` padrão do shadcn/ui traz `sm:max-w-lg` (512px). O
código antigo aplicava `max-w-2xl` (672px), mas essa classe **não vence** a
`sm:max-w-lg` do componente — em telas normais o dialog ficava com **512px de
largura real**. Com os badges novos do v9.9.4 (kcal, `N ing.`, "no cardápio"),
a linha estourava a largura e o flex cortava a direita: o nº de usos e o **lápis
de editar sumiam** (exatamente "as informações depois de ing.").

**Correção (3 frentes):**
- Dialog agora usa `sm:max-w-3xl` (**768px**) — ~50% mais largo, todas as
  informações cabem com folga.
- kcal + ingredientes + usos viraram um **cluster compacto** numa faixa só:
  `🔥 320 kcal · 8 ing. · 12×` (não quebra linha, não é cortado).
- Nome da preparação trunca com reticências e mostra o **nome completo no
  tooltip** ao passar o mouse.

## 📜 2. Barra de scroll na lista de preparações

- A lista usava o `ScrollArea` do Radix, cuja barra só aparece sutilmente (e de
  forma instável dentro do dialog flexível). Substituído por **scroll nativo
  (`overflow-y-auto`) com barra sempre visível**, estilizada: 10px, trilho
  cinza-claro, polegar arredondado — desliza com o mouse/roda sem sumir.
- Os cabeçalhos de categoria continuam **fixos (sticky)** durante a rolagem.
- O cabeçalho (título/filtros) e o rodapé (botões) ficam fixos: **só a lista
  rola**.

## 📌 3. Selecionadas sempre no topo, na ordem da lista

- Novo bloco fixo **"✔ Selecionadas (N) — sempre no topo, na ordem da lista"**
  no início da lista (fundo azulado, borda azul), mostrando TODAS as
  preparações selecionadas: as que já estão no cardápio (badge "no cardápio")
  e as que você marcar agora.
- A ordem dentro do bloco é a **mesma ordem da lista da biblioteca** (não a
  ordem de clique) — fácil de achar qualquer preparação.
- Os grupos por categoria abaixo **excluem as selecionadas** (nada aparece
  duplicado). Ao **desmarcar** uma no bloco do topo, ela volta imediatamente
  para o grupo da sua categoria.
- Se o filtro/busca atual só tiver preparações já selecionadas, aparece a nota
  "Todas as preparações do filtro atual já estão selecionadas (bloco acima)".
- O bloco atualiza em tempo real: marcou → sobe para o topo; desmarcou →
  desce para o grupo.

## 🚀 Como aplicar no Codespace

```bash
# 1. Extraia o zip na RAIZ do projeto (mesmo nível de package.json):
unzip -o patch-v9.9.5.zip

# 2. Não há migração de banco. Confira se o arquivo entrou no lugar:
git status

# 3. Validação local (opcional, recomendado):
npx tsc --noEmit
npm run build

# 4. Teste no navegador (npm run dev ou direto no preview):
#    Nutrição > Cardápios > abra um cardápio > "+ Adicionar" numa refeição:
#    ✓ Janela visivelmente mais larga; nada cortado após "ing."
#      (usos N× e lápis de editar aparecem em TODAS as linhas)
#    ✓ Barra de scroll sempre visível à direita da lista
#    ✓ Ao marcar/desmarcar, a preparação aparece/some do bloco
#      "Selecionadas (N)" no topo, na ordem da lista
#    ✓ Abrir numa refeição que já tem itens → bloco do topo já vem preenchido
#    ✓ Desmarcar uma "no cardápio" e salvar → remove normalmente (v9.9.4 intacto)

# 5. Commit e push (deploy Vercel automático):
git add .
git commit -m "v9.9.5: dialog preparações — largura corrigida + scroll visível + selecionadas sempre no topo"
git push
```

## ✅ Validação executada antes da entrega

- `npx tsc --noEmit` → 0 erros
- `npm run build` (Next.js completo) → OK, sem erros de tipo
- `scripts/test-cardapio-dialog-v995.ts` → 16/16 testes de lógica: ordem da
  lista no bloco do topo, exclusão das selecionadas dos grupos, volta ao grupo
  ao desmarcar, casos de borda do filtro e verificação estrutural do JSX
  (largura `sm:max-w-3xl`, scroll nativo, cluster compacto).

## 📝 Notas

- Nenhuma regra do v9.9.4 mudou: modo editar (reabrir mostra o que já está no
  slot), diff +N/−N no botão, remoção com marcação de semana "Modificada" —
  tudo preservado; a mudança foi apenas de layout/organização visual.
- O restante do sistema (produção, PCQ, lista de compra) não foi tocado.
- Sobre a INTEGRAL (2 refeições/dia): mantido como está, conforme combinado.
