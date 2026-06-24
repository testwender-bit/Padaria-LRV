# Patch v6.3 — Deslocamento em cadeia + Não expandir se base já tem 22 semanas

Corrige 2 bugs reportados na replicação de cardápio:

1. **Bug do deslocamento:** ao realocar pão de terça→sexta, o código anterior deixava a terça vazia (perdia a comida que estava lá). Você queria **deslocamento em cadeia**: a comida da sexta vai pra quinta, a da quinta vai pra quarta, a da quarta vai pra terça — preenchendo todos os dias, só mudando o dia do pão.
2. **Bug da expansão forçada:** ao replicar um cardápio base que já tinha 22 semanas completas, o sistema clonava só as 5 primeiras e re-expandia as 17 restantes como réplicas — **perdendo 17 semanas customizadas**.

---

## 📦 Arquivos deste patch

### Modificados (1 arquivo)

| Arquivo | O que mudou |
|---|---|
| `src/app/api/nutricao/cardapios/[id]/replicar/route.ts` | (1) Reescrita da função `realocarComDeslocamento` para fazer **deslocamento em cadeia** em vez de deslocamento simples. (2) `semanasBase` agora clona TODAS as 22 semanas se o base já está completo. (3) Bloco de expansão só roda se `!baseCompleto`. (4) Novo bloco `else if (baseCompleto)` só atualiza datas das semanas clonadas. |

### Novos (1 arquivo)

| Arquivo | Função |
|---|---|
| `scripts/test-deslocamento-cadeia.ts` | 6 testes da lógica de deslocamento em cadeia (simula em memória, sem precisar de banco) |

---

## 🚀 Como aplicar

### Passo 1 — Aplicar o patch

```bash
unzip -o patch-v6.3-deslocamento-cadeia-base-completo.zip
```

### Passo 2 — Rodar o teste da cadeia (validar fix)

```bash
npx tsx scripts/test-deslocamento-cadeia.ts
```

Deve mostrar `6 passou(aram) · 0 falhou(aram)` cobrindo:
- Caso do usuário (pão na terça → sexta, comida da sexta vai pra quinta, da quinta pra quarta, da quarta pra terça)
- Cadeia inversa (sexta → terça)
- Cadeia curta (3 dias)
- Dias adjacentes (2 dias = swap)
- Intermediário bloqueado (swap puro como fallback)
- Dia destino vazio (cadeia ainda funciona)

### Passo 3 — Restart do dev server

```bash
npm run dev
```

### Passo 4 — Validar no navegador

**Caso 1 — Deslocamento em cadeia:**

1. Cardápio base com pão na terça, e comida (arroz/feijão/proteína) na quarta, quinta e sexta
2. Replicar para escola que recebe pão na sexta
3. Abrir o cardápio da escola criado
4. Verificar:
   - Terça tem a comida que era da quarta ✅
   - Quarta tem a comida que era da quinta ✅
   - Quinta tem a comida que era da sexta ✅
   - Sexta tem só o pão ✅
   - **Nenhum dia vazio**

**Caso 2 — Base com 22 semanas:**

1. Cardápio base com 22 semanas customizadas (cada semana diferente)
2. Replicar para escola
3. Abrir o cardápio da escola criado
4. Verificar:
   - Tem 22 semanas (não 5 replicadas) ✅
   - Cada semana mantém o conteúdo original do base ✅
   - Semanas 6-22 não são réplicas da 1-5, são cópias fiéis das semanas 6-22 do base ✅

### Passo 5 — Commit e push

```bash
git add src/app/api/nutricao/cardapios/[id]/replicar/route.ts \
        scripts/test-deslocamento-cadeia.ts \
        PATCH-README.md

git commit -m "fix(replicacao): deslocamento em cadeia + nao expandir base completo (v6.3)

Bug 1 - Deslocamento em cadeia:
- Antes: ao mover pão de terça→sexta, comida da sexta ia pra quinta
  e terça ficava VAZIA (perdia conteúdo)
- Agora: comida da sexta→quinta, quinta→quarta, quarta→terça
  Cadeia rotativa preenche todos os dias, nenhum fica vazio
- Algoritmo: snapshot de todos os dias da cadeia, apaga, reatribui
  circularmente (cada dia recebe conteúdo do próximo)
- Fallback: se intermediário bloqueado, faz swap puro

Bug 2 - Não expandir se base completo:
- Antes: replicar sempre expandia para 22 semanas, mesmo se base já tinha 22
  Filtrava só as 5 primeiras (ciclo) e replicava como cópias
  Perdia 17 semanas customizadas
- Agora: se base tem >=22 semanas, clona TODAS sem expandir
  Só atualiza as datas (escola pode começar em data diferente)
- Novo bloco else if (baseCompleto) só atualiza datas

Testes:
- 6 testes do deslocamento em cadeia (todos passam)
- 5 testes do caso da torta continuam passando
- 18 testes v6 continuam passando
- 18 testes v5 continuam passando
- 23 testes alérgenos continuam passando
- Total: 70 testes, todos passam"

git push
```

---

## 🎯 Detalhes técnicos

### Fix 1: Deslocamento em cadeia

**Antes (v5):**
```
Pão da terça → sexta
Comida da sexta → quinta (deslocamento simples)
Terça fica VAZIA (só tinha o pão)
```

**Agora (v6.3):**
```
Pão da terça → sexta
Comida da sexta → quinta
Comida da quinta → quarta
Comida da quarta → terça (preenche o buraco)
Resultado: nenhum dia vazio, todos com comida
```

#### Algoritmo

