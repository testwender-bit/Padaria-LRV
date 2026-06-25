# Patch v8.13 — Bifásica como "Creche + Lanche Pré-Escola extra"

## O que muda

A categoria **BIFASICA** deixa de usar `LANCHE_1 + LANCHE_2` e passa a funcionar
como uma **creche estendida** com 6 slots:

```
1. CAFE_MANHA (Café da Manhã) — 07h30 — 20%
   ↳ FRUTA_MANHA (Fruta da Manhã) — 08h45 — 10%  [SUB — aninhado]
2. ALMOCO (Almoço) — 10h00 — 30%
3. HIDRATACAO (Hidratação) — 13h30 — 5%
4. LANCHE_PRE_ESCOLA (Lanche Pré-Escola) — 09h00 — 10%  ← NOVO
5. JANTAR (Jantar) — 15h30 — 25%
```

A Fruta da Manhã agora é um **sub-slot** dentro do Café da Manhã (mesma caixa visual),
economizando espaço vertical no PDF e no editor. O novo slot LANCHE_PRE_ESCOLA
permite que a bifásica tenha um lanche extra (ex: na quinta-feira).

## Replicação CRECHE → BIFASICA

Agora é possível replicar um cardápio CRECHE para uma escola BIFASICA. O sistema:
- Copia os 5 slots da creche (CAFE_MANHA, FRUTA_MANHA, ALMOCO, HIDRATACAO, JANTAR)
- Deixa o slot LANCHE_PRE_ESCOLA vazio (preenchido manualmente depois)
- Usa a categoria DA ESCOLA DESTINO (BIFASICA) no novo cardápio

## "Igual creche" no PDF

Quando o slot LANCHE_PRE_ESCOLA está vazio em um dia que não é feriado, o PDF
mostra o texto "igual creche" (itálico cinza) em vez de "—".

## Arquivos

| Arquivo | O que faz |
|---------|-----------|
| `prisma/schema.prisma` | Adiciona campo `sub_de_codigo` em `TipoRefeicao` |
| `scripts/setup-bifasica-v813.ts` | Cria `LANCHE_PRE_ESCOLA`, reconfigura BIFASICA, marca FRUTA_MANHA como sub |
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Editor: renderiza slot sub aninhado dentro do pai |
| `src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx` | PDF: aninha sub na mesma célula + placeholder "igual creche" |
| `src/app/(app)/nutricao/cardapios/[id]/replicar/page.tsx` | Relaxa filtro para permitir CRECHE ↔ BIFASICA |
| `src/app/api/nutricao/cardapios/[id]/replicar/route.ts` | Usa categoria da escola destino |
| `src/app/api/nutricao/cardapios/[id]/route.ts` | Inclui `sub_de_codigo` no select de horários |
| `src/app/print.css` | Classes CSS para sub-slot e placeholder "igual creche" |

## Como aplicar

1. **Descompacte** o zip na RAIZ do projeto (preserva pastas):
   ```bash
   unzip patch-bifasica-v813.zip -d .
   ```

2. **Rode `prisma db push`** (necessário porque o schema mudou):
   ```bash
   npx prisma generate
   npx prisma db push --accept-data-loss
   ```

3. **Rode o script de setup** (cria LANCHE_PRE_ESCOLA e reconfigura BIFASICA):
   ```bash
   npx tsx scripts/setup-bifasica-v813.ts          # dry-run
   npx tsx scripts/setup-bifasica-v813.ts --apply   # aplicar
   ```

4. Faça commit e push:
   ```bash
   git add prisma/schema.prisma scripts/setup-bifasica-v813.ts
   git add "src/app/(app)/nutricao/cardapios/[id]/page.tsx"
   git add "src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx"
   git add "src/app/(app)/nutricao/cardapios/[id]/replicar/page.tsx"
   git add "src/app/api/nutricao/cardapios/[id]/replicar/route.ts"
   git add "src/app/api/nutricao/cardapios/[id]/route.ts"
   git add src/app/print.css
   git commit -m "feat(v8.13): bifásica como creche + lanche pré-escola extra"
   git push
   ```

## Fluxo de uso recomendado

1. **Crie** um cardápio base de CRECHE (sem escola)
2. **Configure** as 5 refeições da creche normalmente (CAFE_MANHA com FRUTA_MANHA aninhada, ALMOCO, HIDRATACAO, JANTAR)
3. **Replicar** para a escola bifásica (Chico Mendes): botão "Replicar p/ Escolas"
4. **Abra** o cardápio bifásico criado e adicione o lanche extra na quinta-feira
   no slot LANCHE_PRE_ESCOLA
5. **Gere o PDF** — os outros dias mostrarão "igual creche" no slot do lanche pré-escola

## Observações

- Cardápios BIFASICA existentes (com LANCHE_1/LANCHE_2) continuam funcionando,
  mas os itens em LANCHE_1/LANCHE_2 ficarão órfãos. Recomenda-se recriar.
- A Fruta da Manhã agora é SUB do Café da Manhã em TODAS as categorias que
  tenham ambos (CRECHE e BIFASICA) — não apenas na bifásica.
- O espaço vertical economizado no PDF (sub-aninhamento) permite que a bifásica
  caiba em 1 folha A4 landscape.
