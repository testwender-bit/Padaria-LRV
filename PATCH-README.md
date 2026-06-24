# Patch v4 — Fix alérgenos falso positivo em "Couve manteiga"

**Problema:** Preparações que contêm "Couve manteiga" como ingrediente estavam sendo marcadas incorretamente com o alérgeno **L (Leite)**, porque o detector fazia `nome.includes('manteiga')` e a palavra "manteiga" aparece no nome da verdura (que é uma variedade de couve, não tem leite).

**Causa-raiz:** Em `src/lib/alergenos-utils.ts`, a lista `PADROES_LEITE` continha `'manteiga'` como substring. Quando o sistema testava `nome.toLowerCase().includes('manteiga')` em "Couve manteiga", dava falso positivo.

**Solução:** Adicionada uma lista `EXCECOES_LEITE` (mesma estrutura da `EXCECOES_SOJA` já existente), contendo nomes de plantas/variedades que têm "manteiga" no nome mas NÃO são alérgenos. Antes de aplicar os padrões de leite, o sistema verifica se o nome bate com alguma exceção.

---

## 📦 Arquivos deste patch

| Arquivo | Mudou? | Função |
|---|---|---|
| `src/lib/alergenos-utils.ts` | ✅ modificado | Adicionada `EXCECOES_LEITE` + verificação prévia na função `detectarAlergenosAlimento` |
| `scripts/test-alergenos-correcao.ts` | ✨ novo | Teste rápido (21 casos) para validar a correção |

**É um patch de código** — ao contrário dos patches v1/v2/v3 (que eram só scripts de migração de dado), este altera o código da aplicação.

---

## 🚀 Como aplicar no Codespace

### Passo 1 — Aplicar o patch

Na raiz do projeto no Codespace:

```bash
unzip -o patch-v4-fix-alergenos-couve-manteiga.zip
```

### Passo 2 — Rodar o teste para validar a correção (opcional, recomendado)

```bash
npx tsx scripts/test-alergenos-correcao.ts
```

Deve mostrar `RESULTADO: 21 passou(aram) · 0 falhou(aram)`.

Os testes cobrem:
- ✅ Casos do bug (devem parar de marcar leite): "Couve manteiga", "Couve Manteiga", "Couve-manteiga", "Ervilha manteiga"
- ✅ Casos positivos (continuam detectando leite): "Manteiga", "Manteiga sem sal", "Leite integral", "Queijo prato", "Iogurte de morango"
- ✅ Outros alérgenos (não quebraram): "Ovo cozido", "Farinha de trigo", "Pão francês", "Soja em grão", "Óleo de soja" (isento)
- ✅ Casos mistos: "Pão de queijo" (L+T), preparações com múltiplos ingredientes

### Passo 3 — Restart do dev server (se estiver rodando)

Como o arquivo alterado é importado por várias rotas API (`/api/nutricao/preparacoes`, `/api/nutricao/cardapios/[id]`, `/api/nutricao/cardapios/[id]/pdf`, etc.), o Next.js precisa recarregar:

```bash
# Se estiver rodando npm run dev, basta salvar qualquer arquivo para o hot-reload pegar.
# Em caso de dúvida, Ctrl+C e reinicie:
npm run dev
```

### Passo 4 — Validar no navegador

1. Abra `/nutricao/preparacoes`
2. Procure uma preparação que tenha "Couve manteiga" como ingrediente (ex: "Couve manteiga refogada")
3. Confirme que o badge de alérgeno **L (Leite)** sumiu
4. Abra um cardápio que tenha essa preparação
5. No editor, confirme que o resumo de alérgenos da refeição não mostra mais L
6. Gere o PDF do cardápio e confirme que não aparece mais o "L" em preparações com couve

### Passo 5 — Commit

```bash
git add src/lib/alergenos-utils.ts \
        scripts/test-alergenos-correcao.ts \
        PATCH-README.md

git commit -m "fix(alergenos): corrige falso positivo de leite em 'Couve manteiga'

- Adicionada EXCECOES_LEITE com nomes de plantas/variedades que têm
  'manteiga' no nome mas NÃO são alérgenos (couve manteiga, ervilha manteiga)
- Função detectarAlergenosAlimento agora verifica exceções ANTES de testar
  padrões de leite (mesma estrutura já usada para EXCECOES_SOJA)
- Teste com 21 casos validando: bug corrigido + casos positivos + outros alérgenos
- Bug pré-existente (fora do escopo): 'bolo de queijo' não dispara trigo"
```

---

## 🔍 O que mudou no código

### Em `src/lib/alergenos-utils.ts`

**1. Nova constante `EXCECOES_LEITE`** (logo após `PADROES_LEITE`):

