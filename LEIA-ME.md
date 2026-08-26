# Patch v9.8.4 — PCQ dos motoristas: agrupar PF Complemento com PCQ em creches

## ⚠️ Antes de aplicar

1. Faça backup e crie branch:
   ```bash
   git stash
   git checkout -b fix/v9.8.4-pcq-motorista-creches
   ```
2. **NÃO precisa de `prisma db push`** (sem mudança no schema).
3. **NÃO precisa rodar migração**.

## 📋 O que mudou (1 funcionalidade)

### 🍞 PCQ dos motoristas: agrupar PF Complemento com PCQ em creches

**Contexto**: no romaneio dos motoristas, a tabela de PCQ mostrava apenas as formas de PCQ (seg/qua/sex), separadas da tabela de PF. Os motoristas precisavam olhar 2 tabelas para entregar tudo para as creches.

**Problema**: nas creches, o PF Complemento (pão extra que vai junto com o PCQ, cadastrado em `PcqQuantidade.pf_comp_*`) era somado no PF na tabela de PF do motorista. Isso confundia — o motorista via o pão na tabela de PF, mas ele é entregue junto com o PCQ.

**Solução**: para **creches** (`categoria = 'CRECHE'`) no romaneio dos motoristas:

| Local | Seg | Ter | Qua | Qui | Sex |
|---|---|---|---|---|---|
| **Tabela PF** | — | — | — | — | — |
| **Tabela PCQ** | `40 + PF 25` | — | `40 + PF 25` | — | `40 + PF 25` |

Onde `40` = PCQ (formas) e `25` = PF Complemento (unidades, puxado de `pf_comp_segunda/quarta/sexta`).

**Para demais escolas** (REGULAR, INTEGRAL, BIFASICA, etc.): **nada muda** — continuam com PF e PCQ separados nas suas tabelas, exatamente como antes.

### Exemplo visual

**ANTES** (romaneio do motorista José):

Tabela de PF:
```
ESCOLA           | Seg | Ter | Qua | Qui | Sex | TOTAL
Creche A         | 125 | 100 | 125 | 100 | 125 | 575   ← (100 PF + 25 PF_COMP somados)
Escola B         | 50  | 50  | 50  | 50  | 50  | 250
TOTAL            | 175 | 150 | 175 | 150 | 175 | 825
```

Tabela de PCQ:
```
ESCOLA           | Seg | Ter | Qua | Qui | Sex | TOTAL
Creche A         | 40  | —   | 40  | —   | 40  | 120
Escola B         | 10  | —   | 10  | —   | 10  | 30
TOTAL            | 50  | —   | 50  | —   | 50  | 150
```

**DEPOIS** (v9.8.4):

Tabela de PF:
```
ESCOLA           | Seg | Ter | Qua | Qui | Sex | TOTAL
Creche A         | —   | —   | —   | —   | —   | —    ← (PF vai agrupado em PCQ)
Escola B         | 50  | 50  | 50  | 50  | 50  | 250
TOTAL            | 50  | 50  | 50  | 50  | 50  | 250  ← (não inclui creches)
```

Tabela de PCQ:
```
ESCOLA           | Seg       | Ter | Qua       | Qui | Sex       | TOTAL
Creche A         | 40 + PF 25| —   | 40 + PF 25| —   | 40 + PF 25| 120
Escola B         | 10        | —   | 10        | —   | 10        | 30
TOTAL            | 50 + PF 25| —   | 50 + PF 25| —   | 50 + PF 25| 150
```

O motorista agora leva **os 2 pães juntos** para as creches em seg/qua/sex, sem risco de esquecer o PF Complemento.

## 📦 Arquivos incluídos no patch

| Arquivo | Mudança |
|---|---|
| `src/lib/romaneio-utils.ts` | + campo `pf_comp` em `EscolaRomaneio` + `totais_pf_comp` em `RomaneioMotorista` |
| `src/app/api/romaneio/route.ts` | Para creches, `pf_comp` vai SEPARADO de `pf` (não somado). Demais escolas: comportamento antigo. |
| `src/app/(app)/producao/page.tsx` | Tabela PF do motorista: creches mostram `—` em todos os dias. Tabela PCQ do motorista: creches mostram `40 + PF 25` em seg/qua/sex. |

