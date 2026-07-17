# Patch v9.5 — Pão Fixo para Órgãos + Ordenação Alfabética

## 1. Pão Fixo (Órgãos/Instituições)

**Problema:** Órgãos como CRAS, Associações, etc. recebem pão toda semana
mas a produção depende do `tipo_pao` do cardápio semestral. Quando o
cardápio é "Pão Proteína", os órgãos não puxavam pão (não têm quantidade
de pão proteína cadastrada).

**Solução:** Novo campo `pao_fixo` no modelo Escola:
- `pao_fixo = true` → sempre usa `tipo_pao = 'PADRAO'` (Pão Francês)
- Ignora o tipo de pão da semana do cardápio semestral
- Produz pão toda semana, independente do cardápio escolar

### Como usar:
1. Cadastre o órgão em `/configuracoes` → Nova Escola → Categoria: **Outros**
2. Configure as quantidades de PF (tipo PADRAO) na aba PF
3. Edite a escola → marque **"🍞 Pão Fixo (Órgão/Instituição)"**
4. Pronto — o órgão vai produzir pão toda semana, mesmo quando o cardápio
   escolar for "Pão Proteína"

### Onde funciona:
- Produção (tela e API) ✅
- Impressão ✅
- Romaneio ✅
- Feriados continuam funcionando (se feriado afeta OUTROS, zera o pão) ✅

## 2. Ordenação Alfabética

**Problema:** Escolas com mesma rota e ordem_rota (ex: 0) apareciam em
ordem aleatória.

**Solução:** Adicionado `nome_curto` como critério de ordenação secundário:

1. Rota (José → Aroldo → Busca Própria)
2. Ordem da rota (0, 1, 2, ...)
3. **Nome curto (A-Z)** ← NOVO

Aplicado em:
- API de produção (orderBy no banco)
- Tela de configuração (sort na UI)
- Tela de produção (sort nas listas de escolas)
- Impressão (herda da ordenação da API)

## Como aplicar

```bash
unzip patch-pao-fixo-ordenacao.zip -d .
npx prisma generate
npx prisma db push --accept-data-loss
git add -A
git commit -m "feat(v9.5): pão fixo para órgãos + ordenação alfabética"
git push
```

⚠️ Rode `npx prisma db push` para adicionar o campo `pao_fixo` no banco.
Não causa perda de dados (apenas adiciona coluna boolean com default false).
