# LEIA-ME — Patch v9.10.0 · Replicar Ciclo de Semanas (6 → 22)

**Projeto:** padaria-municipal · **Data:** 30/09/2026
**Formato de aplicação:** extrair o zip na **raiz do projeto** (os caminhos internos já estão corretos).

```
unzip -o patch-v9.10.0-replicar-semanas-e-gerar-ciclo-ate-22.zip -d ./padaria-municipal
```

---

## 1. O que este patch corrige / entrega

### 🔧 FIX — "Replicar não replica as semanas"

**Causa raiz encontrada:** todo cardápio é criado com **22 linhas de semanas (vazias)** e o campo
`ciclo_semanas` fica travado no **default 5**. A API de replicar decidia se o cardápio estava
"completo" contando **linhas** (`semanas.length >= 22` → sempre verdadeiro!). Resultado: ela clonava
as 22 linhas — as 6 preenchidas + 16 vazias — e **nunca executava a expansão do ciclo**.

**Correção:** o ciclo agora é detectado pelo **CONTEÚDO** (maior semana com itens lançados).
Montou 6 semanas? A replicação clona as semanas 1–6 e gera as semanas 7–22 repetindo o ciclo:
`S7 = S1, S8 = S2, ..., S12 = S6, S13 = S1, ... S22 = S4`. O campo `ciclo_semanas` do cardápio
criado também passa a ser gravado com o valor real (6), não mais o default dessincronizado.

Funciona para **qualquer** tamanho de ciclo (2 a 21 semanas preenchidas) e para cardápio base
**ou** de escola (v9.9.8). Cardápio com as 22 semanas preenchidas continua sendo clonado inteiro
sem expansão, como antes. Realocação de pão/lanche (v5), `manter_pao_lanche` (v8.16), exclusão da
escola de origem e preservação do `cardapio_base_id` (v8.10): tudo preservado.

### ✨ NOVO — Botão "Gerar Ciclo" dentro do editor do cardápio

Agora você também pode **gerar o ciclo no próprio cardápio**, sem precisar replicar:

1. Monte as semanas 1–N no editor (ex.: 6 semanas).
2. Clique em **"Gerar Ciclo"** (botão verde-água na barra superior, ao lado de "Repetições").
3. O dialog mostra:
   - **Ciclo detectado** (ex.: 6 semanas, S1–S6) — pelo conteúdo, não por campo salvo;
   - **Semanas a gerar** (ex.: 16, S7–S22);
   - **Prévia da repetição** em chips (`S7 = S1`, `S8 = S2`, ...);
   - **Aviso em âmbar** se alguma semana além do ciclo já tiver conteúdo (ela será substituída).
4. Confirme em **"Gerar semanas 7–22 (16)"** → as semanas são criadas e o cardápio recarrega.

A API `POST /api/nutricao/cardapios/[id]/gerar-ciclo` **já existia no backend, mas nenhum botão a
usava** (mesmo caso da v9.9.6). Ela foi corrigida: antes usaria `ciclo_semanas = 5` e
**deletaria a semana 6 preenchida** de um cardápio de 6 semanas. Agora o ciclo é sempre o
detectado pelo conteúdo, e as semanas do ciclo (S1–S6) **não são tocadas**.

### 📄 Página "Replicar p/ Escolas" — exibição honesta do ciclo

- O resumo "Semanas base" agora mostra o **ciclo real** detectado (não mais o "5" fixo);
- Se o campo salvo divergir do conteúdo, aparece a anotação "ciclo real (conteúdo)";
- O texto do checkbox "Expandir para 22 semanas" mostra o mapeamento dinâmico
  (ex.: "...réplicas automáticas repetindo o ciclo (S7 = S1, S8 = S2, ...)").

---

## 2. Arquivos do patch

