# LEIA-ME — Patch v9.10.2 · Modo Troca de Preparações no Editor do Cardápio

**Projeto:** padaria-municipal · **Data:** 30/09/2026
**Formato de aplicação:** extrair o zip na **raiz do projeto** (os caminhos internos já estão corretos).

```
unzip -o patch-v9.10.2-trocar-preparacoes.zip -d ./padaria-municipal
```

---

## 1. O que este patch adiciona

### ⇄ NOVO — Modo Troca: clique em 2 preparações e elas trocam de lugar

No editor do cardápio, **ao lado do botão de copiar o dia** (cabeçalho azul de cada dia da
semana), agora existe um **botão ⇄ (Trocar preparações)**. Ele ativa o *Modo Troca*:

1. Clique no **⇄** no cabeçalho do dia → aparece o banner violeta no topo:
   *"Modo troca: clique na 1ª e depois na 2ª preparação — elas trocam de lugar"*;
2. Clique na **1ª preparação** (qualquer dia/refeição da semana visível) → ela fica com
   **borda violeta** e o banner mostra o nome dela;
3. Clique na **2ª preparação** → as duas **trocam de lugar** instantaneamente (toast de
   confirmação) e o modo desliga sozinho.

**Exemplo:** Strogonoff na Segunda/Almoço e Feijoada na Terça/Almoço → clique no Strogonoff,
depois na Feijoada → a Segunda passa a ter Feijoada e a Terça o Strogonoff. As **porções viajam
junto com a preparação**, e a ordem dentro de cada refeição é preservada.

### Como funciona por dentro (sem truques arriscados)

- **Slots diferentes** (dias e/ou refeições distintos): a API **troca o conteúdo das duas linhas**
  (`preparacao_id` + `porções`) em vez de apagar/recriar itens. Os **ids são preservados**, nada é
  deletado — zero risco de perder item se algo falhar no meio. A tela atualiza de forma otimista
  (sem recarregar).
- **Mesmo slot** (mesmo dia + mesma refeição): troca apenas o campo `ordem` (reordenação manual).
- **Proteção anti-duplicação:** se a preparação que vai entrar **já existe** na refeição de destino
  (por um terceiro item), a troca é **recusada com mensagem amigável** (409) —
  *"Arroz já existe em Terça/Almoço — a troca duplicaria a preparação na mesma refeição"* —
  e nada é alterado.
- **PGBOUNCER (lição v9.10.1):** a transação usada é **curta** (2 updates pontuais em registros já
  carregados, chaves indexadas) — o mesmo padrão das rotas curtas `mover-item`/`trocar-dia`, que
  sempre funcionaram. Nada de transações longas com centenas de inserts.
- **Cardápio de escola (replicado):** a semana trocada é marcada como **"Modificada"**
  (`diferenciada`), igual ao mover/arrastar.
- Enquanto o modo está ativo, **arrastar fica desabilitado** e os botõezinhos internos do item
  (subir/baixo/remover) somem — o clique serve só para selecionar a troca. Saia do modo a qualquer
  momento com **ESC**, no **✕** do banner ou clicando no **⇄** de novo.

---

## 2. Arquivos do patch

| Arquivo | Ação |
|---|---|
| `src/app/api/nutricao/cardapios/[id]/trocar-itens/route.ts` | **NOVO** — API da troca (valida cardápio, pré-checa unique, troca conteúdo/ordem) |
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | **Modificado** — botão ⇄ no cabeçalho do dia, banner do modo, seleção 1ª/2ª, ESC, atualização otimista |

**Sem mudança de schema Prisma.** **Sem `prisma db push`.** Nenhuma outra rota ou página tocada.

---

## 3. Como aplicar e testar

1. Faça commit/pull do estado atual no Codespace antes (rollback fácil).
2. Extraia o zip na raiz: `unzip -o patch-v9.10.2-trocar-preparacoes.zip`.
3. Rode `npm install` se o Codespace estiver limpo.
4. **Teste o Modo Troca** no editor do cardápio:
   - Clique no **⇄** ao lado do botão de copiar em qualquer dia → banner violeta aparece;
   - Clique numa preparação (ex.: proteína de Segunda) → borda violeta + banner mostra o nome;
   - Clique noutra (ex.: proteína de Terça) → as duas trocam de lugar na hora, sem recarregar;
   - Recarregue a página (F5) → a troca **persistiu** no banco.
5. **Teste a proteção:** tente trocar uma preparação por outra que já existe na mesma refeição do
   destino (ex.: há Arroz na Seg e na Ter; troque o Feijão de Seg por... use o Arroz de Ter) →
   deve aparecer a mensagem de duplicação e **nada muda**.
6. **Teste o cancelamento:** ESC, ✕ do banner e clique no próprio item selecionado.
7. **Regressão rápida:** arrastar item entre dias continua funcionando; Copiar dia continua
   funcionando; Gerar Ciclo continua funcionando (v9.10.1 intacta).

## 4. Observações técnicas

- A troca de conteúdo (em vez de mover linhas) mantém `vezes_usada` das preparações intacta
  (cada uma continua usada 1×) e preserva a ordenação automática por categoria (v9.0) de cada slot.
- Validação: `tsc --noEmit` 0 erros; `npm run build` OK; suíte nova
  `scripts/test-troca-v9102.ts` **61/61** (simulação da lógica: trocas entre dias, entre
  refeições, mesma preparação, conflitos 409, ordem, validações + **500 trocas aleatórias
  sem violar a unique** + asserts de fonte do editor); regressões 16/16 (v9.9.5), 18/18 (v9.9.6),
  44/44 (v9.9.7), 21/21 (v9.9.8), 46/46 (v9.9.9), 88/88 (v9.10.0), 49/49 (v9.10.1).
- **Pendente (você pediu para deixar para depois):** recálculo do cardápio para escolas integrais
  (2 refeições/dia). Nada foi tocado nesse ponto.

## 5. Commit sugerido

```
git add .
git commit -m "v9.10.2: Modo Troca de preparações no editor do cardápio

- botão ⇄ ao lado do Copiar dia: clique na 1ª e na 2ª preparação e elas trocam de lugar
- nova API trocar-itens: troca de conteúdo (ids preservados, sem delete/create)
- proteção anti-duplicação na mesma refeição (409 amigável, nada é alterado)
- mesmo slot = troca de ordem; ESC/✕ cancela; semana marcada como Modificada
- sem schema; v9.9.x–v9.10.1 preservadas"
```
