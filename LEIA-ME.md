# Fix — TypeError itens + ordenação

## 1. TypeError: Property 'itens' does not exist on type 'ProducaoDia'

**Causa:** `ProducaoDia` tem `itens_pf`, `itens_pcq`, `itens_lanche` (NÃO `itens`).
O código tentava fazer `dia.itens.push()` que não existe.

**Fix:** Agora faz push no array correto:
- PF → `dia.itens_pf.push(item)`
- PCQ → `dia.itens_pcq.push(item)`
- LANCHE → `dia.itens_lanche.push(item)`

Também adicionado deep copy dos arrays para não mutar o estado original.

## 2. Ordenação

A ordenação foi corrigida no patch anterior (`producao-semana-utils.ts`).
Este patch só tem a página de produção que corrige o TypeScript.

Se a ordenação ainda não funciona após este patch:
1. Verifique se o patch anterior (`patch-ordenacao-extra-print.zip`) foi aplicado
2. Reinicie o dev server: `npm run dev`
3. Limpe o cache do navegador (Ctrl+Shift+R)

## Como aplicar

```bash
unzip -o patch-fix-itens-tipo.zip -d .
git add -A
git commit -m "fix: itens_pf/pcq/lanche push + deep copy"
git push
```
