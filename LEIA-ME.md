# Patch v9.8.7 — Bugfix: PF Complemento zerado + editar aviso da semana

## ⚠️ Antes de aplicar

1. Faça backup e crie branch:
   ```bash
   git stash
   git checkout -b fix/v9.8.7-pf-comp-zerado-aviso
   ```
2. **NÃO precisa de `prisma db push`** (sem mudança no schema).
3. **NÃO precisa rodar migração**.

## 📋 O que mudou (2 correções de bugs)

### 🐛 Bug 1: PF Complemento zerado manualmente ainda aparece na impressão

**Problema**: quando o usuário zerava o PCQ de uma creche/bifásica (via ajuste manual na semana), o **PF Complemento continuava aparecendo** na impressão do romaneio ("0 + PF 25"). Isso acontecia porque o PCQ e o PF Complemento são campos separados no banco — zerar um não afeta o outro.

**Causa raiz**: o PF Complemento é puxado de `PcqQuantidade.pf_comp_*` (cadastro da escola), e o ajuste manual só afeta o PCQ (`produto: 'PCQ'`). O PF Complemento (`produto: 'PF_COMP'`) tem seu próprio ajuste separado, que o usuário não consegue editar pela UI.

**Correção**: se o PCQ for zerado (por ajuste manual OU feriado), o PF Complemento também deve ser zerado. Não faz sentido o motorista levar "0 + PF 25" — se não tem PCQ, não tem o que agrupar.

**Onde foi corrigido**:
- `src/app/api/romaneio/route.ts` — loop de PCQ: se `qtdFinalPcq === 0`, força `qtdFinalComp = 0`
- `src/app/api/producao/route.ts` — bloco PF Complemento (domingo): se PCQ da segunda foi zerado, força PF Comp = 0
- `src/app/api/producao/route.ts` — bloco PF Complemento (seg-sex): se PCQ do dia de entrega foi zerado, força PF Comp = 0

### 🐛 Bug 2: "Cardápio da semana X não encontrado" ao editar aviso

**Problema**: ao clicar no botão Editar do "Aviso da Semana" na página de Produção e tentar salvar, aparecia erro "Cardápio da semana X não encontrado".

**Causa raiz**: a API de produção retorna `semana` = **número ISO** (1-52) e `ano` = ano ISO. Mas o PATCH `/api/cardapio` buscava por `ano_semana: { ano, semana }` que usa `semana` = **semana letiva** (1-22, cadastrada no cardápio semestral). São coisas diferentes — quando o usuário mandava `semana: 35` (ISO), o banco não encontrava porque lá está `semana: 5` (letiva).

**Correção**: o PATCH agora aceita `cardapio_id` como alternativa a `ano+semana`. A página de produção passa a enviar `cardapio_id` (que a API de produção já retorna desde a v9.7.5, e é o ID direto do registro no banco — mais confiável).

**Onde foi corrigido**:
- `src/app/api/cardapio/route.ts` — PATCH aceita `cardapio_id` (preferencial) ou `ano+semana` (fallback)
- `src/app/(app)/producao/page.tsx` — `handleSaveAviso` envia `cardapio_id` em vez de `ano+semana`

## 📦 Arquivos incluídos no patch

| Arquivo | Mudança |
|---|---|
| `src/app/api/romaneio/route.ts` | Se PCQ for 0 (ajuste/feriado), força PF Comp = 0 |
| `src/app/api/producao/route.ts` | Mesma lógica nos 2 blocos de PF Complemento (domingo + seg-sex) |
| `src/app/api/cardapio/route.ts` | PATCH aceita `cardapio_id` como alternativa a `ano+semana` |
| `src/app/(app)/producao/page.tsx` | `handleSaveAviso` envia `cardapio_id` em vez de `ano+semana` |

**4 arquivos modificados. Sem mudança no schema. Sem migração.**

## 🚀 Como aplicar

```bash
# Extrair (na raiz do projeto)
unzip -o patch-v987.zip

# Build + testar
npm run build
npm run dev
```

## 🧪 Como testar (smoke test)

### Teste 1 — PF Complemento zerado junto com PCQ
1. Vá em **Produção** → view Semanal → tabela PCQ
2. Clique numa célula de PCQ de uma creche ou bifásica (ex: Segunda, valor 40)
3. Zere a quantidade (digite 0) e salve com um motivo
4. Vá em **Imprimir** → navegue até o romaneio do motorista
5. Na tabela de PCQ:
   - ✅ A creche/bifásica deve mostrar `—` na segunda (PCQ zerado)
   - ✅ NÃO deve aparecer "0 + PF 25" (PF Comp também zerado)
6. Na tabela de PF:
   - ✅ Creche continua mostrando `—` (como antes)
   - ✅ Bifásica continua mostrando PF do café da manhã (se tiver)

### Teste 2 — Editar aviso da semana
1. Vá em **Produção** → clique no botão **Editar** (lápis) do banner "Aviso da Semana"
2. Digite um novo texto no diálogo
3. Clique em **Salvar Aviso**
4. ✅ Deve aparecer toast "Aviso da semana atualizado!"
5. ✅ O banner deve refletir o novo texto imediatamente
6. ✅ Sem erro "Cardápio da semana X não encontrado"

### Teste 3 — PCQ com feriado (não deve mostrar PF Comp)
1. Cadastre um feriado na terça-feira com ação "zerar PCQ"
2. Vá em **Produção** → **Imprimir**
3. Na tabela de PCQ do motorista:
   - ✅ Terça: mostra `—` (feriado zerou PCQ)
   - ✅ NÃO mostra "0 + PF 25" (PF Comp também zerado pelo feriado)

## 🔄 Como commitar e voltar para main

```bash
# 1. Adicionar arquivos modificados
git add -A

# 2. Commitar
git commit -m "fix(v9.8.7): PF Comp zerado junto com PCQ + editar aviso via cardapio_id"

# 3. Voltar para main
git checkout main

# 4. Merge do branch
git merge fix/v9.8.7-pf-comp-zerado-aviso

# 5. Enviar para GitHub
git push origin main

# 6. Apagar branch local
git branch -d fix/v9.8.7-pf-comp-zerado-aviso
```

## 🔙 Como reverter

```bash
git checkout -- src/app/api/romaneio/route.ts \
                 src/app/api/producao/route.ts \
                 src/app/api/cardapio/route.ts \
                 src/app/\(app\)/producao/page.tsx
```

## 📝 Notas técnicas

- **Bug 1 — PF Complemento**: a regra é "se PCQ = 0, PF Comp = 0". Isso se aplica a creches E bifásicas (que têm pf_comp agrupado). Para demais escolas, o pf_comp é somado ao PF regular, então se PCQ for 0, o pf_comp também é zerado (não soma 0 no PF).
- **Bug 2 — Aviso da semana**: o `cardapio_id` é retornado pela API de produção desde a v9.7.5, mas não estava sendo usado. Agora é a forma preferencial de identificar o cardápio no PATCH.
- **Compatibilidade**: o PATCH ainda aceita `ano+semana` como fallback (para compatibilidade com qualquer outro caller que use esse formato). Mas `cardapio_id` é mais confiável.
- **Sem mudança na UI**: a correção do Bug 1 é transparente para o usuário — ele continua zerando o PCQ normalmente, e o sistema automaticamente zera o PF Comp junto.
