# Patch v8.12 — Açúcar não aparece em cardápios de Creche/Berçário

## O que muda

**Regra:** quando um cardápio é de **Creche** ou **Berçário**, o açúcar (e
qualquer outro ingrediente com percapita=0 para a fase) é automaticamente:

- ✅ Removido da lista de ingredientes no **PDF impresso**
- ✅ Não entra no **cálculo nutricional** (energia, proteína, ferro, etc.)
- ✅ Não entra na **lista de compras** da escola
- ✅ Não dispara mais o alerta "CRÍTICO: Açúcar proibido para creche"

O nutricionista cadastra a preparação UMA VEZ com açúcar. O sistema decide
dinamicamente, na hora de exibir/calcular, se o açúcar entra ou não com base
na fase do cardápio.

## O que foi alterado

### 1. Script de migração (scripts/zerar-acucar-creche-bercario.ts)
Cria/atualiza percapitas BERCARIO=0 e CRECHE=0 para todos os ingredientes
cujo alimento é açúcar (refinado, mascavo, cristal).

**JÁ FOI EXECUTADO no banco Supabase em 25/jun/2026 — 65 percapitas criadas.**
Rode apenas se precisar re-aplicar a regra para novos ingredientes.

### 2. PDF do cardápio (src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx)
Agora filtra ingredientes com percapita=0 para a fase do cardápio.
Em cardápios de Creche/Berçário, "Açúcar" não aparece mais na lista de
ingredientes impressa.

### 3. Seed de fichas técnicas (prisma/seed-fichas-tecnicas.ts)
Corrigido para honrar o `null` do `fichas-tecnicas.json` — quando o JSON
diz `bercario: null` ou `creche: null`, agora o seed cria a percapita
com quantidade=0 (antes recalcular via percentual, gerando 4g/5g errados).

Isso só afeta FUTUROS seeds — não altera dados existentes.

## Como aplicar

1. Descompacte este zip na RAIZ do projeto (preserva a estrutura de pastas):
   ```bash
   unzip patch-acucar-creche-v812.zip -d .
   ```
   Arquivos que serão sobrescritos:
   - `scripts/zerar-acucar-creche-bercario.ts`
   - `src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx`
   - `prisma/seed-fichas-tecnicas.ts`

2. Faça commit e push:
   ```bash
   git add scripts/zerar-acucar-creche-bercario.ts
   git add "src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx"
   git add prisma/seed-fichas-tecnicas.ts
   git commit -m "feat(v8.12): açúcar não aparece em cardápios de creche/berçário"
   git push
   ```

3. (OPCIONAL) Re-aplicar migração no banco — só se criou novas preparações
   com açúcar desde 25/jun/2026:
   ```bash
   npx tsx scripts/zerar-acucar-creche-bercario.ts          # dry-run (relatório)
   npx tsx scripts/zerar-acucar-creche-bercario.ts --apply   # aplicar
   # Use --force para sobrescrever casos onde nutricionista ajustou manualmente
   ```

## Observações

- Apenas **Açúcar** (3 tipos: refinado, mascavo, cristal) é tratado
  automaticamente. Para outros ingredientes, o nutricionista pode usar o
  formulário de preparação e setar a percapita=0 manualmente por fase.
- 31 preparações tinham açúcar COM valor > 0 em creche/berçário (provável
  ajuste manual do nutricionista). Esses foram **preservados** por padrão.
  Use `--apply --force` para zerar também esses casos.
- A tela de CADASTRO de preparações continua mostrando TODOS os ingredientes
  (inclusive açúcar), porque o nutricionista precisa gerenciar tudo.
