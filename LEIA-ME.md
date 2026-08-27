# Patch v9.8.8 — CONSOLIDADO: corrige erro de build na Vercel

## 🚨 Problema

A Vercel retornou erro de build:
```
./src/app/(app)/producao/page.tsx:714:47
Type error: Property 'categoria' does not exist on type 'EscolaRomaneio'.
```

## 🔍 Causa

O campo `categoria` foi adicionado em `EscolaRomaneio` no patch v9.8.5, mas o arquivo `src/lib/romaneio-utils.ts` não foi incluído nos patches v9.8.6, v9.8.7 — só as APIs e páginas foram atualizadas. Resultado: no seu Codespace, o `romaneio-utils.ts` está desatualizado (não tem `categoria`), mas a página `producao/page.tsx` (v9.8.7) tenta acessar `escola.categoria` → erro de tipo.

## ✅ Solução

Este patch é **CONSOLIDADO** — inclui TODOS os arquivos relevantes das versões v9.8.0 até v9.8.7, garantindo que tudo esteja sincronizado. Aplicar este patch zera qualquer inconsistência.

## 📦 Arquivos incluídos (10 arquivos)

| Arquivo | Função |
|---|---|
| `prisma/schema.prisma` | Campo `lanche_bifasica_modo` (v9.8) |
| `src/lib/unit-options.ts` | Constante `LANCHE_BIFASICA_MODOS` com 4 modos (v9.8/v9.8.2) |
| `src/lib/producao-utils.ts` | `tipoPaoEfetivoEscola()` + `ehDiaProducaoDoProduto()` (v9.8.1/v9.8.2) |
| `src/lib/romaneio-utils.ts` | **CAMPO `categoria` + `pf_comp` + `totais_pf_comp`** (v9.8.4/v9.8.5) ← o que faltava |
| `src/app/api/cardapio/route.ts` | POST/PATCH aceitam `lanche_bifasica_modo` e `cardapio_id` (v9.8/v9.8.7) |
| `src/app/api/producao/route.ts` | Lógica bifásica + PF Comp zerado com PCQ + feriados_semana (v9.8.x) |
| `src/app/api/romaneio/route.ts` | `tipoPaoEfetivoEscola()` + pf_comp separado p/ creches/bifásicas (v9.8.5/v9.8.6/v9.8.7) |
| `src/app/(app)/cardapio/page.tsx` | Seletor Modo Lanche Bifásica com 4 opções (v9.8/v9.8.2) |
| `src/app/(app)/producao/page.tsx` | Edição aviso + bifásica tabela + PCQ agrupado + fonte maior (v9.8.x) |
| `src/app/print.css` | Fonte ~30% maior + margens reduzidas (v9.8.2) |

## 🚀 Como aplicar

```bash
# 1. Backup + branch
git stash
git checkout -b fix/v9.8.8-consolidado

# 2. Extrair (sobrescreve todos os arquivos)
unzip -o patch-v988.zip

# 3. Sincronizar banco (NÃO precisa se já aplicou v9.8 antes — só confirma)
npx prisma generate
# Só rode prisma db push se NUNCA aplicou v9.8 antes:
# npx prisma db push

# 4. Se NUNCA rodou migração do lanche_bifasica_modo, rode UMA vez:
# npx tsx scripts/migrar-lanche-bifasica-modo.ts

# 5. Build + testar
npm run build
npm run dev
```

## 🧪 Como testar

Após aplicar, faça um smoke test rápido:

1. **Build passa** — `npm run build` deve compilar sem erros
2. **Produção carrega** — `/producao` mostra tabelas PF/PCQ/Lanche normalmente
3. **Imprimir funciona** — clique Imprimir, gera PDF com fontes maiores
4. **Editar aviso** — clique no lápis do "Aviso da Semana" → salva sem erro
5. **Modo bifásica** — `/cardapio` → editar semana → seletor tem 4 opções (LANCHE/PAO_PADRAO/PAO_PROTEINA/NENHUM)
6. **Romaneio motorista** — bifásicas e creches aparecem com `40 + PF 25` na tabela de PCQ
7. **PCQ zerado** — zere PCQ de uma creche → na impressão, não aparece "0 + PF 25"

## 🔄 Como commitar e voltar para main

```bash
# 1. Adicionar todos os arquivos
git add -A

# 2. Commitar
git commit -m "fix(v9.8.8): consolidar todos os patches v9.8.x para corrigir build Vercel"

# 3. Voltar para main
git checkout main

# 4. Merge do branch
git merge fix/v9.8.8-consolidado

# 5. Enviar para GitHub (Vercel faz deploy automático)
git push origin main

# 6. Apagar branch local
git branch -d fix/v9.8.8-consolidado
```

## 📝 Resumo do que cada versão incluiu

| Versão | O que adicionou |
|---|---|
| v9.8.0 | Modo Lanche Bifásica (LANCHE/PAO_PADRAO/PAO_PROTEINA) + botão excluir lanches |
| v9.8.1 | Bugfix: bifásica modo PAO_* afeta PF (não Lanche) |
| v9.8.2 | Modo NENHUM + fonte maior na impressão + sem aviso na impressão |
| v9.8.3 | Fonte das tabelas de lanches na impressão |
| v9.8.4 | Romaneio motorista: agrupa PF Complemento com PCQ em creches |
| v9.8.5 | Estende agrupamento para bifásicas |
| v9.8.6 | Romaneio respeita `lanche_bifasica_modo` na tabela de PF |
| v9.8.7 | PF Comp zerado junto com PCQ + editar aviso via `cardapio_id` |
| **v9.8.8** | **CONSOLIDADO** — garante que todos os arquivos estão sincronizados |

## ⚠️ Notas importantes

- **Não pule este patch** se aplicou apenas alguns dos v9.8.x anteriores. Este patch sobrescreve todos os arquivos com a versão final correta.
- **Sem mudança nova no banco** — se você já rodou `prisma db push` em alguma versão v9.8.x anterior, não precisa rodar de novo.
- **Script de migração** — só rode `npx tsx scripts/migrar-lanche-bifasica-modo.ts` se NUNCA tiver rodado antes (é idempotente, pode rodar de novo sem problema).
- **Após aplicar, faça commit e push** para a Vercel fazer deploy automaticamente.
