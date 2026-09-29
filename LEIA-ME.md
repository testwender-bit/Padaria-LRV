# Patch v9.9.9 — Nutrição > Cardápios: novo botão "Repetições" (Analisador de Repetições)

## 📦 Conteúdo do patch

| Arquivo | Mudança |
|---|---|
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Editor: botão "Repetições" + dialog com análise completa |

Sem mudança de schema (não precisa `prisma db push`). Sem mudança de API —
análise 100% no navegador, varrendo o cardápio já carregado na tela (todas as semanas).

## 🎯 O que faz

Novo botão **"Repetições"** (ícone de gráfico, azul-índigo) na barra superior do editor, ao lado de
Localizar/Substituir. Abre um dialog que ajuda a identificar se os itens do cardápio estão
repetitivos demais:

### 📊 Resumo geral (4 cartões)
- **Itens no cardápio** (total + nº de preparações distintas)
- **Repetição forte** (quantidade em vermelho)
- **Atenção** (quantidade em amarelo)
- **2× no mesmo dia** (quantos dias letivos têm alguma preparação duplicada)

### 🍽️ Variedade por refeição
Uma linha por refeição (Almoço, Lanche...): quantas preparações distintas ela tem e as
**3 mais usadas** com contagem — ex.: `Lanche: 5 preparações distintas · mais usadas: Suco de laranja (48×), ...`

### 🏆 Ranking de repetições
Lista ordenada das piores primeiro, com **semáforo por preparação**:
- 🔴 **Repetição forte**: 2+ vezes no mesmo dia · 4+ dias seguidos na mesma semana · presente em mais de 60% dos dias letivos
- 🟡 **Atenção**: dias consecutivos (inclusive sexta→segunda da semana seguinte) · 3 dias seguidos na semana · mais de 40% dos dias · concentrada num único dia da semana (ex.: `80% às Segunda`)
- 🟢 **Sem alerta**

Cada linha mostra badges objetivos: `48×` · `44% dos dias` · `2× no mesmo dia (3)` ·
`4 dias seguidos` · `7 consec.` · `80% às Segunda`.

**Filtros**: por categoria (só as presentes no cardápio) e botão "Só com alertas" (esconde os verdes).
**Expandir a preparação** mostra TODAS as ocorrências `S05 · Segunda · Almoço` com botão
**"Ir →"** — reusa a navegação do Localizar (pula para a semana e destaca o item em âmbar).

### 📏 Critérios transparentes
O rodapé do dialog explica os critérios. Preparações de base (arroz, feijão, sucos) naturalmente
repetem mais — o resumo lembra de avaliar o conjunto. Proteção anti-falso-positivo: critérios de
"% dos dias" só valem com amostra mínima (3+ ocorrências em 5+ dias letivos).

## 💡 Detalhes técnicos

- Motor `analisarRepeticoesCardapio()` puro no page.tsx (mesmo arquivo), calculado via `useMemo`
  apenas quando o dialog está aberto — custo desprezível mesmo com 22 semanas.
- Nenhuma alteração em: produção, PCQ, romaneio, Lista de Compra, Localizar/Substituir/Replicar.
- v9.9.4 a v9.9.8 preservados (regressão validada: 16/16 + 44/44 + 21/21 + 46/46).

## 🚀 Como aplicar no Codespace

```bash
# 1. Extraia o zip na RAIZ do projeto (mesmo nível de package.json):
unzip -o patch-v9.9.9-analise-repeticoes.zip

# 2. Não há migração de banco nem rota nova. Confira:
git status

# 3. Validação local (opcional, recomendado):
npx tsc --noEmit
npm run build
```

## ✅ Roteiro de teste

1. Abra **Nutrição > Cardápios > [um cardápio]** com semanas preenchidas.
2. Confira o botão **"Repetições"** na barra superior (ao lado de "Substituir").
3. Abra o dialog → veja o resumo (4 cartões) e a "Variedade por refeição".
4. Com "Só com alertas" ativo, o ranking mostra só 🔴/🟡. Desative para ver todos.
5. Clique numa preparação do ranking → veja as ocorrências → clique **"Ir →"** →
   a tela pula para a semana certa com o item destacado em âmbar.
6. Filtre por categoria (ex.: só LANCHE) e confirme que o ranking filtra.
7. Num cardápio vazio, o dialog mostra mensagem de "nenhum item".
