# Patch v9.10.6 — Inst. Extra: escolhe o lanche + separadinho na folha de Lanches + fix do erro de ajuste

> **Este patch SUBSTITUI a v9.10.5 (que ainda não foi aplicada) — aplique SÓ este.**
> Ele contém 100% do conteúdo da v9.10.5 (motorista no Inst. Extra) + as novidades
> desta versão. NÃO aplique a v9.10.5 antes/depois — o `schema.prisma` desta
> versão já inclui as duas colunas novas.

**O que resolve:**

1. **Erro ao ajustar quantidade de lanche de uma escola** (`Foreign key constraint
   violated: Ajuste_escola_id_fkey` / P2003 no console): acontecia ao clicar numa
   linha/célula de uma **instituição do Inst. Extra** (que não é escola) e o sistema
   tentava gravar um ajuste com um id de escola que não existe. Agora:
   - a tela **bloqueia o clique** nas linhas de extras com um aviso explicativo
     ("Produção extra não usa ajuste — edite ou remova pelo botão Inst. Extra");
   - a API de ajustes **valida que a escola existe** antes de gravar (resposta
     amigável em vez de erro 500) — protege também contra tela desatualizada;
   - "Remover Ajuste" virou idempotente (remover o que não existe não é mais erro).

2. **Inst. Extra agora pergunta QUAL lanche/pão vai produzir** — o campo Produto
   virou **"Produto (pão ou lanche)"** com as opções: **Pão Francês**, **Pão de
   Cachorro Quente (PCQ)** e **todos os lanches cadastrados na página Lanches**.
   - Se o lanche escolhido é **o mesmo da semana** (regular/bifásico): entra
     normalmente junto com a produção de lanches (como sempre).
   - Se o lanche escolhido é **DIFERENTE da semana**: o dialog avisa na hora
     ("vai aparecer separadinho na folha de produção de Lanches") e, na
     **impressão**, ele aparece num bloco próprio **"PREPARAÇÃO EXTRA — <nome do
     lanche>"** **na MESMA folha de produção de Lanches** (mesma página, sem
     quebra), com informação mínima: preparação, instituição, dia e quantidade —
     **fora dos totais do lanche normal** (não mistura preparações diferentes).
   - **No romaneio do motorista** (impressão da Produção e página Romaneio), o
     extra continua entrando na tabela de Lanches da rota escolhida, agora com o
     nome da preparação anotado ao lado da instituição (ex.: "Evento Cultural ·
     Torta de Frango") — o motorista sabe o que está levando.
   - Pão Francês e PCQ continuam exatamente como na v9.10.5 (motorista, dia de
     entrega, bloco "Produção Extra" nas páginas de produção e romaneio).

## Ordem de aplicação (OBRIGATÓRIA)

1. **Backup do banco** (recomendado): use o procedimento de backup de sempre.
2. Copie os arquivos do zip sobre a raiz do projeto (preservando os caminhos).
3. **Aplique as novas colunas no banco (OBRIGATÓRIO — 2 colunas):**
   ```bash
   npx prisma db push
   ```
   Adiciona na tabela `ProducaoExtra`: `motorista` (v9.10.5) e `lanche_nome`
   (v9.10.6) — ambas nullable, sem risco para os dados existentes.
4. Gere o client Prisma e faça o build:
   ```bash
   npx prisma generate && npm run build
   ```
5. Reinicie o serviço (`npm run start` ou o supervisor de sempre).

> Se o build/restart acontecer SEM o `db push` do passo 3: os extras deixam de
> aparecer temporariamente (produção e romaneio seguem funcionando; as rotas
> degradam graciosamente). Basta rodar o `db push` depois e recarregar.
> **Se você já tinha aplicado a v9.10.5** (não deveria): o `db push` só adiciona
> a `lanche_nome` — não há conflito.

## Como usar

1. Produção → botão **Inst. Extra** → nome da instituição, dia, motorista.
2. **Produto (pão ou lanche):** escolha Pão Francês, PCQ ou um dos lanches
   cadastrados (a lista vem da página **Lanches** — lanches ativos, em ordem
   alfabética). Se escolher um lanche **diferente do lanche da semana**, o
   sistema avisa na hora que ele vai impresso "separadinho".
3. O extra aparece:
   - **lanches diferentes da semana** → folha "PRODUÇÃO — LANCHES" em bloco
     "PREPARAÇÃO EXTRA — <lanche>" no fim da mesma página + romaneio do motorista
     com a preparação anotada ao lado da instituição;
   - **demais extras** → como na v9.10.5 (bloco "Produção Extra" nas páginas de
     produção e na tabela certa do romaneio do motorista escolhido).
4. A lista "Produções Extras" mostra o lanche escolhido (badge "Lanche: <nome>")
   e selo âmbar **"Fora da semana"** quando a preparação é diferente da semana.
5. A tabela de Lanches da visão Semanal ganhou uma nota quando há extras fora
   da semana (eles não entram nos totais do lanche da semana — é intencional).

### Regras de negócio

- O nome do lanche é gravado como **snapshot** (sem vínculo com a tabela Lanches):
  renomear ou remover o lanche depois NÃO quebra o extra já cadastrado.
- O nome do lanche é comparado com o lanche da semana **na hora de imprimir**
  (ignora maiúsculas/minúsculas e espaços): se a semana mudar de lanche, a
  classificação (mesmo/separado) acompanha a semana impressa.
- **Registros antigos** (antes da v9.10.6, produto Lanche sem lanche escolhido)
  continuam valendo como "lanche da semana" — sem separação, sem anotação.
- Extras **não são afetados por feriado nem por ajuste** (cadastro manual pontual,
  como sempre). PF: o dia do cadastro é o dia de ENTREGA (produção D-1);
  PCQ/Lanche: produção = entrega (D-0).
- **Instituições extras NÃO têm ajuste**: ao clicar na linha delas na Produção
  (Por Dia ou Semanal) aparece um aviso — a edição é remover e recadastrar no
  botão Inst. Extra (é isso que evitava o erro de FK no console).
- Totais da folha de Lanches (linha de dia e TOTAL GERAL) continuam sendo só do
  lanche da semana; cada bloco "PREPARAÇÃO EXTRA" tem o seu próprio total.

## Arquivos do patch

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | `ProducaoExtra.lanche_nome String?` (v9.10.6, **requer db push**) + `motorista String?` (v9.10.5, requerido pelo mesmo db push) |
| `src/app/api/ajustes/route.ts` | **FIX P2003**: valida existência da escola antes do upsert (400 amigável); DELETE idempotente (P2025) |
| `src/components/ajuste-dialog.tsx` | Mostra a mensagem de erro da API no toast |
| `src/app/api/producao/extra/route.ts` | POST aceita/valida `lanche_nome` (obrigatório quando LANCHE, snapshot máx 80); motorista da v9.10.5 intacto |
| `src/app/api/romaneio/route.ts` | Pseudo-escola do extra leva `extra_lanche` (nome do lanche quando FORA da semana) |
| `src/lib/romaneio-utils.ts` | `EscolaRomaneio.extra_lanche?` tipado |
| `src/lib/producao-semana-utils.ts` | (v9.10.5, incluído por ser cumulativo) `EscolaConsolidada.categoria` |
| `src/app/(app)/producao/page.tsx` | Guarda extra\_ nos cliques de ajuste; select "Produto (pão ou lanche)" com os lanches cadastrados; aviso no dialog; blocos "PREPARAÇÃO EXTRA" na P4 (mesma folha); badges na lista; células de extra não-clicáveis na Semanal; anotação no romaneio impresso |
| `src/app/(app)/romaneio/page.tsx` | Anotação "· <lanche>" ao lado da instituição nos extras fora da semana (impressão + tela) |

## Como testar

1. `npx prisma db push` → `npx prisma generate` → `npm run build` → restart.
2. **Teste do fix do ajuste:** Produção → Semanal → clique numa célula de uma
   linha de instituição extra (ou no item dela em Por Dia) → deve aparecer o
   aviso "Produção extra não usa ajuste..." e NENHUM erro P2003 no console.
   Ajuste de escola real continua funcionando normalmente.
3. **Teste do lanche separadinho:** Inst. Extra → "Evento Teste", produto
   **<um lanche DIFERENTE do lanche da semana>**, dia quinta, motorista José,
   quantidade 50 → o dialog avisa que vai separadinho. Imprimir (Produção):
   - folha "PRODUÇÃO — LANCHES": após a tabela do lanche da semana, bloco
     "PREPARAÇÃO EXTRA — <LANCHE>" na MESMA página com "Qui · Evento Teste — 50"
     e "TOTAL EXTRA 50"; os totais do lanche normal NÃO incluem os 50;
   - romaneio "ROTA MOTORISTA JOSÉ — PCQ E LANCHES": linha do extra na tabela de
     lanches (coluna Qui) com "· <lanche>" ao lado do nome, somando no total do
     dia (o motorista leva mesmo).
4. Repita com o **lanche da semana** (mesmo nome) → entra na tabela normal, sem
   bloco separado, sem badge "Fora da semana".
5. Cadastre extra **LANCHE sem lanche escolhido** via API → 400 com mensagem
   amigável (o dialog da UI já impede).
6. Remova os extras de teste (lixeira na lista de Produções Extras).

## Commit

```bash
git add prisma/schema.prisma src/app/api/ajustes/route.ts src/components/ajuste-dialog.tsx src/app/api/producao/extra/route.ts src/app/api/romaneio/route.ts src/lib/romaneio-utils.ts src/lib/producao-semana-utils.ts "src/app/(app)/producao/page.tsx" "src/app/(app)/romaneio/page.tsx"
git commit -m "v9.10.6: Inst. Extra escolhe o lanche (PF/PCQ/lanches cadastrados); lanche fora da semana impresso separadinho na folha de Lanches; fix P2003 no ajuste de escolas"
```

## Validação aplicada antes do envio

- `prisma generate` OK · `tsc --noEmit`: 0 erros · `next build`: OK
- `test-extra-lanche-v9106.ts`: **113/113** (classificador, split da injeção,
  grupos da P4, anotação do romaneio, guarda extra\_, pre-check do ajuste,
  asserts de fonte, consolidador real + 200 semanas aleatórias + contra-prova)
- Regressões: v9.9.0 ✅, v9.9.1 15/15, v9.9.2 31/31, v9.9.3 58/58, v9.9.4 35/35,
  v9.9.6 18/18, v9.9.7 44/44, v9.9.8 21/21, v9.9.9 46/46, v9.10.0 88/88,
  v9.10.1 49/49, v9.10.2 61/61, v9.10.3 70/70, v9.10.4 50/50, v9.10.5 106/106
- Nota: `test-ordenacao-v6` (fora da suíte desde a era v6) tem 3 falhas
  pré-existentes de ordenação canônica — sem relação com este patch (nenhum
  arquivo de ordenação foi tocado).