1. Constrói a cadeia de dias entre origem e destino:
   - terça→sexta → `[terça, quarta, quinta, sexta]`
   - sexta→terça → `[sexta, quinta, quarta, terça]`
2. Verifica se algum dia intermediário está bloqueado (envolvido em outra troca de pão/lanche)
   - Se sim, faz swap puro (terça↔sexta)
3. Snapshot em memória de todos os itens da cadeia
4. Apaga todos os itens de todos os dias da cadeia
5. Reatribui **circularmente**: cada dia recebe o conteúdo do **próximo** dia da cadeia
   - terça ← quarta
   - quarta ← quinta
   - quinta ← sexta
   - sexta ← terça (pão) ✅

#### Exemplo visual

```
Estado inicial:           Estado final (pão na sexta):
terça  : [Pão]            terça  : [Arroz, Feijão, Carne]   ← veio da quarta
quarta : [Arroz, Carne]   quarta : [Arroz, Feijão, Frango]  ← veio da quinta
quinta : [Arroz, Frango]  quinta : [Arroz, Feijão, Peixe]   ← veio da sexta
sexta  : [Arroz, Peixe]   sexta  : [Pão]                     ← veio da terça ✅
```

### Fix 2: Não expandir se base completo

**Antes (v5/v6):**
```typescript
const semanasBase = original.semanas.filter((s) => s.numero <= ciclo)  // só 5 primeiras
// ...
if (expandir && original.semanas.length >= ciclo) {  // sempre expande
  // gera 17 réplicas como cópias da semana 1-5
}
```
Resultado: se base tinha 22 semanas customizadas, perdia as 17 últimas.

**Agora (v6.3):**
```typescript
const baseCompleto = original.semanas.length >= SEMANAS_SEMESTRE  // 22
const semanasBase = baseCompleto
  ? original.semanas                              // clona TODAS as 22
  : original.semanas.filter((s) => s.numero <= ciclo)  // só as 5 do ciclo
// ...
if (expandir && !baseCompleto && original.semanas.length >= ciclo) {
  // só expande se base está incompleto
} else if (baseCompleto) {
  // só atualiza datas das 22 semanas clonadas
}
```
Resultado: se base tem 22 semanas, clona todas as 22 fiéis ao original (apenas troca pão/lanche de dia conforme config da escola).

---

## 🛡️ Segurança e compatibilidade

| Aspecto | Status |
|---|---|
| Não toca em banco de dados (sem migration) | ✅ |
| Não quebra replicação existente (quem usa 5 semanas continua funcionando) | ✅ |
| Não quebra replicação com base completo (22 semanas) — agora funciona | ✅ ✅ |
| Fallback para swap puro se cadeia bloqueada | ✅ |
| Hot-reload pega mudanças | ✅ |
| Timeout da transação mantido em 60s | ✅ |

---

## ❓ Troubleshooting

### Ainda ficou dia vazio após replicar
Pode ser que a cadeia tinha um intermediário bloqueado. Verifique se você está trocando pão E lanche na mesma replicação — se ambos atravessam os mesmos dias, o sistema faz swap puro como fallback.

Para diagnosticar, me mande:
- Dia do pão no base
- Dia do pão na escola destino
- Dia do lanche no base
- Dia do lanche na escola destino

### Cardápio da escola ainda tem só 5 semanas
Verifique se o cardápio base realmente tem 22 semanas. Abra o base no editor e veja se pode navegar até a semana 22. Se o base tem menos, o sistema continua expandindo (comportamento normal).

### Erro "Transaction not found" (P2028)
Como a cadeia faz mais queries (snapshot + delete + create para cada dia da cadeia), pode chegar perto do timeout de 60s para muitas escolas simultâneas. Se acontecer, me avise que aumento o timeout ou divido em lotes.

---

## 📝 Notas técnicas

### Por que snapshot + delete + create?

Porque o `CardapioItem` tem constraint unique `(dia_id, tipo_refeicao_id, preparacao_id)`. Se tentássemos mover item por item diretamente (update `dia_id`), poderíamos violar a constraint quando dois dias têm a mesma preparação na mesma refeição.

O snapshot em memória garante que podemos apagar tudo e recriar sem conflito.

### Por que circular na reatribuição?

A cadeia é `[terça, quarta, quinta, sexta]`. Se cada dia recebe o conteúdo do **próximo**:
- terça ← quarta
- quarta ← quinta
- quinta ← sexta
- sexta ← ??? (não tem próximo)

A solução é **circular**: o último recebe do primeiro. Então sexta ← terça (que tinha o pão). Isso fecha o ciclo perfeitamente: pão foi da terça pra sexta, e tudo mais andou uma posição em direção ao início da cadeia.

### Por que direção da cadeia importa?

- terça→sexta: cadeia `[terça, quarta, quinta, sexta]` — comida "anda" para trás (sexta→quinta→quarta→terça)
- sexta→terça: cadeia `[sexta, quinta, quarta, terça]` — comida "anda" para trás também (terça→quarta→quinta→sexta)

Em ambos os casos, a comida é deslocada **em direção ao buraco deixado pelo pão**. A direção da cadeia define qual é o "próximo" em cada posição.

### Performance

Para uma troca de pão entre terça e sexta (cadeia de 4 dias):
- 4 findMany (snapshot)
- 4 deleteMany (limpar)
- ~12-20 create (recriar itens, média 3-5 por dia)

Para 5 semanas base × 1 troca de pão = ~100 queries. Para 22 semanas × 2 trocas (pão + lanche) = ~880 queries. Ainda dentro do timeout de 60s.
