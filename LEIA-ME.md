# Patch v9.8.3 — Correção da fonte das páginas de Lanches na impressão

## ⚠️ Antes de aplicar

1. Faça backup e crie branch:
   ```bash
   git stash
   git checkout -b fix/v9.8.3-fonte-lanches
   ```
2. **NÃO precisa de `prisma db push`** (sem mudança no schema).
3. **NÃO precisa rodar migração**.

## 📋 O que mudou (1 correção)

### 🐛 Fonte das páginas de Lanches na impressão continuava pequena

**Problema**: no patch v9.8.2 eu aumentei as fontes do `print.css`, mas as tabelas de Lanche (tanto a página de produção de Lanches quanto a página de Lanches no romaneio dos motoristas) tinham `fontSize` inline (`7pt` e `8pt`) que **sobrescreviam** o CSS. Resultado: a fonte do lanche continuou pequena.

**Correção**: aumentei os font-sizes inline proporcionalmente (~30%):

| Elemento | Antes | Agora |
|---|---|---|
| Cabeçalho "DIA / ESCOLA" e "QUANTIDADE" | 7pt | **9pt** |
| Linha de dia destacada (■ SEGUNDA, etc) | 8pt | **10.5pt** |
| Células de escola/quantidade | 8pt | **10.5pt** |

**Locais afetados** (4 ocorrências de `7pt` + 8 ocorrências de `8pt` no arquivo):
- Página de produção de Lanches (impressão)
- Página de romaneio por motorista — seção Lanches

## 📦 Arquivo incluído no patch

| Arquivo | Mudança |
|---|---|
| `src/app/(app)/producao/page.tsx` | `fontSize: '7pt'` → `'9pt'` (4 ocorrências) e `fontSize: '8pt'` → `'10.5pt'` (8 ocorrências) |

**1 arquivo modificado. Sem mudança no schema. Sem migração.**

## 🚀 Como aplicar

```bash
# Extrair (na raiz do projeto)
unzip -o patch-v983.zip

# Build + testar
npm run build
npm run dev
```

## 🧪 Como testar

1. Vá em **Produção** → clique **Imprimir** (ou Ctrl+P)
2. Na preview, navegue até a página de **Lanches** (após PCQ)
3. ✅ Fonte deve estar visivelmente maior (compatível com a fonte do PF e PCQ)
4. Vá até as páginas de **Romaneio por Motorista** que têm Lanches
5. ✅ Fonte da tabela de lanches também deve estar maior

## 🔄 Como commitar e voltar para main

```bash
# 1. Adicionar arquivo modificado
git add -A

# 2. Commitar
git commit -m "fix(v9.8.3): fonte das páginas de lanches na impressão"

# 3. Voltar para main
git checkout main

# 4. Merge do branch
git merge fix/v9.8.3-fonte-lanches

# 5. Enviar para GitHub
git push origin main

# 6. Apagar branch local
git branch -d fix/v9.8.3-fonte-lanches
```

## 🔙 Como reverter

```bash
git checkout -- src/app/\(app\)/producao/page.tsx
```

## 📝 Notas técnicas

- **Causa raiz**: o React permite `style={{ fontSize: '7pt' }}` que vira CSS inline. CSS inline tem prioridade sobre classes do `print.css`. Por isso o aumento do `print.css` no v9.8.2 não afetou as tabelas de lanche.
- **Solução aplicada**: aumentar os valores inline diretamente. Para o futuro, seria melhor remover os font-sizes inline e usar classes do `print.css` (mas isso é uma refatoração maior, fica para o plano de polimento FASE 4).
- **Próxima mudança pendente**: a mudança do PCQ nos romaneios dos motoristas (tirar Ter/Qui, agrupar PF+PCQ para creches) está em análise — aguardando confirmação das 4 perguntas enviadas no chat.
