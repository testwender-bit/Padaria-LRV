# Patch v8.5 — Fix: AlertDialog de Exclusão Aparecia Atrás do Dialog

## ⚠️ Aplicar por cima do patch-prep-dialog-v4.zip

## Problema
O AlertDialog de confirmação de exclusão aparecia **atrás** do `PreparacaoFormDialog`, impedindo o usuário de clicar em "Sim, excluir".

## Causa raiz
No patch v4, eu tinha adicionado `style={{ zIndex: 100 }}` ao `DialogContent` do `PreparacaoFormDialog` para garantir que ele aparecesse acima do dialog "Adicionar Preparações" (z-50). Porém, o `AlertDialog` usa `z-50` default (do shadcn/ui), e como inline style tem prioridade sobre classes Tailwind, o AlertDialog acabava ficando **atrás** do PreparacaoFormDialog.

## Solução
Removido o `style={{ zIndex: 100 }}` do `DialogContent`. A ordem natural do DOM já garante o empilhamento correto:
- Dialog "Adicionar Preparações" (z-50, aberto primeiro)
- ↓
- PreparacaoFormDialog (z-50, aberto depois → aparece por cima pela ordem do DOM)
- ↓
- AlertDialog de exclusão (z-50, aberto por último → aparece por cima de tudo)

Como todos os três usam `z-50` e são renderizados via Portal no `document.body`, a ordem de montagem no DOM determina o empilhamento. O último aberto sempre fica no topo.

## Arquivo modificado (1 arquivo)

| Arquivo | Ação |
|---------|------|
| `src/components/preparacao-form-dialog.tsx` | MODIFICADO — Removido `style={{ zIndex: 100 }}` do DialogContent |

## Como aplicar

```bash
cd seu-projeto
unzip -o patch-prep-dialog-v5.zip
npm run dev
```

## Testar

1. Abra um cardápio → "Adicionar Preparações" → clique no ✏️ lápis de uma prep
2. No rodapé do diálogo de edição, clique em "Excluir" (vermelho)
3. **O AlertDialog deve aparecer por cima** do diálogo de edição (visível e clicável)
4. Clique em "Cancelar" ou "Sim, excluir" — ambos funcionam
5. Pressione ESC — fecha o AlertDialog (mas mantém o diálogo de edição aberto)

## Validação técnica
- ✅ `tsc --noEmit` — sem erros
- ✅ `eslint` — sem warnings