**3 arquivos modificados. Sem mudança no schema. Sem migração.**

## 🚀 Como aplicar

```bash
# Extrair (na raiz do projeto)
unzip -o patch-v984.zip

# Build + testar
npm run build
npm run dev
```

## 🧪 Como testar (smoke test)

### Teste 1 — Tabela de PF do motorista (creches)
1. Vá em **Produção** → clique **Imprimir** (ou Ctrl+P)
2. Navegue até as páginas de **Romaneio por Motorista** (após as páginas de produção)
3. Na página **ROTA X — PÃO FRANCÊS**:
   - ✅ Escolas REGULAR/INTEGRAL/BIFASICA continuam aparecendo com PF normal
   - ✅ Creches aparecem com `—` em todos os dias (Seg a Sex)
   - ✅ Total geral da tabela de PF NÃO inclui o PF das creches (porque vai agrupado em PCQ)

### Teste 2 — Tabela de PCQ do motorista (creches)
1. Na mesma impressão, navegue até **ROTA X — PCQ E LANCHES**
2. Na seção **PCQ — PÃO DE CACHORRO QUENTE**:
   - ✅ Creches mostram `40 + PF 25` em Seg/Qua/Sex (onde 40 = PCQ e 25 = PF Complemento)
   - ✅ Creches mostram `—` em Ter/Qui (sem PCQ nem PF agrupado)
   - ✅ Demais escolas (REGULAR, etc.) continuam mostrando só o PCQ
   - ✅ Linha de total geral também mostra `50 + PF 25` em seg/qua/sex quando tem creches

### Teste 3 — Página de Produção principal (não-romaneio)
1. Na tela de Produção (não impressão), as tabelas de PF/PCQ/Lanche continuam normais
2. As creches continuam aparecendo com PF e PCQ separados (a mudança é SÓ no romaneio dos motoristas)

## 🔄 Como commitar e voltar para main

```bash
# 1. Adicionar arquivos modificados
git add -A

# 2. Commitar
git commit -m "feat(v9.8.4): romaneio motorista agrupa PF Complemento com PCQ em creches"

# 3. Voltar para main
git checkout main

# 4. Merge do branch
git merge fix/v9.8.4-pcq-motorista-creches

# 5. Enviar para GitHub
git push origin main

# 6. Apagar branch local
git branch -d fix/v9.8.4-pcq-motorista-creches
```

## 🔙 Como reverter

```bash
git checkout -- src/lib/romaneio-utils.ts \
                 src/app/api/romaneio/route.ts \
                 src/app/\(app\)/producao/page.tsx
```

## 📝 Notas técnicas

- **Mudança só na impressão dos romaneios**: a tela de Produção (tabelas principais) e a planilha de produção continuam idênticas. Só muda o que aparece na impressão das páginas "ROTA X — PÃO FRANCÊS" e "ROTA X — PCQ E LANCHES".
- **Apenas creches**: escolas com `categoria = 'CRECHE'` recebem o novo comportamento. Demais categorias (REGULAR, INTEGRAL, BIFASICA, etc.) continuam com PF e PCQ separados, como antes.
- **Como detectamos creche na UI**: usamos a heurística "se `pf_comp[dia] > 0` para algum dia, é creche". Isso é verdade porque só creches têm `pf_comp_*` preenchido (em `PcqQuantidade`).
- **Total geral da tabela de PF do motorista**: agora NÃO inclui o PF Complemento das creches (porque vai agrupado em PCQ). É esperado que o total diminua em relação ao anterior.
- **Total geral da tabela de PCQ do motorista**: mostra `XX + PF YY` em dias com creches, para o motorista saber que leva ambos juntos.
- **Formato da célula agrupada**: `40 + PF 25` — compacto, uma linha, fácil de ler rapidamente (Opção B que você escolheu).
