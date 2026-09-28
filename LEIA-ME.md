# Patch v9.9.6 — Nutrição > Cardápios: botão "Pesquisar e Substituir" restaurado (substituição parcial ou em lote)

## 📦 Conteúdo do patch

| Arquivo | Mudança |
|---|---|
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Editor de cardápio — novo botão + dialog "Pesquisar e Substituir" |

Sem mudança de schema (não precisa `prisma db push`).
**Sem mudança de API**: a rota `/api/nutricao/cardapios/[id]/localizar-substituir` já existia no backend —
o que tinha se perdido em algum refactor anterior era apenas o **botão e o dialog** na tela. Este patch
reconstrói a interface em cima da API existente (GET + POST), sem tocá-la.

## 🔍 O que faz

Novo botão **"Pesquisar e Substituir"** na barra superior do editor do cardápio (ao lado de
Replicar/Comparar/Clonar em Lote). Fluxo em 2 passos dentro do dialog:

**Passo 1 — Localizar (preparação atual):**
- Digite o nome (mín. 2 letras, com debounce de 350ms) → a busca varre o cardápio **inteiro
  (todas as 22 semanas)** e agrupa as ocorrências por preparação.
- Clique na preparação encontrada → aparece a lista de **todas as ocorrências**:
  `S05 · Segunda · Almoço`, com checkbox **marcado por padrão** (lote).
- **Desmarque** as que quiser manter → vira substituição **parcial**.
  Deixe todas marcadas → substituição **em lote**.

**Passo 2 — Substituir por (preparação nova):**
- Busca na biblioteca de preparações (com pontos de categoria, **kcal por porção** e nº de
  ingredientes — mesma convenção do dialog de adicionar).
- Botão dinâmico: `Substituir TODAS (N)` ou `Substituir selecionadas (N)`.

## 🛡️ Proteções (importantes)

- **Nunca fica duplicata**: se a preparação substituta já estiver naquela refeição, a
  preparação original é apenas **removida** dali (o slot continua com a substituta, uma vez só).
  O resumo do toast informa quantas foram atualizadas e quantas removidas por duplicidade.
- **Substituta igual à original** é bloqueada.
- **Cardápios de escola (instância de base)**: as semanas afetadas são automaticamente marcadas
  como **"Modificada"** (sem spam de toast), igual ao comportamento de remover/editar manualmente.
- Em lote, após a operação o cardápio é **recarregado do banco** (operação tocou muitas semanas);
  na parcial, a atualização é otimista (instantânea, item a item).

## 🚀 Como aplicar no Codespace

```bash
# 1. Extraia o zip na RAIZ do projeto (mesmo nível de package.json):
unzip -o patch-v9.9.6-pesquisar-e-substituir-cardapio.zip

# 2. Não há migração de banco nem rota nova. Confira:
git status

# 3. Validação local (opcional, recomendado):
npx tsc --noEmit
npm run build

# 4. Teste no navegador:
#    Nutrição > Cardápios > abra um cardápio > botão "Pesquisar e Substituir":
#    ✓ Busque "arroz" → aparecem as ocorrências em todas as semanas
#    ✓ Sem desmarcar nada → "Substituir TODAS (N)" em 1 operação
#    ✓ Desmarcando algumas → "Substituir selecionadas (N)" troca só essas
#    ✓ Se a substituta já estava numa refeição → toast avisa "removida(s)
#      (substituta já estava na refeição)" e não há duplicata
#    ✓ Em cardápio de escola, semanas tocadas ficam com badge "Modificada"

# 5. Commit e push (deploy Vercel automático):
git add .
git commit -m "v9.9.6: restaura Pesquisar e Substituir preparação (parcial/lote) no editor de cardápios"
git push
```

## ✅ Validação executada antes da entrega

- `npx tsc --noEmit` → 0 erros
- `npm run build` (Next.js completo) → OK
- `scripts/test-cardapio-substituir-v996.ts` → 18/18 testes: detecção lote/parcial,
  aplicação otimista (atualizada/removida por duplicata), semanas afetadas sem repetição,
  mapeamento dos dias pt-BR e estrutura do JSX (botão, API, debounce, bloqueio de igualdade).

## 📝 Notas

- A API `localizar-substituir` não foi alterada (continua sem `$transaction`, compatível com
  pgbouncer do Supabase).
- Diagnóstico do sumiço: a rota existia desde versões anteriores, mas nenhuma tela a referenciava
  mais — provável perda num refactor do editor. O comportamento reconstruído segue exatamente a
  ideia original: localizar preparações e substituir parcialmente ou em lote por outra.
- Sobre a INTEGRAL (2 refeições/dia): mantido como está, conforme combinado.
