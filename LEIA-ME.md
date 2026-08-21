# Patch v9.8.1 — Bugfix Bifásica: pão vai para PF, não para Lanche

## ⚠️ Antes de aplicar

1. Faça backup e crie branch:
   ```bash
   git stash
   git checkout -b fix/v9.8.1-bugfix-bifasica-pao
   ```
2. **NÃO precisa de `prisma db push`** (sem mudança no schema).
3. **NÃO precisa rodar migração** (sem mudança em dados).

## 📋 O que mudou (1 correção de bug)

### 🐛 Bug da bifásica em modo PAO_* (pão indo para planilha errada)

**Sintoma relatado**: quando a bifásica estava em modo `PAO_PADRAO` (pão padrão no lanche da tarde), a quantidade de pão aparecia na **planilha de Lanche** misturada com a bolacha das outras escolas, em vez de ir para a planilha de **Pão Francês**.

**Causa raiz**: na v9.8 eu tinha implementado errado. Em modo `PAO_PADRAO`/`PAO_PROTEINA`, eu criava um item de Lanche com a quantidade do PfQuantidade — quando deveria apenas mudar o tipo de pão na planilha de PF (já que a PfQuantidade da bifásica já inclui o pão do café + pão do lanche quando é PADRAO ou PROTEINA).

**Correção v9.8.1**:

| Modo Bifásica | Planilha PF | Planilha Lanche |
|---|---|---|
| `LANCHE` | Bifásica usa `SEMPAO` (só café da manhã) | Bifásica recebe mesmo lanche das outras escolas |
| `PAO_PADRAO` | Bifásica usa `PADRAO` (café + lanche) | Bifásica **não recebe nada** na planilha Lanche |
| `PAO_PROTEINA` | Bifásica usa `PROTEINA` (café + lanche) | Bifásica **não recebe nada** na planilha Lanche |

A `PfQuantidade` cadastrada em **Configurações → Escolas** para a bifásica já representa o total correto do dia conforme o tipo:
- **PADRAO**: pão com manteiga, pão com doce + café da manhã
- **PROTEINA**: pão com proteína + café da manhã
- **SEMPAO**: só café da manhã (quando vai outro tipo de lanche)

## 📦 Arquivos incluídos no patch

| Arquivo | Mudança |
|---|---|
| `src/lib/producao-utils.ts` | + função `tipoPaoEfetivoEscola()` — encapsula regra do tipo de pão por escola/modo |
| `src/app/api/producao/route.ts` | Loop de PF agora usa `tipoPaoEfetivoEscola()` (2 loops: domingo e seg-sex). Loop de Lanche agora pula bifásica em modo `PAO_*` (não gera item de lanche). |

**2 arquivos modificados. Sem mudança no schema. Sem migração.**

## 🚀 Como aplicar

```bash
# Extrair (na raiz do projeto)
unzip -o patch-v9.8.1-bugfix-bifasica-pao.zip

# Build + testar
npm run build
npm run dev
```

## 🧪 Como testar (smoke test)

### Teste 1 — Bifásica em modo PAO_PADRAO
1. Vá em **Cardápio** (Cardápio Semestral) → edite a semana atual.
2. Em **Modo Lanche Bifásica**, escolha **Pão Francês Padrão**. Salve.
3. Vá em **Produção** → view Semanal.
4. **Tabela Pão Francês**: a bifásica deve aparecer com a quantidade do PfQuantidade PADRAO (café da manhã + pão do lanche).
5. **Tabela Lanche**: a bifásica **NÃO deve aparecer** (somente as outras escolas com bolacha).

### Teste 2 — Bifásica em modo LANCHE
1. Vá em **Cardápio** → edite a semana.
2. Em **Modo Lanche Bifásica**, escolha **Mesmo lanche das outras escolas**. Salve.
3. Vá em **Produção** → view Semanal.
4. **Tabela Pão Francês**: a bifásica deve aparecer com a quantidade do PfQuantidade **SEMPAO** (só café da manhã — quantidade menor).
5. **Tabela Lanche**: a bifásica **deve aparecer** com o mesmo lanche das outras escolas (bolacha).

### Teste 3 — Bifásica em modo PAO_PROTEINA
1. Vá em **Cardápio** → edite a semana.
2. Em **Modo Lanche Bifásica**, escolha **Pão Francês Proteína**. Salve.
3. Vá em **Produção** → view Semanal.
4. **Tabela Pão Francês**: a bifásica deve aparecer com a quantidade do PfQuantidade **PROTEINA**.
5. **Tabela Lanche**: a bifásica **NÃO deve aparecer**.

### Teste 4 — Escolas com pao_fixo=true (Bombeiros, CRAS)
1. Vá em **Produção** → view Semanal → tabela Pão Francês.
2. Bombeiros, CRAS, etc. continuam aparecendo com PADRAO (independente do modo bifásica).
3. Esse comportamento não mudou — só garantir que não quebrou.

## 🔄 Como commitar e voltar para main

Após testar e confirmar que está tudo funcionando:

```bash
# 1. Adicionar todos os arquivos modificados
git add -A

# 2. Commitar
git commit -m "fix(v9.8.1): bifásica modo PAO_* agora afeta PF (não Lanche)"

# 3. Voltar para main
git checkout main

# 4. Merge do branch
git merge fix/v9.8.1-bugfix-bifasica-pao

# 5. Enviar para GitHub (Vercel faz deploy automático)
git push origin main

# 6. Apagar branch local
git branch -d fix/v9.8.1-bugfix-bifasica-pao
```

## 🔙 Como reverter

```bash
git checkout -- src/lib/producao-utils.ts src/app/api/producao/route.ts
```

## 📝 Notas técnicas

- **Sem mudança no banco de dados**: o campo `lanche_bifasica_modo` (adicionado na v9.8) continua funcionando. Esta é apenas uma correção de como o valor é interpretado.
- **Função `tipoPaoEfetivoEscola()`**: agora centraliza a regra em `src/lib/producao-utils.ts`. Pode ser reusada futuramente em outras views (romaneio, dashboard).
- **Compatibilidade**: o campo `lanche_bifasica_id` continua mantido no schema para compatibilidade (não é usado pela nova lógica, mas não foi removido para não quebrar FKs).
- **Comportamento esperado da PfQuantidade da bifásica**:
  - PADRAO: pão com manteiga + pão com doce + café da manhã (total do dia)
  - PROTEINA: pão com proteína + café da manhã (total do dia)
  - SEMPAO: só café da manhã (quando lanche da tarde é outro tipo, ex: bolacha)
