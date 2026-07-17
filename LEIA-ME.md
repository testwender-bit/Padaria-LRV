# Fix v9.5.4.1 — RECUPERAÇÃO do schema Postgres

## ⚠️ PROBLEMA CAUSADO PELO PATCH v9.5.4

O patch v9.5.4 que você aplicou **substituiu seu `prisma/schema.prisma`
inteiro** por uma versão SQLite do meu ambiente de desenvolvimento.
Isso causou dois erros:

### Erro 1 — `prisma db push` falhou

```
Error: Prisma schema validation - (get-config wasm)
error: Error validating datasource `db`: the URL must start with the protocol `file:`.
  -->  prisma/schema.prisma:12
   | 
11 |   provider = "sqlite"
12 |   url      = env("DATABASE_URL")
```

Seu `DATABASE_URL` (Vercel + Supabase/Neon) é Postgres, mas o schema
diz SQLite. Incompatibilidade.

### Erro 2 — Build da Vercel falhou

```
./src/app/api/nutricao/cardapios/[id]/localizar-substituir/route.ts:40:32
Type error: Object literal may only specify known properties,
and 'mode' does not exist in type 'StringFilter<"Preparacao"'.
```

`mode: 'insensitive'` é um recurso exclusivo de Postgres. Com SQLite
(o que o schema errado dizia), o Prisma Client gerado não tem essa
propriedade → erro de TypeScript no build.

## ✅ SOLUÇÃO — Script de recuperação

Este patch contém **apenas um arquivo**:

- `restore-schema-postgres.sh` — script bash que:

1. **Restaura seu schema do commit anterior** (`git checkout HEAD~1`)
   — volta para o seu Postgres original, com todos os seus models
   intactos.
2. **Adiciona APENAS o `model ProducaoExtra`** (antes de
   `model HistoricoSemana`), com try/catch seguro na API.
3. **Adiciona APENAS o campo `pao_fixo Boolean @default(false)`**
   após `ordem_rota Int @default(0)` no `model Escola`.
4. **Verifica** que tudo está no lugar (Postgres + ProducaoExtra + pao_fixo).

**Não substitui nenhum outro model. Não altera datasource. Não mexe em
nenhum outro arquivo.**

## Como aplicar

```bash
# 1. Extraia o patch (apenas o script, sem tocar em mais nada):
unzip -o patch-schema-recovery-v9.5.4.1.zip -d .

# 2. Rode o script de recuperação:
bash restore-schema-postgres.sh

# 3. Crie a tabela ProducaoExtra no banco:
npx prisma db push

# 4. Commit e push:
git add -A
git commit -m "fix(v9.5.4.1): restaura schema Postgres + adiciona ProducaoExtra"
git push
```

## Verificação

Após rodar o script, o `prisma/schema.prisma` deve ter:

```prisma
datasource db {
  provider = "postgresql"        ← restaurado (não sqlite)
  url      = env("DATABASE_URL")
}

model Escola {
  ...
  ordem_rota    Int      @default(0)
  pao_fixo      Boolean  @default(false)   ← adicionado
  obs           String?
  ...
}

model ProducaoExtra {              ← adicionado (novo bloco)
  id               String   @id @default(cuid())
  ano              Int
  semana           Int
  nome_instituicao String
  produto          String
  dia_semana       String
  quantidade       Int      @default(0)
  observacao       String?
  criado_em        DateTime @default(now())

  @@index([ano, semana])
}
```

Todos os outros models do seu schema (User, Account, Preparacao,
CardapioSemestral, etc.) permanecem **intactos**.

## Por que isso aconteceu?

No meu ambiente de desenvolvimento local, o `stage/` usa SQLite para
testes. Quando montei o patch v9.5.4, copiei o `schema.prisma` inteiro
do stage/ — incluindo `provider = "sqlite"`. O patch substituiu o seu
arquivo inteiro em vez de fazer uma inserção cirúrgica.

Este patch v9.5.4.1 corrige o problema: o script `restore-schema-postgres.sh`
restaura seu schema original e adiciona só o que falta.

## As outras mudanças do v9.5.4 continuam valendo

Todas as outras alterações do patch v9.5.4 (route.ts, page.tsx, lib/*)
continuam funcionando normalmente — elas não dependem do tipo de banco.
Apenas o `schema.prisma` precisa ser restaurado para Postgres.

Após rodar `prisma db push` com sucesso:
- A tabela `ProducaoExtra` será criada no seu banco Postgres
- A API `/api/producao` vai retornar `producaoExtra` corretamente
- A página de Produção vai mostrar as instituições extras
- O build da Vercel vai passar (sem erro de `mode: 'insensitive'`)
