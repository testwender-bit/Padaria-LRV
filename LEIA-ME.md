# LEIA-ME — Patch v9.10.1 · Correção do erro "Transaction not found" no Gerar Ciclo

**Projeto:** padaria-municipal · **Data:** 30/09/2026
**Formato de aplicação:** extrair o zip na **raiz do projeto** (os caminhos internos já estão corretos).

```
unzip -o patch-v9.10.1-correcao-erro-gerar-ciclo.zip -d ./padaria-municipal
```

---

## 1. O que este patch corrige

### 🔧 FIX — "Erro ao gerar ciclo PNAE: Transaction API error: Transaction not found (P2028)"

**Causa raiz:** a API `gerar-ciclo` executava **toda a geração dentro de uma transação interativa
do Prisma (`$transaction`)** — até 22 semanas × 6 dias × N itens = **centenas de INSERTs
sequenciais**. No Supabase, a conexão passa pelo **pgbouncer (pooler 6543, modo transaction)**,
que encerra transações longas no meio — o Prisma perde a transação e estoura
`P2028 "Transaction not found"`. É a mesma lição já registrada na **v8.14** no `/clonar`:
*"NÃO usa $transaction — pgbouncer mata transações longas... centenas de INSERTs não cabem em
transação"*. O Replicar funcionou por sorte (menos dados naquele teste) — estava com o mesmo risco.

**Correção (`gerar-ciclo/route.ts` reescrito):**
- **Sem `$transaction`** — escritas sequenciais com `db.` direto (mesmo padrão do `/clonar` v8.14);
- **`createMany` para os itens** (1 query em vez de N) — reduz drasticamente o nº de viagens ao banco;
- **Deleção intercalada**: a semana antiga do número `num` sai **só quando a réplica está pronta
  para entrar no lugar** (antes apagava tudo de uma vez no início da transação). Se algo falhar no
  meio, as semanas do ciclo (1–N) ficam intactas e basta clicar "Gerar Ciclo" **de novo** — a
  operação é reexecutável e completa apenas o que faltou;
- Resposta, mapeamento (`S7 = S1...`), aviso de semanas substituídas e gravação de
  `ciclo_semanas`/`repetir_ciclo`: **exatamente iguais** à v9.10.0 (o editor não mudou).

### 🛡️ BÔNUS — Replicar e Clonar em Lote blindados com o mesmo padrão

- `replicar/route.ts`: removida a transação de 60s que embrulhava **todas as escolas** (N escolas
  × 22 semanas = milhares de INSERTs — o próximo P2028 seria aí). Corpo preservado, agora com
  `createMany` nos clones e nos helpers de realocação de pão/lanche. **Novidade:** se uma escola
  falhar no meio, o cardápio parcial dela é **removido** (cascade) e ela entra em `erros` — sem
  cardápio pela metade no sistema.
- `clonar-lote/route.ts`: mesma conversão (era uma transação só para todas as escolas do lote).

### ✅ O que NÃO mudou

- Rotas de **operações curtas** (copiar-dia, trocar-dia, mover-item, reordenar-semana/dia, item)
  continuam com `$transaction` — são poucas queries, não sofrem do problema;
- Toda a lógica da v9.10.0 (ciclo pelo conteúdo, expansão 6→22, botão "Gerar Ciclo"),
  realocação de pão/lanche (v5), `manter_pao_lanche` (v8.16), exclusão da escola de origem (v8.10),
  Localizar/Substituir (v9.9.6/7), Repetições (v9.9.9): **preservadas**.

---

## 2. Arquivos do patch

| Arquivo | Ação |
|---|---|
| `src/app/api/nutricao/cardapios/[id]/gerar-ciclo/route.ts` | **Reescrito** — sem `$transaction`, `createMany`, deleção intercalada, reexecutável |
| `src/app/api/nutricao/cardapios/[id]/replicar/route.ts` | Blindado — sem transação, `createMany` (5 pontos), cleanup de cardápio parcial, helpers tipados `Prisma.TransactionClient` |
| `src/app/api/nutricao/cardapios/[id]/clonar-lote/route.ts` | Blindado — sem transação, `createMany`, cleanup de cardápio parcial |

**Sem mudança de schema Prisma.** **Sem `prisma db push`.** Editor e páginas: intocados.

---

## 3. Como aplicar e testar

1. Faça commit/pull do estado atual no Codespace antes (rollback fácil).
2. Extraia o zip na raiz: `unzip -o patch-v9.10.1-correcao-erro-gerar-ciclo.zip`.
3. Rode `npm install` se o Codespace estiver limpo.
4. **Teste o Gerar Ciclo no cardápio que deu erro** (o teste que falhou):
   - Abra o cardápio com as 5–6 semanas montadas → "Gerar Ciclo" → confira a prévia
     (ex.: 6 semanas → S7 = S1 ... S22 = S4) → confirme.
   - Agora deve gerar as semanas **sem o erro P2028** e recarregar o cardápio com
     as 22 semanas preenchidas ciclicamente.
   - Confira a semana 7 (cópia da 1), a 12 (cópia da 6), a 13 (cópia da 1) e a 22 (cópia da 4, no ciclo 6).
5. **Regressão do Replicar**: replique um cardápio para 1–2 escolas com "Expandir para 22 semanas"
   e confira que o cardápio da escola nasceu completo (comportamento igual ao que funcionou).
6. **Regressão do Clonar em Lote** (se usar): clone o base para uma escola de teste.

## 4. Observações técnicas

- **Por que transações curtas funcionam e longas não:** o pgbouncer em modo *transaction*
  empresta a conexão física ao servidor por transação; transações longas (dezenas de segundos ou
  muitas queries) têm a conexão física reciclada e o Prisma recebe "Transaction not found".
  Escritas diretas (autocommit) não têm esse problema.
- **Reexecutabilidade:** se a internet cair no meio do "Gerar Ciclo", clique de novo — a semana em
  processamento é deletada e recriada do zero, e as que já ficaram prontas são recriadas idênticas.
- Sem `diferenciada` nas réplicas (igual v9.10.0): editar uma réplica marca só ela como "Modificada".
- Validação: `tsc --noEmit` 0 erros; `npm run build` OK; suíte nova
  `scripts/test-p2028-v9101.ts` **49/49** (inclui simulação lógica do loop intercalado +
  reexecução idempotente); regressões 16/16 (v9.9.5), 18/18 (v9.9.6), 44/44 (v9.9.7),
  21/21 (v9.9.8), 46/46 (v9.9.9), 88/88 (v9.10.0).
- **Pendente (você pediu para deixar para depois):** recálculo do cardápio para escolas integrais
  (2 refeições/dia). Nada foi tocado nesse ponto.

## 5. Commit sugerido

```
git add .
git commit -m "v9.10.1: fix P2028 'Transaction not found' no Gerar Ciclo

- gerar-ciclo reescrito sem \$transaction (pgbouncer mata transações longas):
  escritas sequenciais + createMany + deleção intercalada (reexecutável)
- replicar e clonar-lote blindados com o mesmo padrão (eram o próximo P2028)
- escola que falhar no meio da replicação/clonagem não deixa cardápio parcial
- sem schema; comportamento da v9.10.0 preservado"
```
