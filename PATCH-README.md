# Patch v5 — Ordenação por perfis + Fix replicação (propagar ordem) + Deslocamento no swap

Este patch resolve **3 problemas interligados** que você reportou, todos de uma vez:

| # | Problema | Solução |
|---|---|---|
| 1 | Ordenação dos alimentos no cardápio não segue regra clara (pão+bebida+fruta misturados com comida; cuscuz sem ordem própria) | Reescrita de `ordenacao-preparacoes.ts` com **3 perfis automáticos**: PAO_LANCHE / COMIDA / CUSCUZ. Botão "Reordenar dia" no editor |
| 2 | Replicar cardápio base → escola **perde a ordem** customizada que você definiu no base (volta para auto-sort) | 4 rotas (`replicar`, `gerar-ciclo`, `clonar-lote`, `clonar`) agora **propagam `ordem`** dos CardapioItem |
| 3 | Replicação com swap de dia de pão faz **troca simples** (terça↔sexta), jogando comida da sexta na terça e ficando ruim | Nova função `realocarComDeslocamento` — **desloca a comida para o dia útil mais próximo** (quinta, depois quarta se quinta bloqueada), abrindo espaço para o pão na sexta |

---

## 📦 Arquivos deste patch

### Modificados (5 arquivos de código da aplicação)

| Arquivo | O que mudou |
|---|---|
| `src/lib/ordenacao-preparacoes.ts` | Reescrita com perfis PAO_LANCHE/COMIDA/CUSCUZ. Nova função `detectarPerfilSlot` + `calcularOrdemCanonicaSlot`. `sortItensByRefeicao` agora detecta perfil automaticamente |
| `src/app/api/nutricao/cardapios/[id]/replicar/route.ts` | (a) propaga `ordem` em todos os clones (b) substitui `trocarItensEntreDias` por `realocarComDeslocamento` (desloca comida para o dia útil mais próximo) |
| `src/app/api/nutricao/cardapios/[id]/gerar-ciclo/route.ts` | propaga `ordem` ao gerar semanas 6-22 |
| `src/app/api/nutricao/cardapios/[id]/clonar-lote/route.ts` | propaga `ordem` ao clonar para múltiplas escolas |
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Adiciona botão "Reordenar dia" (ícone ArrowDownUp) no header de cada dia + handler `handleReordenarDia` |

### Novos (3 arquivos)

| Arquivo | Função |
|---|---|
| `src/app/api/nutricao/cardapios/[id]/reordenar-dia/route.ts` | Endpoint POST que re-aplica ordem canônica em um slot (ou todos os slots de um dia) |
| `scripts/test-ordenacao-v5.ts` | 18 testes cobrindo: 3 perfis, detecção de perfil, botão reordenar, ordem manual respeitada |
| `PATCH-README.md` | Este arquivo |

---

## 🚀 Como aplicar no Codespace

### Passo 1 — Aplicar o patch

```bash
unzip -o patch-v5-ordenacao-replicacao-swap.zip
```

### Passo 2 — Rodar os testes (opcional, recomendado)

```bash
# Teste da nova ordenação (18 casos)
npx tsx scripts/test-ordenacao-v5.ts

# Teste dos alérgenos (continua passando — 23 casos)
npx tsx scripts/test-alergenos-correcao.ts
```

Deve mostrar:
- `RESULTADO: 18 passou(aram) · 0 falhou(aram)` para ordenação
- `RESULTADO: 23 passou(aram) · 0 falhou(aram)` para alérgenos

### Passo 3 — Restart do dev server

Como foram alterados:
- Biblioteca de ordenação (importada por várias rotas e páginas)
- Rotas de replicação/clonagem/ciclo
- Página do editor de cardápio

É recomendado reiniciar o `npm run dev` para garantir que tudo recarregue.

### Passo 4 — Validar no navegador

**Para o Problema 1 (Ordenação):**

1. Abra um cardápio existente com itens em ordem bagunçada
2. Clique no botão novo "Reordenar dia" (ícone ↕ no header do dia, ao lado do botão Copiar)
3. O sistema vai re-aplicar a ordem canônica:
   - **Se o slot tem pão**: Bebida → Pão → Fruta
   - **Se o slot tem cuscuz**: Cuscuz → Acompanhamento → Fruta
   - **Senão (comida)**: Salada → Arroz → Feijão → Proteína → Acompanhamento → Fruta

**Para o Problema 2 (Ordem preservada na replicação):**

1. Em um cardápio base, reordene alguns itens manualmente (botões ↑/↓)
2. Vá para `/nutricao/cardapios` → clique no base → "Replicar"
3. Escolha uma escola destino e marque um dia de pão/lanche
4. Confirme a replicação
5. Abra o cardápio da escola criado → os itens devem estar na **mesma ordem** que você definiu no base

**Para o Problema 3 (Deslocamento em vez de swap):**

