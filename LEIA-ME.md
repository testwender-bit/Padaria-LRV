# Patch v9.9.0 — Modo Lanche Interior + Lanches em Configurações + Aviso editável na Produção

## 🎯 O que este patch faz (3 funcionalidades)

### 1️⃣ Aviso da Semana editável direto da Produção (mesmo quando vazio)
**Antes:** se a semana não tinha aviso, a caixa nem aparecia na Produção — era preciso ir em
/Cardapio, editar a semana e digitar o aviso lá.
**Agora:** a caixa "Aviso da Semana" aparece SEMPRE que a semana tem cardápio cadastrado.
Quando não há aviso, mostra "Nenhum aviso cadastrado para esta semana." com o botão ✏️
para **adicionar** direto da Produção (o dialog já existente de salvar/editar é o mesmo).
- Se a semana não tem cardápio cadastrado (matchExato falso), o banner continua oculto
  e o botão avisa "Semana sem cardápio cadastrado" — comportamento seguro mantido.

### 2️⃣ Lanches movido para dentro de Configurações (ABA "Lanches")
- O menu principal não tem mais o item "Lanches".
- A gestão completa de lanches (cadastro, distribuição escola×dia, clonar, excluir,
  mostrar inativos) agora é a **4ª aba** da página **/configuracoes** (junto com
  Escolas, PF e PCQ), onde já ficam as demais configurações de quantidade.
- A rota antiga **/lanches continua existindo** e redireciona para
  `/configuracoes?tab=lanches` — nenhum link antigo quebra.
- **ZERO risco de perda de dados:** é apenas reorganização de interface. Os dados
  continuam nas mesmas tabelas (`Lanche`, `LancheDistribuicao`) e as mesmas APIs
  (`/api/lanches`, `/api/lanches/distribuicao`) são usadas sem nenhuma mudança.

### 3️⃣ Modo Lanche Interior (espelho completo do Modo Lanche Bifásica)
Funciona EXATAMENTE como a bifásica, mas para **uma escola do Interior que você escolher**:

**a) Flag na escola (Configurações → aba Escolas):**
- Novo checkbox verde-água **"Interior Especial (modo lanche como bifásica)"** no formulário
  de criar/editar escola. Marque APENAS na escola do Interior escolhida.
- Demais escolas do Interior continuam seguindo o cardápio normal (não são afetadas).

**b) Seletor no Cardápio Semestral (/cardapio):**
- Novo campo **"Modo Lanche Interior"** ao editar cada semana, com as mesmas 4 opções do
  bifásico: Mesmo lanche das outras escolas (LANCHE) / Pão Francês Padrão / Pão Francês
  Proteína / Nenhum (preparação na escola).
- Badge "I: ..." ao lado do badge "B: ..." na listagem (verde-água quando LANCHE).

**c) Produção/Romaneio/Custos puxam corretamente (mesma lógica da bifásica):**
- `tipoPaoEfetivoEscola()` agora também considera a flag: modo PAO_PADRAO → PF PADRAO;
  PAO_PROTEINA → PF PROTEINA; LANCHE ou NENHUM → SEMPAO (quantidades de café da manhã).
- Planilha de Lanche: escola interior especial em modo PAO_*/NENHUM **não recebe item**
  na planilha de lanches (igual bifásica); em modo LANCHE recebe o mesmo lanche de todos.
- Romaneio: mesmo comportamento; além disso, se a escola tiver PF Complemento (pf_comp)
  cadastrado, ele é agrupado com o PCQ na impressão do motorista (como creches/bifásicas).
- Controle de Estoque (previsão de insumos): alinhado com a produção (antes usava o
  tipo de pão da semana para TODAS as escolas — agora usa o tipo efetivo igual à
  /api/producao; isso também corrige a divergência antiga do cálculo para bifásicas).
- ⚠️ Igual à bifásica: para a escola deixar de receber o PF "normal" do dia, cadastre as
  quantidades de café da manhã dela no tipo **SEMPAO** (aba PF das Configurações) — o
  sistema usa SEMPAO quando o modo é LANCHE/NENHUM. Em modo PAO_PADRAO/PAO_PROTEINA,
  as quantidades saem dos tipos PADRAO/PROTEINA dela.