| Arquivo | Ação |
|---|---|
| `src/lib/cardapio-ciclo-utils.ts` | **NOVO** — util `detectarCicloReal()`, `semanasComConteudo()`, `mapearCicloSemestre()` (usado por APIs e telas) |
| `src/app/api/nutricao/cardapios/[id]/replicar/route.ts` | Corrigido — ciclo por conteúdo, expansão 6→22, grava `ciclo_semanas` real, resposta com `ciclo_detectado/ciclo_usado` |
| `src/app/api/nutricao/cardapios/[id]/gerar-ciclo/route.ts` | Corrigido — ciclo por conteúdo, erro amigável se vazio, grava ciclo real, resposta com `semanas_substituidas_com_conteudo` |
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Editor — botão "Gerar Ciclo" + dialog com prévia do mapeamento e aviso de substituição |
| `src/app/(app)/nutricao/cardapios/[id]/replicar/page.tsx` | Página — ciclo real no resumo + texto do expandir com mapeamento |

**Sem mudança de schema Prisma** — `ciclo_semanas` e `repetir_ciclo` já existiam. **Sem `prisma db push`.**

---

## 3. Como aplicar e testar

1. Faça commit/pull do estado atual no Codespace antes (rollback fácil).
2. Extraia o zip na raiz: `unzip -o patch-v9.10.0-replicar-semanas-e-gerar-ciclo-ate-22.zip`.
3. Rode `npm install` se o Codespace estiver limpo.
4. Teste o **Gerar Ciclo** (editor):
   - Abra um cardápio com 5–6 semanas montadas → "Gerar Ciclo" → confira a prévia
     (ex.: 6 semanas → S7 = S1 ... S22 = S4) → confirme → navegue pelas semanas 7+ e
     verifique que são cópias fiéis do ciclo; as datas devem seguir a semana 1.
   - Teste também num cardápio vazio (deve dizer que não há conteúdo) e num cardápio
     com as 22 semanas preenchidas (deve dizer "nada a gerar").
5. Teste o **Replicar p/ Escolas**:
   - No cardápio de 6 semanas: seleciona escolas → "Expandir para 22 semanas" marcado → replicar.
   - Abra o cardápio criado da escola: as semanas 7–22 devem estar preenchidas com o ciclo,
     e o resumo da replicação deve listar o cardápio com `ciclo_usado: 6`.
6. Opcional (validação em massa): gere uma **Lista de Compras** ou a **Produção** de uma semana
   réplica (ex.: S8 = S2) para conferir que o motor de cálculo enxerga os itens replicados.

## 4. Observações técnicas

- Expansão da replicar continua dentro da transação de 60s existente (`pgbouncer`-safe, igual v5+).
- `gerar-ciclo` usa transação curta e apaga apenas semanas **além do ciclo** antes de recriar;
  semanas do ciclo são preservadas (com suas edições e flag "Modificada").
- As réplicas nascem sem `diferenciada` — editar uma réplica específica marca só ela como
  "Modificada", sem afetar o resto do ciclo.
- Nenhuma feature anterior foi alterada: Localizar/Substituir (v9.9.6/7), Repetições (v9.9.9),
  Replicar p/ Escolas sem gate (v9.9.8), dialog de preparações (v9.9.4/5) — todos revalidados
  pelas suítes de regressão (16/16, 18/18, 44/44, 21/21, 46/46) + 88/88 testes novos
  (`scripts/test-ciclo-v9100.ts`).
- **Pendente (você pediu para deixar para depois):** recálculo do cardápio para escolas integrais
  (2 refeições/dia). Nada foi tocado nesse ponto.

## 5. Commit sugerido

```
git add .
git commit -m "v9.10.0: fix replicar ciclo de semanas (6→22) + botão Gerar Ciclo no editor

- ciclo detectado pelo CONTEÚDO (maior semana com itens) em vez do campo
  ciclo_semanas (default 5 dessincronizado) e da contagem de linhas
- replicar: clona semanas 1..N e expande réplicas até a 22 (S7=S1...)
- gerar-ciclo: API agora usável e segura (não deleta semana preenchida)
- editor: botão 'Gerar Ciclo' com prévia do mapeamento e avisos
- página replicar: exibe ciclo real e mapeamento dinâmico
- novo util src/lib/cardapio-ciclo-utils.ts (sem schema)"
```
