# Patch v9.8.6 — Bugfix: romaneio agora respeita lanche_bifasica_modo na tabela de PF

## ⚠️ Antes de aplicar

1. Faça backup e crie branch:
   ```bash
   git stash
   git checkout -b fix/v9.8.6-romaneio-bifasica-tipo-pao
   ```
2. **NÃO precisa de `prisma db push`** (sem mudança no schema).
3. **NÃO precisa rodar migração**.

## 📋 O que mudou (1 correção de bug)

### 🐛 Romaneio não respeitava `lanche_bifasica_modo` na tabela de PF

**Problema**: a API do romaneio (`/api/romaneio`) estava usando a lógica antiga para determinar o tipo de pão da bifásica:

```ts
// ERRADO (romaneio antes do patch):
const tipoPaoEfetivo = (escola as any).pao_fixo === true ? 'PADRAO' : tipoPao
```

Isso ignora o `lanche_bifasica_modo` da semana. Consequência: quando a semana tem `tipo_pao = SEMPAO` (porque as demais escolas estão sem pão) mas a bifásica está em modo `PAO_PADRAO`, o romaneio buscava a `PfQuantidade` **SEMPAO** (só café da manhã) em vez de **PADRAO** (que tem o valor na quinta-feira).

**Resultado do bug**: a bifásica não aparecia na tabela de PF do motorista com o pão da quinta-feira, mesmo o usuário tendo configurado a `PfQuantidade` PADRAO com o valor correto.

**Correção**: a API do romaneio agora usa a função `tipoPaoEfetivoEscola()` (igual à API de produção já fazia desde a v9.8.1):

```ts
// CORRETO (depois do patch):
const tipoPaoEfetivo = tipoPaoEfetivoEscola(
  escola.categoria,
  (escola as any).pao_fixo,
  tipoPao,
  lancheBifasicaModo
)
```

A função `tipoPaoEfetivoEscola()` respeita o `lanche_bifasica_modo`:
- `LANCHE` → bifásica usa `SEMPAO` (só café da manhã)
- `PAO_PADRAO` → bifásica usa `PADRAO` (café + pão do lanche)
- `PAO_PROTEINA` → bifásica usa `PROTEINA` (café + pão proteína do lanche)
- `NENHUM` → bifásica usa `SEMPAO` (só café da manhã)

### Cenário corrigido

**Configuração do usuário**:
- Semana com `tipo_pao = SEMPAO` (demais escolas sem pão)
- Bifásica com `lanche_bifasica_modo = PAO_PADRAO`
- `PfQuantidade` PADRAO da bifásica: quinta = valor, demais dias = 0

**ANTES do patch** (bug):
- Romaneio buscava `PfQuantidade` SEMPAO → quinta = 0
- Bifásica NÃO aparecia na tabela de PF do motorista (total_pf = 0)

**DEPOIS do patch** (correto):
- Romaneio busca `PfQuantidade` PADRAO → quinta = valor
- Bifásica aparece na tabela de PF do motorista com o valor na quinta ✅
- Bifásica também aparece na tabela de PCQ com `40 + PF 25` em seg/qua/sex (PCQ + PF Complemento) ✅

### Regra completa da bifásica no romaneio (após patch)

| Cenário | Tabela PF | Tabela PCQ |
|---|---|---|
| Modo `LANCHE` | `—` (usa SEMPAO, só café, não mostra aqui) | `—` (sem PCQ) |
| Modo `PAO_PADRAO` (sem pão na quinta) | `—` (PADRAO tem 0 em todos os dias) | `40 + PF 25` em seg/qua/sex |
| Modo `PAO_PADRAO` (com pão na quinta) | ✅ valor na quinta, `—` nos demais | `40 + PF 25` em seg/qua/sex |
| Modo `PAO_PROTEINA` | similar ao PAO_PADRAO mas com PROTEINA | `40 + PF 25` em seg/qua/sex |
| Modo `NENHUM` | `—` (usa SEMPAO) | `—` (sem PCQ) |

**Resumo**: a bifásica aparece na tabela de PF **só quando tem pão extra** (configurado na `PfQuantidade` PADRAO/PROTEINA). O PF Complemento nunca aparece na tabela de PF (vai agrupado em PCQ).