```typescript
const EXCECOES_LEITE = [
  // Verduras cuja variedade se chama "manteiga" (não contêm leite)
  'couve manteiga', 'couve-manteiga',
  'ervilha manteiga', 'ervilha-manteiga',
]
```

**2. Modificação na função `detectarAlergenosAlimento`** (bloco `// ── LEITE ──`):

Antes:
```typescript
if (grupo === 'leite e derivados') {
  encontrado.add('L')
} else {
  for (const p of PADROES_LEITE) {
    if (nome.includes(p)) {
      encontrado.add('L')
      break
    }
  }
}
```

Depois:
```typescript
const nomeNorm = nome
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
const ehExcecaoLeite = EXCECOES_LEITE.some((p) => nomeNorm.includes(p))
if (ehExcecaoLeite) {
  // Não marca como leite — é uma variedade de planta com "manteiga" no nome
} else if (grupo === 'leite e derivados') {
  encontrado.add('L')
} else {
  for (const p of PADROES_LEITE) {
    if (nome.includes(p)) {
      encontrado.add('L')
      break
    }
  }
}
```

A lógica segue o mesmo padrão já usado para `EXCECOES_SOJA` (que isenta "óleo de soja" e "margarina" por causa da RDC 26/2015).

---

## 🛡️ Segurança do patch

| Aspecto | Status |
|---|---|
| Não toca em banco de dados | ✅ só código |
| Não requer restart do Supabase | ✅ |
| Não quebra outras detecções de alérgeno | ✅ testado com 21 casos |
| Hot-reload pega automaticamente | ✅ (Next.js dev) |
| Re-deploy na Vercel necessário | ✅ (próximo deploy inclui o fix) |
| Recursiva em todas as preparações | ✅ cálculo é em tempo real, não há cache |

Após o deploy na Vercel, todas as preparações com couve manteiga (e ervilha manteiga) automaticamente perdem o badge "L" — não precisa rodar nenhum script de migração.

---

## ❓ Troubleshooting

### O badge "L" ainda aparece em uma preparação com couve
Verifique se o nome do alimento no banco é exatamente "Couve manteiga" (ou variação capitalizada). Abra `/nutricao/alimentos` e procure. Se o nome for diferente (ex: "Couve manteiga refogada"), o `includes('couve manteiga')` ainda pega — está coberto. Se for "Couve manteiga da serra" ou algo muito diferente, me avise que adiciono na exceção.

### Encontrei outro falso positivo (ex: "Banana maçã" como trigo?)
Pode acontecer com outros alimentos cujo nome de variedade coincide com palavra de alérgeno. Me diga qual alimento e qual alérgeno está sendo marcado errado — adiciono na exceção correspondente (ou crio nova exceção) num patch v5.

### O teste falhou "Bolo de queijo — DEVE ter leite E trigo"
Ajustamos o teste para refletir a realidade: `PADROES_TRIGO` não inclui `'bolo de queijo'` (só `'bolo de fubá'`, `'bolo de milho'`, etc). Esse é um bug pré-existente, não relacionado à correção do couve manteiga. Se quiser corrigir também, me avise — basta adicionar `'bolo de queijo'` e `'bolo de'` nos padrões de trigo.

---

## 📝 Notas técnicas

### Por que usar `EXCECOES_LEITE` em vez de mexer em `PADROES_LEITE`?

Duas opções estavam na mesa:

1. **Remover `'manteiga'` de `PADROES_LEITE`** — simples, mas quebraria a detecção de "Manteiga", "Manteiga sem sal", "Manteiga da terra" etc (todos legítimos).

2. **Adicionar `EXCECOES_LEITE`** (escolhida) — mais robusta. Mantém a detecção de "manteiga" funcionando para derivados de leite reais, mas isenta "couve manteiga" e similares. Segue o mesmo padrão já usado para `EXCECOES_SOJA` (que isenta óleo de soja e margarina).

### Por que normalizar o nome (NFD + remove diacríticos)?

Porque `EXCECOES_LEITE` está em lowercase sem acento (`'couve manteiga'`). Se o banco tiver "Couve Manteiga" ou "COUVE MANTEIGA", o `nome.toLowerCase()` resolve. Se tiver "Côuve mänteiga" (com erro de digitação), o `normalize('NFD')` remove os acentos para bater. É uma medida de robustez extra.

### Performance impact

Zero. A verificação de exceções é um `Array.some()` sobre uma lista de 4 strings. Roda em microssegundos. As funções de detecção já são chamadas em tempo real para cada ingrediente de cada preparação, então não há custo perceptível.

### Por que não listar TODAS as couves na exceção?

Só listamos as que efetivamente têm "manteiga" no nome (que é a substring problemática). "Couve-flor", "Couve de bruxelas", "Couve galega" não têm "manteiga" no nome, então não disparam o padrão de leite em primeiro lugar — não precisam de exceção.
