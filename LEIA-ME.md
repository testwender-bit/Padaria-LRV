# Patch v9.2 — Lista de Compras: Múltiplos Cardápios + 22 Semanas

## O que mudou

### 1. Seleção múltipla de cardápios (não só "base")

**Antes:** Dropdown selecionava 1 cardápio (preferencialmente base).
**Agora:** Checkboxes para selecionar MÚLTIPLOS cardápios aprovados.

- Lista de checkboxes com scroll (160px de altura)
- Botões "Todos" / "Limpar"
- Mostra ⭐ para bases, ⚠️ para rascunhos
- Auto-seleciona o primeiro cardápio aprovado ao abrir

Por padrão só mostra APROVADO + bases. Checkbox "Mostrar rascunhos" libera todos.

### 2. 22 semanas disponíveis (não só 5)

**Antes:** Mostrava `cardapioSel.semanas_count` que podia ser 5 (ciclo base).
**Agora:** SEMPRE mostra 22 semanas para o usuário selecionar.

### 3. API suporta múltiplos cardápios

**Antes:** `?cardapio_id=xxx` (singular)
**Agora:** `?cardapio_ids=id1,id2,id3` (plural, aceita múltiplos)

- Mantém compatibilidade: `cardapio_id=xxx` (singular) ainda funciona
- Processa cada cardápio selecionado e acumula tudo num único resultado
- Resposta inclui `cardapios_nomes: [...]` com a lista de cardápios usados

## Como aplicar

```bash
unzip patch-lista-compras-multi.zip -d .
git add -A
git commit -m "feat(v9.2): lista de compras com múltiplos cardápios + 22 semanas"
git push
```

## Fluxo de uso

1. Vá em `/nutricao/lista-compras`
2. Selecione um ou mais cardápios aprovados (checkboxes)
3. Selecione as semanas (1-22, ou deixe vazio = todas)
4. Selecione as escolas
5. Clique "Gerar Lista"
6. Exporte (CSV / Excel / Imprimir / Salvar Snapshot)

A API consolida TODOS os cardápios selecionados num único resultado — útil para
comprar ingredientes de cardápios de diferentes segmentos (creche + fundamental +
integral) numa lista só.
