# LEIA-ME — Patch v9.10.3 · Trocar o Dia Inteiro no Editor do Cardápio

**Projeto:** padaria-municipal · **Data:** 01/10/2026
**Formato de aplicação:** extrair o zip na **raiz do projeto** (os caminhos internos já estão corretos).

```
unzip -o patch-v9.10.3-trocar-dia-inteiro.zip -d ./padaria-municipal
```

---

## 1. O que este patch adiciona

### 📅⇄ NOVO — Modo Trocar Dia: troca TODAS as preparações entre dois dias

No editor do cardápio, no **cabeçalho azul de cada dia**, agora existe um **botão 📅⇄ (Trocar
o dia inteiro)** — entre o **⇄** (trocar preparações, v9.10.2) e o **Copiar**. Ele ativa o
*Modo Trocar Dia*, com a mesma interação de 2 cliques da troca de preparações:

1. Clique no **📅⇄** no cabeçalho do dia de origem (ex.: Terça) → banner **indigo** aparece no
   topo: *"1º dia: Terça — agora clique no 2º dia (no cabeçalho azul)"*. O dia escolhido fica
   destacado com **borda violeta**;
2. Clique no cabeçalho do 2º dia (ex.: Quarta) — o cabeçalho **inteiro** fica clicável
   (hover violeta) → **tudo troca de lugar na hora**: todas as preparações da Terça vão para a
   Quarta e as da Quarta vão para a Terça (toast de confirmação com o total movido);
3. O modo desliga sozinho. **ESC**, **✕** do banner ou **clicar no mesmo dia de novo**
   cancelam a seleção.

**Exemplo:** Terça tem Desjejum + Almoço (2 preparações) e Quarta tem Almoço com 2 preparações
→ clique no 📅⇄ da Terça, depois no cabeçalho de Quarta → a Terça passa a ter o Almoço completo
da Quarta e a Quarta passa a ter o Desjejum + Almoço da Terça. **Cada preparação continua na
sua refeição** (Desjejum continua no Desjejum, Almoço no Almoço), com **porções e ordem
preservadas** — apenas muda o dia.

### Como funciona por dentro (seguro)

- A API **`trocar-dia`** (que já existia mas não era usada) foi **reescrita**: snapshot dos dois
  dias → apaga os dois → recria cruzado com **`createMany`** (1 query por lote). Por que
  delete+create e não troca de conteúdo igual à v9.10.2? Porque os dias podem ter
  **quantidades diferentes de preparações por refeição** — não há correspondência 1:1 para
  trocar linha a linha.
- **Zero risco de duplicação:** como os dois dias são zerados antes de recriar, cada dia recebe
  um único lote vindo de um dia válido — a unique `(dia, refeição, preparação)` **nunca é
  violada**, mesmo se a mesma preparação existir nos dois dias (validado com 500 trocas
  aleatórias na suíte de testes).
- **PGBOUNCER (lição v9.10.1):** **SEM `$transaction`** — a versão antiga da rota usava
  transação com loop de inserts (o padrão que quebrava com P2028 no pooler). Agora são no
  máximo 2 deletes + 2 creates em lote, mesmo padrão do Gerar Ciclo/Replicar corrigidos.
- **A tela recarrega o cardápio** logo após a troca (os itens são recriados no banco com ids
  novos) — sem isso, remover/trocar uma preparação logo depois daria erro. É rápido e
  transparente.
- **Cardápio de escola (replicado):** a semana trocada é marcada como **"Modificada"**
  (`diferenciada`), igual às outras operações.
- Enquanto o modo está ativo: **arrastar fica desabilitado**, os botões **⇄** e **Copiar** do
  cabeçalho ficam esmaecidos (o clique em qualquer lugar do cabeçalho seleciona o dia) e os
  itens ficam inertes. Os dois modos de troca são **mutuamente exclusivos** — ativar um desliga
  o outro.

---

## 2. Arquivos do patch

