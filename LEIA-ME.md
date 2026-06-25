# Patch v8.10 — Replicar Cardápio de Escola + Remover "Tornar em Base"

## O que muda
1. **Removido o botão "Transformar em Base"** do editor de cardápio.
   - Antes: um cardápio vinculado a uma escola podia ser transformado em modelo base
     (escola_id = null), o que quebrava o vínculo com a escola original.
   - Agora: esse botão não existe mais. O cardápio permanece vinculado à escola.

2. **"Replicar p/ Escolas" agora funciona para qualquer cardápio** (base ou de escola).
   - Antes: só cardápios base (sem escola) podiam ser replicados; a página /replicar
     barrava cardápios com escola_id preenchido.
   - Agora: qualquer cardápio pode ser replicado para outras escolas.
   - A escola de origem (se houver) é automaticamente excluída da lista de seleção.
   - O `cardapio_base_id` das cópias preserva o do original (mantém o vínculo
     com o base verdadeiro, mesmo quando a origem é uma instância de escola).

## Arquivos
- `cardapio-editor-page.tsx` → sobrescreve `src/app/(app)/nutricao/cardapios/[id]/page.tsx`
- `replicar-page.tsx` → sobrescreve `src/app/(app)/nutricao/cardapios/[id]/replicar/page.tsx`
- `replicar-route.ts` → sobrescreve `src/app/api/nutricao/cardapios/[id]/replicar/route.ts`

## Como aplicar
1. Faça backup do projeto atual.
2. Renomeie os 3 arquivos acima para os caminhos indicados e substitua os originais.
3. Rode `npx prisma generate` (não há mudança de schema, mas boa prática).
4. Rode `npm run build` ou reinicie o `npm run dev`.

## Verificação
- TypeScript: `npx tsc --noEmit` ✓
- ESLint: `npx eslint <arquivos>` ✓
