# LEIA-ME — Patch v9.10.4 · PCQ em Dia Excepcional (Terça/Quinta via ajuste manual)

**Projeto:** padaria-municipal · **Data:** 01/10/2026
**Formato de aplicação:** extrair o zip na **raiz do projeto** (os caminhos internos já estão corretos).

```
unzip -o patch-v9.10.4-pcq-dia-excepcional.zip -d ./padaria-municipal
```

**Sem migração de banco** — nenhum `prisma db push` é necessário. O schema não muda; a
produção excepcional usa o sistema de **Ajustes** que já existe.

---

## 1. O que este patch resolve

O PCQ (pão de cachorro quente) é produzido **segunda, quarta e sexta** (produção = entrega,
D-0). Esse padrão **continua igual** — é o fluxo normal. Mas existem **situações excepcionais**
em que a produção precisa acontecer em **outro dia** (terça ou quinta), e o sistema simplesmente
não permitia: a API não gerava itens de PCQ nesses dias e as colunas Ter/Qui da tabela semanal
eram neutras ("—"), sem clique.

Agora é possível **adicionar produção de PCQ manualmente em Terça ou Quinta**, direto da
tela de Produção, e ela aparece **em todo lugar de forma correta**: view Semanal, view Por Dia,
**impressão da produção (P3 — PCQ)** e **romaneio** (entrega no mesmo dia).

---

## 2. Como usar (fluxo do dia a dia)

1. Na página **Produção**, na view **Semanal**, na tabela **Pão de Cachorro Quente**:
   as colunas **Ter** e **Qui** agora são clicáveis (com um **+** discreto nas células vazias);
2. Clique na célula **Ter** (ou **Qui**) da escola desejada → abre o **Ajustar Quantidade**
   (o mesmo dialog de ajustes que já existia);
3. Informe a **Quantidade Final** (ex.: 40 formas) e o **Motivo** (obrigatório — ex.:
   "Evento na escola") → **Salvar Ajuste**;
4. Pronto: a produção de PCQ aparece **na terça** — na view Semanal, na view Por Dia (card
   da terça), no **Total PCQ** do dia e da semana, na **impressão da produção (P3)** e no
   **romaneio** (o motorista leva na terça, pois PCQ é produção = entrega);
5. O ajuste fica **destacado em âmbar com ●** (passe o mouse para ver original e motivo) e
   vale **só para aquela semana** (sem conflito com as demais). Para remover, clique na
   célula → **Remover Ajuste** — a terça volta a ficar vazia automaticamente.

**Zerar um dia padrão:** se precisar *mover* a produção da quarta para a terça, basta também
ajustar a quarta para 0 (fluxo de ajuste normal, já existente).

---

## 3. Como funciona por dentro (seguro)

- **API `/api/producao`:** dias padrão (seg/qua/sex) continuam gerando PCQ para TODAS as
  escolas que recebem (comportamento v9.7.3 preservado). Nos dias **excepcionais (ter/qui)**,
  o bloco PCQ passa a rodar **apenas quando existir pelo menos um ajuste de PCQ para aquele
  dia naquela semana** — e gera itens **somente para as escolas ajustadas**. Assim a view
  Por Dia não fica poluída com dezenas de linhas zeradas numa terça "normal".
  Checagem em memória (a lista de ajustes já era carregada) — **zero queries novas**.
- **Quantidade base 0 na ter/qui:** o schema não tem `prod_terca`/`prod_quinta` (por design —
  não são dias padrão), então a quantidade vem **do ajuste**; sem ajuste, não existe item.
- **Feriado × ajuste:** com feriado que zera PCQ na terça, a produção excepcional **não é
  criada automaticamente** (nada muda para quem não ajustou). Se houver ajuste manual, ele
  **vence o feriado** — quem escreveu o motivo manda (mesma prioridade dos ajustes dos dias
  padrão, validada nos testes).
- **API `/api/romaneio`:** nos dias ter/qui, o ajuste de PCQ vira **entrega no mesmo dia**
  (PCQ é D-0), alinhado com a produção — o romaneio do motorista e a impressão dele mostram
  a quantidade na terça/quinta, sem divergência.
