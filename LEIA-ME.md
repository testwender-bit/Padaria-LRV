# Fix v9.6.7 — Mensagem de aviso (obs) + Relatório do sistema de Insumos

## PARTE 1: Mensagem de aviso (obs) do cardápio

### O problema

A mensagem de aviso que você deixava no campo de observação do cardápio
da padaria **não aparecia** na dashboard nem na página de produção —
mesmo estando na semana correta.

### Causa raiz

Três bugs combinados:

1. **API de produção NÃO retornava `obs`**: o campo existia no banco
   (`CardapioSemestral.obs`) mas a API `/api/producao` nunca o incluía
   na resposta JSON. O frontend já tinha a UI pronta (4 lugares que
   exibem `data.obs`), mas o campo sempre vinha `undefined`.

2. **API de romaneio**: mesmo problema — não retornava `obs`.

3. **Dashboard**: nem tinha `obs` na interface `DashboardData`, nem
   buscava o campo, nem tinha UI para exibir.

4. **Cardápio admin**: a interface tinha `obs` declarado no TypeScript
   mas **nenhum input** para editar — era impossível cadastrar o aviso.

### Fix implementado

#### 1. API de produção (`/api/producao/route.ts`)

- Adicionada variável `matchExato` que é `true` apenas se o cardápio foi
  encontrado por `numero_semana_iso` (match exato da semana ISO).
- Se caiu no fallback (date range), `matchExato = false`.
- A resposta agora inclui: `obs: matchExato ? (cardapioFinal?.obs || null) : null`
- **Resultado**: o aviso SÓ aparece na semana correta. Se o sistema
  encontrou o cardápio por fallback de data (semana ISO não bateu), o
  aviso não aparece — evita mostrar aviso de outra semana.

#### 2. API de romaneio (`/api/romaneio/route.ts`)

- Mesma lógica: `matchExato` + `obs` na resposta.

#### 3. Dashboard (`/dashboard/page.tsx`)

- Adicionado `obs: string | null` à interface `DashboardData`.
- Populado a partir de `producao.obs`.
- Adicionado **banner amarelo** no topo (abaixo do header) com
  `AlertCircle` + o texto do aviso — só aparece se `data.obs` existir.

#### 4. Cardápio admin (`/cardapio/page.tsx`)

- Adicionado **textarea** "Aviso da Semana (observação)" no formulário
  de editar cardápio (abaixo dos campos de Lanche).
- Placeholder explica: "Ex: Semana com feriado na quinta — produção
  reduzida."
- Nota abaixo explica: "Aparece como banner no Dashboard e na página
  de Produção APENAS nesta semana (match exato da semana ISO)."

### Como usar

1. Vá em **Cardápio → Editar** a semana desejada.
2. No campo "Aviso da Semana", digite a observação.
3. Salve.
4. Vá no **Dashboard** — o banner amarelo aparece no topo (apenas se
  você estiver visualizando a mesma semana).
5. Vá em **Produção** — o banner aparece na tela e na impressão
  (4 lugares: PF 1ª via, PF 2ª via, PCQ/Lanches, Romaneios).
6. **Semana errada**: se você navegar para outra semana, o aviso **não
  aparece** — só aparece na semana exata do cardápio.

---

## PARTE 2: Verificação profunda do sistema de Insumos

### Visão geral

O sistema de Insumos (menu "Insumos" → URL `/custos`) tem a estrutura
básica montada, mas **vários gaps** que comprometem a função de
"auditoria, acompanhamento e controle".

### Modelos do banco (schema.prisma)

