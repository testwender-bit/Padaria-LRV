# 🚀 Deploy na Vercel + Supabase — Passo a Passo Completo

Este guia leva o projeto **Padaria-LRV** do Codespaces para produção em ~30 minutos, sem perder nenhum dos 15.756 registros existentes.

---

## 📋 Visão Geral

| Etapa | Tempo | Quem faz |
|---|---|---|
| 1. Aplicar patch de migração | 2 min | Você (no Codespaces) |
| 2. Criar conta Supabase + projeto | 5 min | Você (no site Supabase) |
| 3. Criar tabelas no Supabase | 1 min | Você (no Codespaces) |
| 4. Exportar dados do SQLite | 1 min | Você (no Codespaces) |
| 5. Importar dados para Supabase | 2 min | Você (no Codespaces) |
| 6. Criar 5 usuários | 3 min | Você (no Codespaces) |
| 7. Push para GitHub | 5 min | Você (no Codespaces) |
| 8. Deploy na Vercel | 5 min | Você (no site Vercel) |
| 9. Validar produção | 2 min | Você (no navegador) |

**Total: ~30 minutos**

---

## ✅ Pré-requisitos

- Conta GitHub (gratuita) — [github.com](https://github.com)
- Conta Supabase (gratuita) — [supabase.com](https://supabase.com) — pode logar com GitHub
- Conta Vercel (gratuita) — [vercel.com](https://vercel.com) — pode logar com GitHub
- O patch `patch-vercel-migration.zip` aplicado ao projeto

---

## Etapa 1 — Aplicar o patch de migração

No terminal do Codespaces, na raiz do projeto:

```bash
# Backup do estado atual (por segurança)
cp -r . ../padaria-backup-$(date +%Y%m%d)

# Aplicar o patch
unzip -o patch-vercel-migration.zip

# Verificar que arquivos foram adicionados
ls scripts/                          # deve ter export-sqlite-to-json.ts e import-json-to-supabase.ts
ls prisma/seed-users.ts              # deve existir
grep "postgresql" prisma/schema.prisma  # deve mostrar provider = "postgresql"
```

**Arquivos incluídos no patch:**

| Arquivo | Função |
|---|---|
| `prisma/schema.prisma` | Trocado `sqlite` → `postgresql` |
| `scripts/export-sqlite-to-json.ts` | Lê `db/custom.db` e gera `migration-data.json` |
| `scripts/import-json-to-supabase.ts` | Lê `migration-data.json` e insere no Supabase |
| `prisma/seed-users.ts` | Lê `users.env` e cria os 5 usuários |
| `next.config.ts` | Adicionado `serverExternalPackages: ["bcryptjs"]` |
| `package.json` | Adicionados scripts `seed:users`, `export:sqlite`, `import:supabase` |
| `vercel.json` | Configuração de região (gru1 = São Paulo) |
| `.env.example` | Documentação das variáveis necessárias |
| `.gitignore` | Adicionados `users.env` e `migration-data.json` |

---

## Etapa 2 — Criar conta Supabase + projeto

1. Acesse [supabase.com](https://supabase.com) e clique em **Start your project**
2. Faça login com GitHub (mais fácil)
3. Clique em **New Project**
4. Preencha:
   - **Name**: `padaria-lrv`
   - **Database Password**: crie uma senha forte e **anote** (vai precisar)
   - **Region**: `South America (São Paulo)` — mais próximo do Brasil
   - **Pricing Plan**: Free
5. Clique **Create new project** — demora ~2 min para provisionar

6. Quando estiver pronto, vá em **Project Settings → Database**:
   - Em **Connection string**, você verá TRÊS opções. **Você precisa das DUAS primeiras**:

   **Opção A — Transaction pooler (porta 6543) — para runtime da app:**
   ```
   postgresql://postgres.gjafqhjqroqcjmuovgeq:[SENHA]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres
   ```
   ⚠️ **Adicione `?pgbouncer=true&connection_limit=1` no final** (crítico para Vercel serverless).

   **Opção B — Direct connection (porta 5432 do db.xxx) — para migrations:**
   ```
   postgresql://postgres:[SENHA]@db.gjafqhjqroqcjmuovgeq.supabase.co:5432/postgres
   ```

   **Por que duas URLs?**
   - Runtime (Vercel) usa o **Transaction Pooler** porque cada function serverless abre conexão própria; sem pooling, você atinge o limite do Supabase free (~60 conexões).
   - Migrations (`prisma db push`) usam **Direct connection** porque precisam de sessão sticky para criar tabelas/índices. PgBouncer em modo transaction não suporta isso bem.

   O `schema.prisma` já está configurado com `directUrl` para gerenciar isso automaticamente:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")    // Transaction pooler (runtime)
     directUrl = env("DIRECT_URL")      // Direct (migrations)
   }
   ```

---

## Etapa 3 — Criar tabelas no Supabase

No Codespaces, edite o arquivo `.env` na raiz do projeto:

```bash
# Substitua o conteúdo do .env por:

# Runtime (Vercel) — Transaction pooler com pgbouncer
DATABASE_URL="postgresql://postgres.gjafqhjqroqcjmuovgeq:[SUA_SENHA]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Migrations (prisma db push) — Direct connection
DIRECT_URL="postgresql://postgres:[SUA_SENHA]@db.gjafqhjqroqcjmuovgeq.supabase.co:5432/postgres"

# NextAuth
NEXTAUTH_SECRET="[SUA_SECRET_ALEATORIA]"
NEXTAUTH_URL=""
```

**Troque `[SUA_SENHA]` pela senha que você anotou** nas duas URLs.

Para gerar um `NEXTAUTH_SECRET` aleatório:
```bash
openssl rand -base64 32
```

Agora crie as tabelas no Supabase:
```bash
npm run db:generate    # regenera Prisma Client para Postgres
npm run db:push        # cria as 34 tabelas no Supabase
```

**Verificação**: vá no painel do Supabase → **Table Editor** → deve mostrar 34 tabelas vazias.

---

## Etapa 4 — Exportar dados do SQLite

O SQLite original (`db/custom.db`) tem 15.756 registros. Vamos exportá-los:

```bash
npm run export:sqlite
```

**Saída esperada:**
```
📂 Lendo SQLite local: file:/workspaces/Padaria-LRV/db/custom.db

🚀 Iniciando export SQLite → JSON

  ✓ user                          1   Usuários (NextAuth)
  ✓ nutricionista                 4   Nutricionistas
  ✓ escola                        5   Escolas
  ...
  ✓ cardapioItem               7350   Itens dos Cardápios
  ...

📦 Total: 15756 registros em 21 tabelas (de 34)
💾 Arquivo salvo: /workspaces/Padaria-LRV/migration-data.json
   Tamanho: ~800 KB
```

**O SQLite original não é modificado** — apenas lido.

---

## Etapa 5 — Importar dados para Supabase

Agora os 15.756 registros vão para o Supabase:

```bash
npm run import:supabase
```

**Saída esperada:**
```
📥 Iniciando import JSON → Supabase/Postgres
🎯 Destino: postgresql://postgres:***@db.abcdefgh.supabase.co:5432/postgres
📊 JSON carregado: 15756 registros em 21 tabelas

  ✓ user                          1 →      1 inseridos    Usuários
  ✓ nutricionista                 4 →      4 inseridos    Nutricionistas
  ✓ escola                        5 →      5 inseridos    Escolas
  ...
  ✓ cardapioItem               7350 →   7350 inseridos    Itens
  ...

═══════════════════════════════════════════════════════════════════════════
📋 RELATÓRIO DE MIGRAÇÃO
═══════════════════════════════════════════════════════════════════════════
Tabela                        Origem  Inseridos    Pulou   Descrição
───────────────────────────────────────────────────────────────────────────
cardapioItem                    7350       7350        0   Itens dos Cardápios
preparacaoPercapita             5411       5411        0   Percapitas
...
TOTAL                          15756      15756        0
Erros: 0
═══════════════════════════════════════════════════════════════════════════

✅ Migração 100% completa — todos os registros foram inseridos.
```

**Verificação**: no painel Supabase → **Table Editor** → clique em `CardapioItem` → deve ter 7.350 registros.

---

## Etapa 6 — Criar os 5 usuários

Crie um arquivo `users.env` na raiz do projeto (**NÃO commite isso** — já está no `.gitignore`):

```bash
cat > users.env << 'EOF'
USER_1=Ana Nutricionista|ana@padaria.lrv.gov.br|senhaForteAna123|admin
USER_2=João Coordenador|joao@padaria.lrv.gov.br|senhaForteJoao123|user
USER_3=Maria Auxiliar|maria@padaria.lrv.gov.br|senhaForteMaria123|user
USER_4=Pedro Diretor|pedro@padaria.lrv.gov.br|senhaFortePedro123|user
USER_5=Sofia Merendeira|sofia@padaria.lrv.gov.br|senhaForteSofia123|user
EOF
```

**Formato**: `USER_N=Nome|email|senha|role`

- `role` pode ser: `admin`, `user`, `nutricionista` (opcional, default = `user`)
- Troque os emails e senhas pelos reais

Agora execute:
```bash
npm run seed:users
```

**Saída esperada:**
```
👥 Seed de Usuários — Padaria Municipal LRV

📋 5 usuário(s) encontrado(s) no users.env:

  1. Ana Nutricionista              ana@padaria.lrv.gov.br        [admin]
  2. João Coordenador               joao@padaria.lrv.gov.br       [user]
  ...

  ✓ Criado:     ana@padaria.lrv.gov.br
  ✓ Criado:     joao@padaria.lrv.gov.br
  ...

══════════════════════════════════════════════
✅ Concluído: 5 criado(s), 0 atualizado(s)
📊 Total de usuários no banco: 6
══════════════════════════════════════════════

⚠️  IMPORTANTE:
   • Apague o arquivo users.env após rodar este script:
     rm users.env
```

**Apague o `users.env`**:
```bash
rm users.env
```

---

## Etapa 7 — Push para GitHub

Se você ainda não tem o projeto num repo GitHub:

```bash
# Inicializa git (se ainda não tiver)
git init
git add .
git commit -m "v8.6: migração para Supabase + Vercel"

# Crie um repo público ou privado no GitHub e siga as instruções
# Por exemplo, se criou como seu-usuario/padaria-lrv:
git remote add origin https://github.com/testwender-bit/padaria-lrv.git
git branch -M main
git push -u origin main
```

**Verificação importante** antes do push:
```bash
# Confirme que arquivos sensíveis NÃO vão ser commitados:
git status --ignored | grep -E "users\.env|migration-data|\.env$"

# Deve mostrar:
#   .env
#   users.env
#   migration-data.json
# (todos como "ignored")
```

---

## Etapa 8 — Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) → login com GitHub
2. Clique **Add New → Project**
3. Selecione o repo `padaria-lrv`
4. A Vercel detecta Next.js automaticamente. Não mude nada no build.
5. **Antes de clicar Deploy**, expanda **Environment Variables** e adicione:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | `postgresql://postgres.gjafqhjqroqcjmuovgeq:[SENHA]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | `postgresql://postgres:[SENHA]@db.gjafqhjqroqcjmuovgeq.supabase.co:5432/postgres` |
   | `NEXTAUTH_SECRET` | A mesma string aleatória que você gerou |
   | `NEXTAUTH_URL` | (deixe vazio — Vercel auto-detecta) |

   ⚠️ **Importante:** adicione as QUATRO variáveis. A `DIRECT_URL` é necessária porque a Vercel roda `prisma generate` durante o build (que valida o schema e precisa das duas URLs).

6. Clique **Deploy** — demora ~3 min na primeira vez

7. Quando terminar, você terá uma URL como: `https://padaria-lrv.vercel.app`

---

## Etapa 9 — Validar produção

1. Acesse a URL da Vercel
2. Você deve ser redirecionado para `/login`
3. Faça login com um dos 5 usuários criados
4. Verifique:
   - ✅ Lista de cardápios aparece (22 cardápios semestrais)
   - ✅ Editor de cardápio funciona (clique em um cardápio)
   - ✅ Lista de preparações aparece (228 preparações)
   - ✅ Lista de escolas aparece (5 escolas)
   - ✅ Feriados aparecem no calendário (18 feriados)
   - ✅ Consegue editar uma preparação e salvar
   - ✅ Consegue adicionar item a um cardápio

---

## 🆘 Troubleshooting

### Erro: `PrismaClientInitializationError: Can't reach database server`
- Verifique se a `DATABASE_URL` na Vercel está correta
- Confirme que o Supabase está ativo (pause após 1 semana de inatividade — basta abrir o painel para reativar)

### Erro: `bcryptjs cannot be resolved`
- Confirmado que `next.config.ts` tem `serverExternalPackages: ["bcryptjs"]`
- Faça rebuild na Vercel: Deployments → ⋮ → Redeploy

### Erro de login: "Credenciais inválidas"
- Verifique se rodou `npm run seed:users` no Supabase certo
- Tente redefinir senha: rode `seed:users` de novo (atualiza senhas sem duplicar)

### Supabase pausou por inatividade
- Apenas abra o painel Supabase → clique em **Restore** — leva 2 min
- Para evitar pausa, faça 1 login no app por semana (ou configure um cron ping)

### Erro 500 ao adicionar item
- Provavelmente `cardapioItem.ordem` ainda não existe — rode `npx prisma db push` de novo no Supabase

### Dados não migraram completamente
- Rode `npm run import:supabase` de novo (é idempotente — `skipDuplicates`)
- Se persistir, faça `npx prisma db push --force-reset` e reimporte do zero

### Quero redefinir a senha de um usuário específico
1. Edite o `users.env` com apenas esse usuário e a nova senha
2. Rode `npm run seed:users` — o script detecta email existente e ATUALIZA a senha

---

## 📊 Custos (Free Tier)

| Serviço | Limite free | Seu uso estimado |
|---|---|---|
| **Vercel** | 100 GB bandwidth/mês, 100 GB-hours build | ~5 GB/mês, 3 min build/dia |
| **Supabase** | 500 MB DB, 50k MAU, pausa após 7 dias inativo | ~5 MB DB, 5 MAU |
| **GitHub** | Ilimitado para repos públicos | — |

**Custo total: R$ 0/mês** para o seu caso de 5 usuários simultâneos.

---

## 🔒 Segurança

- ✅ Senhas hasheadas com bcrypt (10 rounds)
- ✅ Sessões JWT (sem armazenar no DB)
- ✅ `NEXTAUTH_SECRET` aleatório em produção
- ✅ Supabase tem SSL automático na connection string
- ✅ `users.env` e `.env` ignorados pelo git
- ⚠️ **Faça**: gire a senha do Supabase periodicamente
- ⚠️ **Considere**: adicionar 2FA se usar senhas fracas

---

## 📞 Próximos passos pós-deploy

1. **Testar fluxo completo** com cada um dos 5 usuários
2. **Backup inicial**: no Supabase → Database → Backups → Create backup
3. **Configurar domínio próprio** (opcional): Vercel → Settings → Domains
4. **Monitoramento**: ative Vercel Analytics (gratuito) para ver uso
5. **Documentar senhas** em local seguro (gerenciador de senhas tipo Bitwarden)

Boa sorte com o deploy! 🚀