1. Cardápio base: pão na **terça**, comida na **sexta**
2. Replicar para escola que recebe pão na **sexta**
3. **Antes (bug)**: pão ia pra sexta ✅, mas comida da sexta ia pra terça ❌
4. **Depois (fix)**: pão vai pra sexta ✅, comida da sexta é deslocada para **quinta** ✅ (terça fica sem pão, mas com o resto que tinha)

### Passo 5 — Commit

```bash
git add src/lib/ordenacao-preparacoes.ts \
        src/app/api/nutricao/cardapios/[id]/replicar/route.ts \
        src/app/api/nutricao/cardapios/[id]/gerar-ciclo/route.ts \
        src/app/api/nutricao/cardapios/[id]/clonar-lote/route.ts \
        src/app/api/nutricao/cardapios/[id]/reordenar-dia/route.ts \
        src/app/(app)/nutricao/cardapios/[id]/page.tsx \
        scripts/test-ordenacao-v5.ts \
        PATCH-README.md

git commit -m "feat(cardapio): ordenação por perfis + fix replicação + deslocamento no swap

Ordenação ( Problema 1):
- Nova arquitetura por PERFIS em src/lib/ordenacao-preparacoes.ts
- 3 perfis detectados automaticamente por slot:
  * PAO_LANCHE: Bebida → Pão → Fruta
  * COMIDA: Salada → Arroz → Feijão → Proteína → Acompanhamento → Fruta
  * CUSCUZ: Cuscuz → Acompanhamento → Fruta
- Novo endpoint POST /reordenar-dia (força ordem canônica)
- Botão 'Reordenar dia' (ArrowDownUp) no header de cada dia do editor

Replicação (Problema 2):
- propagar campo ordem em replicar, gerar-ciclo, clonar-lote
- antes: ordem era perdida ao replicar (voltava para auto-sort)
- agora: ordem definida no base é respeitada nas instâncias

Swap (Problema 3):
- realocarComDeslocamento substitui trocarItensEntreDias na replicação
- se base tem pão na terça e escola quer na sexta:
  antes: swap puro (comida da sexta ia pra terça)
  agora: comida da sexta desloca para quinta (dia útil mais próximo)
- algoritmo tenta dia anterior primeiro, depois seguinte, depois próximo raio
- fallback para swap puro se todos os dias estiverem bloqueados (caso extremo)

Testes:
- 18 casos cobrindo 3 perfis + detecção + botão reordenar + ordem manual
- 23 casos de alérgenos continuam passando"
```

---

## 🎯 Detalhes técnicos dos 3 fixes

### Fix 1: Ordenação por perfis

**Antes:** a função `getPrioridadePrep(nome, codigo)` retornava um número fixo por par (nome, tipo_refeicao). Para LANCHE/ALMOCO/JANTAR, sempre usava: salada→arroz→feijão→proteína→pão/acompanhamento→fruta→suco. Isso confundia pão com acompanhamento.

**Agora:** introduzido conceito de **Perfil** (PAO_LANCHE / COMIDA / CUSCUZ) detectado por slot:

```typescript
export function detectarPerfilSlot(nomesPreparacoes: string[]): PerfilRefeicao {
  const categorias = nomesPreparacoes.map(detectarCategoria)
  if (categorias.includes('CUSCUZ')) return 'CUSCUZ'
  if (categorias.includes('PAO') || categorias.includes('LANCHE')) return 'PAO_LANCHE'
  return 'COMIDA'
}
```

E `getPrioridadePorPerfil(nome, codigo, perfil)` aplica regras diferentes:

| Perfil | Ordem |
|---|---|
| PAO_LANCHE | Bebida/Suco (0) → Pão/Lanche (1) → Outro (2) → Fruta (3) |
| COMIDA | Salada (0) → Arroz (1) → Feijão (2) → Proteína (3) → Acompanhamento/Pão (4) → Outro/Fruta (5) → Suco/Bebida (6) |
| CUSCUZ | Cuscuz (0) → Proteína/Acompanhamento (1) → Outro (2) → Fruta (3) → Bebida (4) |

A função `sortItensByRefeicao` chama `detectarPerfilSlot` automaticamente quando faz auto-sort. Se houver ordem manual, continua respeitando (igual antes).

### Fix 2: Propagar `ordem` na replicação

**Antes:** 4 rotas criavam `CardapioItem` sem passar `ordem`:
- `replicar/route.ts` linha 248-256 (criação inicial) e 355-363 (réplicas ciclo)
- `gerar-ciclo/route.ts` linha 110-119
- `clonar-lote/route.ts` linha 130-138
- Apenas `clonar/route.ts` linha 135 propagava com `ordem: item.ordem || 0`

**Agora:** todos os 4 arquivos passam `ordem: item.ordem || 0` ao criar `CardapioItem`. Mudança de uma linha em cada arquivo.

### Fix 3: Deslocamento em vez de swap

**Antes:** `trocarItensEntreDias(tx, diaA, diaB)` fazia swap puro — apagava ambos, recriava trocando o conteúdo. Resultado: comida da sexta ia parar na terça (ruim visualmente no cardápio).

**Agora:** `realocarComDeslocamento(tx, diasClonados, diaOrigem, diaDestino, diasBloqueados)`:

1. Se `diaDestino` está vazio → simplesmente move origem → destino (sem deslocamento)
2. Senão, procura o dia útil mais próximo de `diaDestino` que NÃO esteja em `diasBloqueados`:
   - distância 1: tenta o dia **anterior** (preferência do usuário), depois o **seguinte**
   - distância 2, 3, 4: expande o raio
3. Move o conteúdo do `diaDestino` para o `diaDeslocado` (preservando `ordem`)
4. Move o conteúdo do `diaOrigem` para o `diaDestino` (preservando `ordem`)
5. **Fallback:** se todos os dias úteis estão bloqueados (caso extremo: pão na terça, lanche na quinta, escola quer pão na quinta e lanche na terça → destino do pão = origem do lanche), usa swap puro como fallback

`diasBloqueados` = `{origemPao, destinoPao, origemLanche, destinoLanche}` — garante que o deslocamento não escolha um dia que já vai ser mexido por outra troca.

---

## 🛡️ Segurança e compatibilidade

| Aspecto | Status |
|---|---|
| Não toca em banco de dados (sem migration) | ✅ |
| Não quebra cardápios existentes | ✅ — ordem 0 continua significando auto-sort |
| Ordem manual antiga continua sendo respeitada | ✅ |
| Hot-reload pega mudanças | ✅ |
| Botão "Reordenar dia" só re-ordena o dia selecionado (não afeta outros) | ✅ |
| Replicação continua funcionando para quem não usa ordem manual | ✅ — itens com `ordem=0` continuam auto-sort |
| Swap fallback mantém comportamento legado em casos extremos | ✅ |

---

## ❓ Troubleshooting

### O botão "Reordenar dia" não aparece
Reinicie o `npm run dev`. Como a página do editor é grande (~2900 linhas), o hot-reload pode não pegar a mudança de imediato.

### A ordenação continua errada em algum slot específico
Pode ser que a detecção de categoria não esteja pegando o nome da preparação. Rode o teste:
```bash
npx tsx scripts/test-ordenacao-v5.ts
```
Se algum caso de teste falhar, me avise com o nome exato da preparação que está sendo mal-classificada.

### A replicação continua perdendo ordem
Pode ser que o cardápio base tenha `ordem=0` em todos os itens (auto-sort). Nesse caso, o comportamento é o mesmo de antes — auto-sort no destino. Para verificar, abra o base e clique em ↑/↓ em algum item — isso atribui ordens sequenciais a todos do slot. Depois replique.

### O deslocamento escolheu um dia "errado"
O algoritmo prioriza o **dia anterior** ao destino. Se você quisesse que escolhesse o **dia seguinte**, ou se quiser um comportamento diferente, me avise que ajusto a heurística. Atualmente:
- destino = sexta → tenta quinta (1 antes), depois segunda (4 antes), depois quarta (2 antes), depois terça (3 antes)

### Erro P2028 "Transaction not found" na replicação
Como agora fazemos mais queries (deslocamento faz 6-8 queries por troca vs 2 do swap), aumentei o timeout da transação de 30s para **60s**. Se mesmo assim falhar para muitas escolas simultâneas, me avise que aumento mais ou dividimos em lotes.

---

## 📝 Notas técnicas

### Por que detectar perfil por slot e não por tipo_refeicao?

Porque o mesmo `TipoRefeicao` (ex: `LANCHE`) pode ter slots com pão (perfil PAO_LANCHE), slots com cuscuz (perfil CUSCUZ) e slots sem nenhum dos dois (perfil COMIDA). Detectar por slot dá flexibilidade total.

### Por que cuscuz tem prioridade sobre pão na detecção?

Porque "Pão com cuscuz" não existe, mas "Cuscuz com pão" também não. Quando tem cuscuz, é sempre o protagonista do slot — faz sentido que ele defina o perfil. Se um dia tiver pão + cuscuz juntos (improvável), o cuscuz vence.

### Por que manter `trocarItensEntreDias` como fallback?

Caso extremo: base tem pão na terça e lanche na quinta. Escola quer pão na quinta e lanche na terça. Nesse caso:
- Troca de pão: origem=terça, destino=quinta
- Troca de lanche: origem=quinta, destino=terça
- `diasBloqueados = {terça, quinta}` (todos os dias úteis envolvidos)

O algoritmo de deslocamento não consegue achar um dia livre (todos bloqueados), então cai no fallback de swap puro — que nesse caso específico é exatamente o comportamento desejado (pão↔lanche entre terça e quinta).

### Performance

- Detecção de perfil: O(n) por slot onde n = número de itens (normalmente 3-8)
- Sort: O(n log n) por slot
- Deslocamento na replicação: 6-8 queries por troca (vs 2 do swap), mas para 5 semanas × 5 dias = 25 slots, ainda é <100 queries por escola

Para 24 escolas simultâneas, pode chegar a ~2400 queries — por isso o timeout de 60s. Se performance virar problema, podemos migrar para bulk operations (como já fizemos no patch v2 do arroz fantasma).