| Modelo | Função | Problemas |
|---|---|---|
| `Insumo` | Cadastro de insumos (nome, unidade, preço, estoque) | **Sem `criado_em`/`atualizado_em`** — impossível auditar quando foi criado/alterado |
| `Receita` | Composição: X kg de insumo por 1 unidade de PF/PCQ/Lanche | OK — funcional |
| `MovimentacaoEstoque` | Log de ENTRADA/SAIDA manual | **Sem `criado_por`/`usuario_id`** — não sabe quem registrou; sem `criado_em` timestamp |
| `PedidoCompra` | Pedidos de compra a fornecedores | OK — tem `criado_em` |
| `ItemPedidoCompra` | Itens de um pedido | OK |
| `ContagemEstoque` | Contagem física (auditoria) | Tem `criado_em` mas **sem `usuario_id`**; **não reconcilia** `estoque_atual` |

### Páginas (URL `/custos/...`)

| Página | Função | Estado |
|---|---|---|
| `/custos` | Dashboard: KPIs + tabela comparativa (Estimado × Pedido × Estoque × Contagem × Variação × Status) | ✅ Funcional (read-only) |
| `/custos/previsao` | Previsão de demanda N semanas à frente | ✅ Funcional |
| `/custos/contagem` | Registrar contagem física | ⚠️ Não reconcilia estoque |
| `/custos/receitas` | Cadastrar receitas (insumo × produto) | ✅ Funcional |
| `/custos/compras` | Pedidos de compra | ✅ Funcional (CRUD + receber) |
| `/custos/movimentacoes` | Registrar ENTRADA/SAIDA manual | ⚠️ Sem paginação (só 100); sem filtro por data |
| `/custos/analise` | **Stub vazio** — só redireciona para `/previsao` | ❌ Morto |

### APIs

| Endpoint | Métodos | Problemas |
|---|---|---|
| `/api/insumos` | GET, POST | ❌ **Sem `[id]/route.ts`** — não tem PUT/DELETE; POST é dead code (nenhuma UI chama) |
| `/api/receitas` | GET, POST (upsert) | OK |
| `/api/movimentacoes` | GET, POST | ⚠️ GET hard-capped em `take: 100`; sem filtro |
| `/api/compras` | GET, POST, PUT, DELETE | ✅ CRUD completo + receber |
| `/api/contagem` | GET, POST | ⚠️ POST não atualiza `Insumo.estoque_atual` |
| `/api/custos/insumos-semana` | GET | ✅ Orquestra dashboard |
| `/api/custos/previsao` | GET | ✅ Projeção multi-semana |

### Bugs e gaps identificados

#### ❌ Bug 1: Impossível criar/editar/excluir Insumos

- `POST /api/insumos` existe mas **nenhuma página chama** — é dead code.
- Não existe `PUT /api/insumos/[id]` nem `DELETE`.
- Não existe página "Gerenciar Insumos".
- Insumos só podem ser criados via seed ou chamada manual à API.
- O flag `ativo` (soft-delete) existe mas não pode ser toggled via UI.

**Impacto**: usuário não consegue cadastrar novos insumos, editar
preços, nem desativar insumos obsoletos.

#### ❌ Bug 2: Contagem não reconcilia estoque

- `POST /api/contagem` registra `ContagemEstoque` com `estoque_sistema`
  e `diferenca`, mas **NÃO atualiza** `Insumo.estoque_atual`.
- Para ajustar o estoque ao valor físico, o usuário precisa ir em
  Movimentações e criar uma SAIDA/ENTRADA manual — não há botão
  "ajustar ao físico".

**Impacto**: contagem é apenas um registro — não corrige o estoque
do sistema. A diferença fica registrada mas o estoque continua errado.

#### ❌ Bug 3: Sem trilha de auditoria (quem fez o quê)

- `MovimentacaoEstoque` não tem `criado_por`/`usuario_id`.
- `ContagemEstoque` não tem `usuario_id`.
- `Insumo` não tem `criado_em`/`atualizado_em`.
- Não existe modelo `Auditoria`/`EstoqueLog` dedicado.

**Impacto**: impossível saber QUEM registrou cada movimentação ou
contagem. Para auditoria real, isso é crítico.

#### ⚠️ Bug 4: Movimentações sem paginação/filtro

