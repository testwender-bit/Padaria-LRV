# Patch v9.3 — Lista de Compras: Fluxo Simplificado

## Mudança principal

Removida a seleção de escolas (era redundante). Agora o fluxo é:

```
1. Selecionar cardápios das escolas (cada cardápio JÁ tem escola vinculada)
2. Selecionar semanas (1-22)
3. Gerar Lista — o sistema usa automaticamente os alunos da escola de cada cardápio
```

## O que mudou

### UI (page.tsx)
- **REMOVIDA** a seção "Escolas" (checkboxes de escolas)
- Cada cardápio agora mostra:
  - Nome da escola vinculada (🏫 Escola X)
  - Badge com alunos: `200P + 50I`
  - Aviso vermelho se escola não tem alunos cadastrados
  - Fase escolar do cardápio
- Só aparecem cardápios com escola vinculada (não aparecem bases sem escola)
- Scroll maior (200px) para acomodar as informações extras

### API (route.ts)
- **REMOVIDO** parâmetro `escolas_ids` (não é mais necessário)
- Para cada cardápio selecionado, busca a escola vinculada via `cardapio.escola_id`
- Usa os alunos daquela escola específica
- Usa a fase escolar daquele cardápio específico (cada cardápio pode ter fase diferente)

### Bug corrigido: Caso 5 (× 2 para integral sem mescla)
- **Antes:** `percapita × alunos_integral × 2` (superestimava refeições não-principais)
- **Agora:** `percapita × alunos_parcial + percapita × alunos_integral` (soma simples)

## Como aplicar

```bash
unzip patch-lista-compras-v9.3.zip -d .
git add -A
git commit -m "feat(v9.3): lista de compras simplificada — sem seleção de escolas"
git push
```

## Fluxo de uso

1. Vá em `/nutricao/lista-compras`
2. Selecione os cardápios das escolas que quer incluir
   - Cada cardápio mostra: nome, escola, alunos, fase
   - Se a escola não tem alunos → aparece aviso vermelho
3. Selecione as semanas (1-22, ou vazio = todas)
4. Clique "Gerar Lista"
5. O sistema calcula automaticamente:
   - Para cada cardápio: usa os alunos da escola vinculada
   - Para cada ingrediente: percapita × porções × alunos
   - Soma tudo numa lista consolidada
6. Exporte (CSV / Excel / Imprimir / Salvar Snapshot)

## IMPORTANTE: configure os alunos das escolas primeiro

Se os cardápios aparecem com "⚠️ Sem alunos cadastrados":
1. Vá em `/configuracoes` → Escolas → Editar
2. Preencha Alunos Parcial e/ou Integral
3. Volte para a lista de compras

Sem alunos cadastrados, o cálculo retorna zero.