- **Consolidador semanal e impressão:** a view Semanal, a linha "Total PCQ" e a impressão
  P3 já renderizavam qualquer coluna com valor — agora os dados chegam preenchidos e tudo
  aparece **sem nenhuma mudança na impressão** (o valor da terça entra na coluna Ter, com o
  "—" sumindo naturalmente; a legenda "(N) = pães" das unidades Busca Própria também funciona
  nos dias excepcionais).
- **Regra v9.7.5 (anti-vazamento) preservada:** PF continua sem produção na sexta e com
  colunas neutras certas. Para PCQ não há risco, pois produção = entrega (D-0): um ajuste
  `escola_terca_PCQ` só aparece na coluna Ter da tabela de PCQ.
- **Domingo continua neutro** para PCQ (não existe produção de PCQ no domingo).

---

## 4. Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/producao-utils.ts` | `DIAS_PRODUCAO_POR_PRODUTO.PCQ` agora inclui `terca` e `quinta` (células clicáveis na view Semanal; domingo continua fora). PF/LANCHE/PF_COMP intocados. |
| `src/app/api/producao/route.ts` | Bloco PCQ do loop de dias: aceita dias excepcionais (ter/qui) quando há ajuste PCQ do dia na semana; gera itens só para escolas ajustadas; `pcqConfig` opcional (qtd base 0, entrega = próprio dia). |
| `src/app/api/romaneio/route.ts` | Dias sem config padrão (ter/qui): aplica ajuste `PCQ` como entrega no mesmo dia. |
| `src/app/(app)/producao/page.tsx` | Tabela PCQ da view Semanal: células Ter/Qui clicáveis com "+", title dinâmico ("Clique para adicionar produção excepcional de PCQ neste dia") e nota de legenda no rodapé do card. |

---

## 5. Validação (antes de aplicar)

- `npx tsc --noEmit` → 0 erros;
- `npm run build` → OK;
- Suíte nova `test-pcq-excepcional-v9104.ts` → **50/50**:
  - Parte A (14): simulação fiel do bloco PCQ — dia excepcional com/sem ajuste, dia padrão
    inalterado, ajuste vence feriado, guard por escola, Busca Própria;
  - Parte B (20): asserts de fonte nos 5 arquivos;
  - Parte C (16): consolidador REAL + impressão + 200 semanas aleatórias com 0 violações
    (item em ter/qui só com ajuste; somas batem; escola sem PCQ nunca aparece).
- Regressões históricas: v9.9.5 16/16 · v9.9.6 18/18 · v9.9.7 44/44 · v9.9.8 21/21 ·
  v9.9.9 46/46 · v9.10.0 88/88 · v9.10.1 49/49 · v9.10.2 61/61 · v9.10.3 70/70.

## 6. Como testar após aplicar

1. `npm run build` (ou rode dev) e abra **Produção** numa semana com PCQ configurado;
2. Na tabela de PCQ, clique no **+** de uma escola na coluna **Ter** → digite 40 e um motivo → Salvar;
3. Confira: célula da terça mostra **40** com destaque âmbar; card da **terça** na view Por Dia
   tem o card PCQ; **Imprimir** → página P3 (PCQ) mostra 40 na coluna Ter (e o total do dia);
4. Abra **Romaneio** → a tabela da rota da escola mostra o PCQ na terça (impressão do motorista também);
5. Clique na célula ajustada → **Remover Ajuste** → a terça volta a ficar vazia em todos os lugares.

---

## 7. Observações

- O cadastro padrão (**Configurações → PCQ**) **continua com os dias seg/qua/sex** — é
  intencional; a produção excepcional é pontual, por semana, e fica registrada como ajuste
  com motivo (rastreável no sistema de ajustes).
- O ajuste grava quantidade **inteira** (limitação existente do sistema de ajustes para todos
  os produtos). Produções excepcionais fracionárias (ex.: 0,5 forma) não são suportadas pelo
  ajuste — se precisar disso no futuro, é uma evolução separada (converter Ajuste para Float).
- A **previsão de custos** (Controle de Estoque) continua estimando PCQ pelos dias padrão
  seg/qua/sex — é uma ferramenta de projeção da configuração fixa, não considera ajustes
  pontuais (comportamento anterior mantido).