- `GET /api/movimentacoes` retorna apenas os últimos 100 registros.
- Sem filtro por data, insumo, ou tipo.
- Se houver muitas movimentações, as antigas somem da view.

#### ⚠️ Bug 5: Página `/custos/analise` é stub

- 6 linhas que só fazem `redirect('/custos/previsao')`.
- Pode ser removida ou implementada.

### Recomendações para tornar o sistema completo

Para que o sistema de Insumos atenda plenamente "auditoria,
acompanhamento e controle", seria necessário:

1. **Criar página "Gerenciar Insumos"** (`/custos/insumos`):
   - Listar todos os insumos (com estoque atual, mínimo, preço, fornecedor)
   - Botão "Novo Insumo" (dialog com nome, unidade, preço, estoque, mínimo, fornecedor)
   - Botão "Editar" e "Desativar" por insumo
   - Criar API `/api/insumos/[id]/route.ts` com PUT e DELETE

2. **Reconciliar contagem com estoque**:
   - Adicionar botão "Ajustar ao Físico" na página de Contagem
   - Ao clicar, cria uma `MovimentacaoEstoque` de ajuste (ENTRADA ou
     SAIDA) com a diferença, e atualiza `Insumo.estoque_atual`

3. **Adicionar trilha de auditoria** (requer schema + auth):
   - Adicionar `criado_por: String?` em `MovimentacaoEstoque` e
     `ContagemEstoque`
   - Adicionar `criado_em: DateTime @default(now())` e
     `atualizado_em: DateTime @updatedAt` em `Insumo`
   - Capturar o usuário da sessão (requer sistema de auth que ainda
     não está implementado — hoje é login simples sem sessão real)

4. **Paginação e filtro em Movimentações**:
   - Adicionar query params `?data_inicio=...&data_fim=...&insumo_id=...&tipo=...`
   - Retornar com paginação (`take`/`skip`)

5. **Remover ou implementar `/custos/analise`**

### Resumo do estado atual

O sistema de Insumos **está parcialmente funcional** para:
- ✅ Visualizar dashboard (estoque, custo, déficit, pedidos pendentes)
- ✅ Prever demanda das próximas semanas
- ✅ Criar pedidos de compra e registrar recebimento
- ✅ Cadastrar receitas (composição)
- ✅ Registrar movimentações manuais (ENTRADA/SAIDA)
- ✅ Registrar contagem física (mas sem reconciliar)

**Não funciona** para:
- ❌ Criar/editar/excluir insumos (sem UI)
- ❌ Reconciliar contagem com estoque
- ❌ Auditar quem fez cada operação
- ❌ Filtrar/paginar movimentações antigas

Se quiser que eu implemente essas correções, me avise qual é a
prioridade e faço o patch.

---

## Arquivos incluídos (Parte 1 — obs/aviso)

```
src/app/api/producao/route.ts        # retorna obs + matchExato
src/app/api/romaneio/route.ts        # retorna obs + matchExato
src/app/(app)/dashboard/page.tsx     # banner de aviso + interface obs
src/app/(app)/cardapio/page.tsx      # textarea para cadastrar obs
```

## Como aplicar

```bash
git checkout -b fix/obs-aviso

unzip -o obs-aviso-v967.zip -d .

git add -A
git commit -m "fix(v9.6.7): mensagem de aviso (obs) agora aparece no dashboard e produção"
git push -u origin fix/obs-aviso
```

Sem migração de banco — o campo `obs` já existe no schema (desde o início).

## Verificação

1. Vá em **Cardápio → Editar** a semana atual.
2. No campo "Aviso da Semana", digite: "Teste de aviso — semana 33".
3. Salve.
4. Vá no **Dashboard** — banner amarelo aparece no topo.
5. Vá em **Produção** — banner aparece na tela e na impressão (4 lugares).
6. Navegue para outra semana (SeletorSemana) — o aviso **não aparece**
   (só na semana exata).
7. Volte para a semana do aviso — aparece de novo.
