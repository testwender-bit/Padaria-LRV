# Patch v9.9.4 — Nutrição > Cardápios: dialog "Adicionar Preparações" vira "Adicionar/Editar" + kcal + filtro por categoria

## 📦 Conteúdo do patch

| Arquivo | Mudança |
|---|---|
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Editor de cardápio — dialog de preparações (3 melhorias) |

Sem mudança de schema (não precisa `prisma db push`).
Sem mudança de API (reusa POST/DELETE existentes de `/api/nutricao/cardapios/[id]/item`).

## 🐛 1. Bug corrigido — "clico adicionar de novo para editar e as preparações selecionadas não aparecem"

**Causa:** o dialog "Adicionar Preparações" sempre abria com a seleção vazia
(`setAddSelectedPrepIds(new Set())`). Ele só sabia ADICIONAR — nunca refletia o
que já estava na refeição, então era impossível ver/desmarcar as preparações já escolhidas.

**Correção:** o dialog agora abre em **modo editar** quando a refeição (slot
dia + tipo de refeição) já tem preparações:

- As preparações **já presentes aparecem pré-selecionadas** (caixinha marcada + badge âmbar "no cardápio").
- **Desmarcar** uma delas e salvar **REMOVE do cardápio** (com confirmação visual no botão).
- **Marcar** novas e salvar **ADICIONA** normalmente.
- Título muda para **"Editar Preparações da Refeição"** quando o slot já tem itens.
- Contador mostra o resumo do que vai acontecer: `X selecionada(s) · +2 nova(s) · −1 p/ remover`.
- Botão principal dinâmico: `Adicionar N preparação(ões)` · `Salvar (+2 / −1)` · `Remover N preparação(ões)`,
  e fica **desabilitado se nada mudou** (evita salvamento inútil).
- Linha inteira agora é clicável para marcar/desmarcar (antes só a caixinha).
- Fluxo antigo preservado: slot vazio continua com o comportamento de sempre (só adicionar).

## 🔥 2. kcal de cada preparação + nº de ingredientes

Cada linha da lista agora mostra, ao lado do nome:

- **kcal por porção** (ícone de chama, laranja) — calculada com a MESMA convenção do
  resumo nutricional da página: Σ (gramas da fase escolar do cardápio × kcal/100g do alimento ÷ 100).
  Se a preparação tem percapita específica para a fase, usa a específica; senão cai no cálculo padrão.
- **`N ing.`** — quantidade de ingredientes (já existia, mantido).

Passe o mouse sobre o kcal para ver o detalhe ("≈ 320 kcal por porção (fase ...)").

## 🗂️ 3. Filtro por categoria no topo + lista organizada

- Nova fileira de **chips de categoria** no topo do dialog (abaixo das abas Todas/Favoritas/+Usadas):
  `Categoria: Todas (132) · ● Salada (12) · ● Arroz (8) · ● Feijão (6) · ● Proteína (15) · ...`
  — só aparecem categorias que têm preparações cadastradas, cada uma com sua **cor** e **contagem**.
- A lista agora é **agrupada por categoria** com cabeçalhos coloridos fixos (sticky) durante a rolagem,
  na ordem canônica do sistema: Salada → Arroz → Feijão → Proteína → Acompanhamento → Pão → Lanche →
  Cuscuz → Bebida → Suco → Doce → Fruta → Sobremesa → Preparação.
- Chips combinam com busca por nome e com o filtro de alérgenos (filtro AND).
- Preparações sem categoria (cadastros antigos) caem no grupo "Preparação".

## 🚀 Como aplicar no Codespace

```bash
# 1. Extraia o zip na RAIZ do projeto (mesmo nível de package.json):
unzip -o patch-v9.9.4.zip

# 2. Não há migração de banco. Confira se o arquivo entrou no lugar:
git status

# 3. Validação local (opcional, recomendado):
npx tsc --noEmit
npm run build

# 4. Teste no navegador (npm run dev ou direto no preview):
#    Nutrição > Cardápios > abra um cardápio > numa refeição que JÁ tem preparações,
#    clique em "+ Adicionar":
#    ✓ As preparações existentes devem aparecer marcadas + badge "no cardápio"
#    ✓ Desmarque uma e salve → ela deve sair da refeição
#    ✓ Marque outra e salve → "Salvar (+1 / −1)" aplica os dois efeitos
#    ✓ kcal e nº de ingredientes em cada linha
#    ✓ Chips de categoria no topo + lista agrupada por categoria

# 5. Commit e push (deploy Vercel automático):
git add .
git commit -m "v9.9.4: dialog adicionar/editar preparações + kcal por porção + filtro por categoria"
git push
```

## ✅ Validação executada antes da entrega

- `npx tsc --noEmit` → 0 erros
- `npm run build` (Next.js completo) → OK, sem erros de tipo
- `scripts/test-cardapio-dialog-v994.ts` → 35/35 testes de lógica, incluindo a
  reprodução exata do cenário do bug reportado (reabrir → ver seleção → desselecionar → remover)

## 📝 Notas

- Remoção pelo dialog usa o mesmo endpoint de remover item individual
  (decresce `vezes_usada` da preparação, igual ao botão de lixeira).
- Em cardápios de escola (instância de base), remover via dialog marca a semana
  como "Modificada" — mesmo comportamento do botão de lixeira.
- Sobre a INTEGRAL (2 refeições/dia): mantido como está, conforme combinado.
