# Patch v6.1 — Fix erro de tipagem TypeScript no build da Vercel

> ⚠️ **Esta é a v6.1 do patch.** Se você aplicou a v6 e o deploy na Vercel falhou com erro `Type error: Type '...' is not assignable to type 'T[]'`, é só aplicar esta v6.1 por cima — ela corrige o erro de tipagem.

**Problema v6:** A função `atribuirOrdemParaItensSemOrdem<T>` exigia `T extends { ..., id: string }` (obrigatório), mas era chamada por `sortItensByRefeicao<T>` que não exige `id`. O TypeScript em modo strict (habilitado implicitamente pelo `next build` na Vercel) não conseguia garantir que o `T` do caller satisfazia o requisito de `id`, gerando o erro:

```
Type error: Type '{ preparacao: { nome: string; categoria?: string | undefined; }; ...; id: string; }[]' is not assignable to type 'T[]'.
```

**Solução v6.1:** Removido o requisito `id: string` da constraint de `atribuirOrdemParaItensSemOrdem` — a função não usa `id` em lugar nenhum (só ordena), então a exigência era desnecessária.

---

## 📦 Arquivos deste patch

| Arquivo | Mudou? | O que faz |
|---|---|---|
| `src/lib/ordenacao-preparacoes.ts` | ✅ modificado | Removido `id: string` da constraint de `atribuirOrdemParaItensSemOrdem` (1 linha) |

Apenas 1 arquivo mudou. Todos os outros arquivos da v6 continuam idênticos.

---

## 🚀 Como aplicar (se você já tinha a v6)

### Passo 1 — Sobrescrever no Codespace

```bash
unzip -o patch-v6_1-fix-tipagem-vercel.zip
```

### Passo 2 — Validar localmente (opcional)

```bash
# Testes continuam passando (18/18 + 18/18)
npx tsx scripts/test-ordenacao-v6.ts
npx tsx scripts/test-ordenacao-v5.ts
```

### Passo 3 — Push para GitHub (Vercel faz deploy automático)

```bash
git add src/lib/ordenacao-preparacoes.ts PATCH-README.md
git commit -m "fix(types): corrige erro de tipagem TypeScript no build da Vercel (v6.1)

A função atribuirOrdemParaItensSemOrdem<T> exigia 'id: string' na
constraint, mas era chamada por sortItensByRefeicao<T> que não exige 'id'.
TypeScript em strict mode (next build) rejeitava. Removido requisito
desnecessário (função não usa id em nenhuma operação)."
git push
```

A Vercel vai rebuildar automaticamente e dessa vez deve passar.

---

## 🔍 O que mudou (1 linha efetiva)

Em `src/lib/ordenacao-preparacoes.ts`, função `atribuirOrdemParaItensSemOrdem`:

**Antes (v6 — falhava):**
```typescript
function atribuirOrdemParaItensSemOrdem<
  T extends {
    preparacao: { nome: string; categoria?: string }
    tipo_refeicao_id?: string
    tipo_refeicao?: { id: string; codigo: string }
    ordem?: number
    id: string              // ❌ exigia id, mas função não usa
  }
>(itens: T[], tiposRefeicao: Array<{ id: string; codigo: string }>): T[] {
```

**Depois (v6.1 — funciona):**
```typescript
function atribuirOrdemParaItensSemOrdem<
  T extends {
    preparacao: { nome: string; categoria?: string }
    tipo_refeicao_id?: string
    tipo_refeicao?: { id: string; codigo: string }
    ordem?: number
    // ✅ removido id — função não usa, era exigência desnecessária
  }
>(itens: T[], tiposRefeicao: Array<{ id: string; codigo: string }>): T[] {
```

Toda a lógica interna da função continua idêntica. Apenas a assinatura de tipo mudou.

---

## 🛡️ Por que isso resolve

O TypeScript em strict mode (habilitado implicitamente pelo `next build` na Vercel) é mais rigoroso que o `tsx` (que só transpila, sem checar tipos). Quando uma função genérica `<T>` faz operações internas, o TS precisa garantir que **qualquer T** que satisfaça a constraint do caller também satisfaça a constraint da função chamada.

Como `sortItensByRefeicao<T>` (caller) tem constraint **sem `id`**, mas `atribuirOrdemParaItensSemOrdem<T>` (chamada) exigia **com `id`**, o TS não conseguia provar que T sempre teria `id` — daí o erro.

A solução foi alinhar as constraints: como a função interna não usa `id`, basta remover a exigência. As outras funções (`calcularOrdemCanonicaSlot`) que **realmente usam `id`** mantêm a exigência (e só são chamadas por endpoints que passam itens com `id`).

---

## ✅ Validação

- 18/18 testes v6 continuam passando
- 18/18 testes v5 continuam passando
- 23/23 testes alérgenos continuam passando
- `tsc --noEmit` com `strict: true` não reporta mais erros em `ordenacao-preparacoes.ts`

---

## 📝 Histórico v6

- **v6 (18:21):** Patch original — categorias FRUTA + ACOMPANHAMENTO, fix bug item novo, botão Reordenar semana
- **v6.1 (agora):** Fix erro de tipagem TypeScript que quebrava build da Vercel