| Arquivo | Ação |
|---|---|
| `src/app/api/nutricao/cardapios/[id]/trocar-dia/route.ts` | **Reescrito** — API pgbouncer-safe (snapshot + deleteMany ×2 + createMany ×2, sem transação) com validações e noop amigável |
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | **Modificado** — botão 📅⇄ no cabeçalho, banner indigo, seleção 1º/2º dia, ESC, recarga do cardápio, exclusão mútua com o modo ⇄ |

**Sem mudança de schema Prisma.** **Sem `prisma db push`.** Nenhuma outra rota ou página tocada.
A rota mantém o mesmo contrato de body/resposta que já tinha (`semana_numero`, `dia_a`, `dia_b`).

---

## 3. Como aplicar e testar

1. Faça commit/pull do estado atual no Codespace antes (rollback fácil).
2. Extraia o zip na raiz: `unzip -o patch-v9.10.3-trocar-dia-inteiro.zip`.
3. Rode `npm install` se o Codespace estiver limpo.
4. **Teste o Modo Trocar Dia** no editor do cardápio:
   - Clique no **📅⇄** no cabeçalho de Terça → banner indigo: *"1º dia: Terça — agora clique no
     2º dia"* e Terça com borda violeta;
   - Passe o mouse sobre os outros cabeçalhos → ficam clicáveis (hover violeta);
   - Clique no cabeçalho de Quarta → **todas as preparações trocam de dia** na hora, toast
     confirma ("Dias trocados: Terça ⇄ Quarta (N preparações movidas)");
   - Recarregue a página (F5) → a troca **persistiu** no banco.
5. **Teste os casos especiais:**
   - Dia vazio ⇄ dia cheio → o conteúdo todo migra para o dia vazio (movimentação);
   - Mesma preparação nos dois dias (ex.: Arroz no Almoço de Ter e Qua) → troca sem erro;
   - ESC, ✕ do banner e reclique no mesmo dia cancelam.
6. **Regressão rápida:** ⇄ de preparações (v9.10.2) continua funcionando; ativar um modo
   desliga o outro; arrastar item entre dias continua funcionando; Copiar dia, Gerar Ciclo e
   Replicar intactos.

## 4. Observações técnicas

- A troca preserva: slot (refeição), `porcoes`, `ordem` de cada preparação. Os **ids dos itens
  mudam** (delete+create) — por isso o editor recarrega o cardápio após a troca.
- Validação: `tsc --noEmit` 0 erros; `npm run build` OK; suíte nova
  `scripts/test-troca-dia-v9103.ts` **70/70** (simulação da lógica: trocas com quantidades
  diferentes por slot, dia vazio, ambos vazios, mesma preparação nos dois dias, involution,
  validações 400/404 + asserts de fonte pgbouncer-safe + **500 trocas aleatórias sem perder
  item e sem violar a unique**); regressões 16/16 (v9.9.5), 18/18 (v9.9.6), 44/44 (v9.9.7),
  21/21 (v9.9.8), 46/46 (v9.9.9), 88/88 (v9.10.0), 49/49 (v9.10.1), 61/61 (v9.10.2 — dois
  asserts de fonte sincronizados com o ESC/drag dos dois modos).
- **Pendente (você pediu para deixar para depois):** recálculo do cardápio para escolas
  integrais (2 refeições/dia). Nada foi tocado nesse ponto.

## 5. Commit sugerido

```
git add .
git commit -m "v9.10.3: Trocar o dia inteiro no editor do cardápio

- botão 📅⇄ no cabeçalho do dia: clique no 1º dia e no 2º e TODAS as preparações trocam de lugar
- API trocar-dia reescrita pgbouncer-safe: snapshot + deleteMany x2 + createMany x2, sem $transaction
- preserva refeição/porções/ordem; unique (dia, tipo, preparacao) nunca violada (dias zerados antes)
- recarrega cardápio após troca (ids novos); ESC/✕/reclique cancela; exclusão mútua com modo ⇄
- sem schema; v9.9.x–v9.10.2 preservadas"
```