## 📦 Arquivos incluídos (17)

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | `Escola.interior_especial` + `CardapioSemestral.lanche_interior_modo` |
| `src/lib/unit-options.ts` | Constante `LANCHE_INTERIOR_MODOS` |
| `src/lib/producao-utils.ts` | `tipoPaoEfetivoEscola()` com interior + novos helpers `modoLancheEfetivoEscola()` / `escolaPulaLanche()` |
| `src/lib/custo-utils.ts` | Previsão de insumos alinhada com a produção (tipo efetivo + modos) |
| `src/lib/menu-config.ts` | Item "Lanches" removido do menu principal |
| `src/app/api/cardapio/route.ts` | POST/PATCH aceitam `lanche_interior_modo` (validado) |
| `src/app/api/escolas/route.ts` | POST/PUT persistem `interior_especial` |
| `src/app/api/producao/route.ts` | Motor de cálculo respeita modo interior + retorna `lancheInteriorModo` |
| `src/app/api/romaneio/route.ts` | Romaneio respeita modo interior + pf_comp agrupado + lanche alinhado com produção |
| `src/app/(app)/cardapio/page.tsx` | Seletor "Modo Lanche Interior" + badge "I:" |
| `src/app/(app)/producao/page.tsx` | Aviso da Semana: banner com botão adicionar/editar sempre visível (quando há cardápio) |
| `src/app/(app)/configuracoes/page.tsx` | Aba "Lanches" + checkbox "Interior Especial" (criar e editar escola) |
| `src/app/(app)/lanches/page.tsx` | Agora só redireciona para `/configuracoes?tab=lanches` |
| `src/components/lanches-manager.tsx` | **NOVO** — conteúdo de /lanches extraído como componente (lógica idêntica) |
| `scripts/migrar-lanche-interior-modo.ts` | **NOVO** — migração idempotente do novo campo |
| `scripts/test-interior-modo-v990.ts` | **NOVO** — 20 testes da lógica (opcional, só para conferir) |
| `LEIA-ME.md` | Este arquivo |

## 🚀 Como aplicar

```bash
# 1. Backup + branch
git stash
git checkout -b feat/v9.9.0-modo-interior

# 2. Extrair (sobrescreve todos os arquivos)
unzip -o patch-v990.zip

# 3. Sincronizar o banco (OBRIGATÓRIO — schema mudou)
npx prisma generate
npx prisma db push

# 4. Migração de dados (roda UMA vez — é idempotente, não faz mal rodar de novo)
npx tsx scripts/migrar-lanche-interior-modo.ts

# 5. Build + testar
npm run build
npm run dev
```

> 💡 `prisma db push` já preenche o default `LANCHE` nas semanas existentes na maioria
> dos casos; o script de migração é uma garantia extra (não altera nada se estiver ok).

## 🧪 Como testar (checklist)

1. **Build passa** — `npm run build` sem erros de tipo.
2. **Aviso pela Produção:** em /producao numa semana SEM aviso → a caixa âmbar aparece com
   "Nenhum aviso cadastrado" → clique ✏️ → digite → Salvar → banner aparece. Confira que
   também aparece em /dashboard e que a edição continua funcionando.
3. **Lanches em Configurações:** menu lateral não mostra mais "Lanches"; /configuracoes tem
   a aba "Lanches" com os cartões e a matriz de distribuição funcionando. Acesse
   manualmente /lanches → deve redirecionar para a aba.
4. **Modo Interior:**
   - /configuracoes → editar a escola do Interior desejada → marcar "Interior Especial" → salvar.
   - /cardapio → editar uma semana → escolher "Modo Lanche Interior" = Pão Francês Padrão → salvar.
   - /producao nessa semana → a escola flagada aparece na planilha de PF (tipo PADRAO) e
     **some** da planilha de Lanches. Troque para "Mesmo lanche" → ela volta ao lanche normal
     e o PF dela usa o tipo SEMPAO (café da manhã).
   - /romaneio nessa semana → mesma consistência; se a escola tiver pf_comp, aparece
     agrupado com o PCQ ("X + PF Y") na impressão.
   - Escolas do Interior NÃO flagadas não mudam nada.
5. **Estoque:** /custos → o custo estimado da semana considera a escola flagada conforme
   o modo (pão em PAO_*, lanche em LANCHE).

## 🔄 Como commitar e voltar para main

```bash
git add -A
git commit -m "feat(v9.9.0): modo lanche interior (espelho bifasica) + lanches em configuracoes + aviso editavel na producao"
git checkout main
git merge feat/v9.9.0-modo-interior
git push origin main
git branch -d feat/v9.9.0-modo-interior
```

## 📝 Notas técnicas

- Campos novos no banco: `Escola.interior_especial` (Boolean, default false) e
  `CardapioSemestral.lanche_interior_modo` (String, default "LANCHE"). Ambos com default —
  nenhuma informação existente é tocada.
- `tipoPaoEfetivoEscola()` ganhou 2 parâmetros OPCIONAIS no fim (interiorEspecial,
  lancheInteriorModo) — chamadas antigas com 4 argumentos continuam compilando.
- Alinhamento romaneio×produção: o romaneio agora usa o `lancheRegular` para bifásicas
  em modo LANCHE (igual à produção desde a v9.8) — elimina a divergência antiga; o campo
  `lanche_bifasica_id` segue existindo no banco (legado, inalterado).
- No Controle de Estoque, o PF de bifásicas agora também respeita o tipo efetivo
  (SEMPAO em modo LANCHE), com fallback PADRAO igual à produção — as estimativas ficam
  mais precisas; pode haver pequena variação nos valores estimados (é a correção).
- Nenhuma rota de API mudou de assinatura; tudo é retrocompatível.