## 📦 Arquivo incluído no patch

| Arquivo | Mudança |
|---|---|
| `src/app/api/romaneio/route.ts` | Importa `tipoPaoEfetivoEscola` de `producao-utils`. Busca `lancheBifasicaModo` do cardápio. Usa `tipoPaoEfetivoEscola()` no loop de PF (em vez da lógica antiga `pao_fixo ? PADRAO : tipoPao`). |

**1 arquivo modificado. Sem mudança no schema. Sem migração.**

## 🚀 Como aplicar

```bash
# Extrair (na raiz do projeto)
unzip -o patch-v986.zip

# Build + testar
npm run build
npm run dev
```

## 🧪 Como testar (smoke test)

### Teste 1 — Bifásica com pão na quinta (cenário principal)
1. Configure uma semana com:
   - `tipo_pao = SEMPAO` (em /cardapio)
   - `lanche_bifasica_modo = PAO_PADRAO` (em /cardapio)
2. Configure a bifásica em /configuracoes:
   - `PfQuantidade` PADRAO: quinta = valor (ex: 30), demais = 0
   - `PfQuantidade` SEMPAO: seg/qua/sex = valor do café da manhã
   - `PcqQuantidade`: prod_segunda/quarta/sexta = 40, pf_comp_* = 25
3. Vá em **Produção** → clique **Imprimir**
4. Na página **ROTA X — PÃO FRANCÊS**:
   - ✅ Bifásica aparece com `—` em seg/ter/qua/sex
   - ✅ Bifásica aparece com o **valor na quinta** (ex: 30)
5. Na página **ROTA X — PCQ E LANCHES**:
   - ✅ Bifásica aparece com `40 + PF 25` em seg/qua/sex
   - ✅ Bifásica aparece com `—` em ter/qui

### Teste 2 — Bifásica sem pão na quinta (modo LANCHE)
1. Configure uma semana com:
   - `tipo_pao = PADRAO` (demais escolas com pão)
   - `lanche_bifasica_modo = LANCHE` (bifásica só café da manhã)
2. Vá em **Produção** → **Imprimir**
3. Na tabela de PF do motorista:
   - ✅ Bifásica aparece com `—` em todos os dias (usa SEMPAO, só café)

### Teste 3 — Creches (não deve mudar)
1. Verifique que as creches continuam aparecendo com `—` na tabela de PF
2. E com `40 + PF 25` na tabela de PCQ
3. (Comportamento do patch v9.8.4/v9.8.5 mantido)

## 🔄 Como commitar e voltar para main

```bash
# 1. Adicionar arquivo modificado
git add -A

# 2. Commitar
git commit -m "fix(v9.8.6): romaneio respeita lanche_bifasica_modo na tabela de PF"

# 3. Voltar para main
git checkout main

# 4. Merge do branch
git merge fix/v9.8.6-romaneio-bifasica-tipo-pao

# 5. Enviar para GitHub
git push origin main

# 6. Apagar branch local
git branch -d fix/v9.8.6-romaneio-bifasica-tipo-pao
```

## 🔙 Como reverter

```bash
git checkout -- src/app/api/romaneio/route.ts
```

## 📝 Notas técnicas

- **Causa raiz**: a API do romaneio foi esquecida na v9.8.1 (quando atualizamos a API de produção para usar `tipoPaoEfetivoEscola`). O romaneio continuava usando a lógica antiga `pao_fixo ? PADRAO : tipoPao`, que ignora o `lanche_bifasica_modo`.
- **Sintoma**: bifásica não aparecia na tabela de PF do motorista quando a semana tinha `tipo_pao ≠ PADRAO` (ex: SEMPAO), mesmo com `lanche_bifasica_modo = PAO_PADRAO` e `PfQuantidade` PADRAO configurada.
- **Correção**: usar a mesma função `tipoPaoEfetivoEscola()` que a API de produção já usa. Isso garante consistência entre produção e romaneio.
- **Sem mudança na UI**: a tabela de PF do motorista já mostrava `escola.pf[d]` para bifásicas (não `—`). O problema era que `escola.pf[d]` vinha errado da API. Agora vem correto.
- **Compatibilidade**: patch v9.8.6 substitui o v9.8.5 (não precisa aplicar os 2, só este já inclui tudo).
