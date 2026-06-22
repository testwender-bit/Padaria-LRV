# Patch TACO Reset + Revinculação

## ⚠️ IMPORTANTE — Abordagem NOVA (destrutiva)

Este patch **ZERA** a tabela `Alimento` e a repopula com os 573 itens oficiais da TACO 4ª edição. Em seguida, revincula os ingredientes das preparações aos novos alimentos.

**Antes de aplicar, faça backup completo do banco (script incluso neste patch):**
```bash
npx tsx scripts/backup-supabase-completo.ts
# → salva TODAS as 34 tabelas em /tmp/backup-supabase-YYYYMMDD.json
```

## O que está incluído

| Arquivo | Função |
|---|---|
| `taco_oficial.json` | 573 itens extraídos do PDF da TACO 4ª edição (com valores corretos) |
| `scripts/backup-supabase-completo.ts` | **NOVO** — Backup completo de TODAS as 34 tabelas (alternativa gratuita ao backup pago do Supabase) |
| `scripts/restore-supabase-completo.ts` | **NOVO** — Restaura backup completo |
| `scripts/reset-populate-taco.ts` | Zera tabela Alimento + cria 573 itens TACO |
| `scripts/revincular-preparacoes.ts` | Revincula ingredientes das preparações aos novos alimentos |
| `scripts/restore-alimentos-backup.ts` | Restaura APENAS alimentos (backup menor, do reset) |
| `package.json` | Adiciona `postinstall: prisma generate` + scripts de backup/restore/taco |

## Ordem de execução

### Passo 1: Aplicar o patch (resolve erro de build Vercel)
```bash
unzip -o patch-taco-reset.zip
npm install  # instala dependências + roda postinstall (prisma generate)
```

### Passo 2: Push para GitHub (Vercel faz redeploy automático)
```bash
git add .
git commit -m "fix: prisma generate no build + scripts TACO reset + backup"
git push
```

Aguarde o deploy da Vercel concluir (3-5 min). O erro `Property 'cardapioHorarioRefeicao' does not exist` deve sumir.

### Passo 3: BACKUP COMPLETO DO BANCO (antes de tudo!)
```bash
# Backup de TODAS as 34 tabelas (15.756 registros) — alternativa gratuita ao backup pago
npx tsx scripts/backup-supabase-completo.ts
```
**Output:** `/tmp/backup-supabase-YYYYMMDD.json` (~400 KB)
**Guarda este arquivo em local seguro** — ele contém TODO o sistema.

### Passo 4: Reset + populate (no Codespaces, com .env apontando para Supabase)
```bash
# DRY-RUN primeiro (preview)
npx tsx scripts/reset-populate-taco.ts

# Se estiver OK, aplicar
npx tsx scripts/reset-populate-taco.ts --apply
```

**O que acontece:**
1. Backup automático de alimentos + ingredientes salvo em `/tmp/backup-alimentos-YYYYMMDD.json`
2. Remove TODOS os ingredientes das preparações (temporário)
3. Remove TODOS os alimentos (683 itens antigos)
4. Cria 573 alimentos da TACO oficial com valores corretos
5. Salva mapa de revinculação em `mapa-revinculacao.json`

### Passo 5: Revincular preparações
```bash
# DRY-RUN primeiro
npx tsx scripts/revincular-preparacoes.ts

# Se estiver OK, aplicar
npx tsx scripts/revincular-preparacoes.ts --apply
```

**O que acontece:**
1. Carrega backup de ingredientes (com nomes dos alimentos antigos)
2. Para cada ingrediente, encontra o melhor match TACO:
   - **Score >= 0.7**: revincula automaticamente
   - **Score 0.5-0.7**: revincula mas marca para revisão
   - **Score < 0.5**: cria alimento custom (preserva valores do backup)
3. Recria ingredientes nas preparações com os novos alimento_id

### Passo 6: Validar
- Abra o sistema (Vercel ou local)
- Vá em Preparações → verifique se as 228 preparações ainda estão lá
- Clique em uma preparação → verifique se os ingredientes estão corretos
- Vá em Alimentos → verifique se aparecem os 573 itens TACO com valores corretos

## Em caso de problema

### Restaurar TUDO (backup completo)
```bash
npx tsx scripts/restore-supabase-completo.ts
# → restaura TODAS as 34 tabelas do backup mais recente
```

### Restaurar APENAS alimentos (backup do reset)
```bash
npx tsx scripts/restore-alimentos-backup.ts
# → restaura apenas Alimento + PreparacaoIngrediente
```

### Atalhos no package.json
```bash
npm run backup      # backup completo
npm run restore     # restore completo
npm run taco:reset  # reset + populate TACO
npm run taco:revincular  # revincular preparações
```

## Validação técnica (testada localmente)

- ✅ Backup: 15.756 registros em 21 tabelas → JSON de ~400 KB
- ✅ Reset: 683 alimentos → 573 alimentos TACO oficial
- ✅ Populate: 573 itens com valores corretos (Arroz cru 360kcal, Arroz cozido 124kcal, etc)
- ✅ Revinculação: 23 ingredientes recriados com match score >= 0.7 (perfeito)
- ✅ Backup automático antes de qualquer alteração
- ✅ Modo dry-run para preview
- ✅ Script de restore para emergências

## Sobre o erro de build Vercel

O erro `Property 'cardapioHorarioRefeicao' does not exist on type 'PrismaClient'` acontecia porque:
- O `schema.prisma` tem o modelo `CardapioHorarioRefeicao` (adicionado no patch v8.7)
- Mas o Prisma Client não era regenerado durante o build da Vercel

**Correção:** Adicionado `"postinstall": "prisma generate"` no `package.json`. Agora, sempre que a Vercel roda `npm install`, o `prisma generate` é executado automaticamente, gerando o Prisma Client com todos os modelos do schema.

## Sobre o backup do Supabase (free tier)

O Supabase free tier **não inclui backups agendados** (é pago no plano Pro). Por isso, criamos o script `backup-supabase-completo.ts` que:
- Exporta TODAS as 34 tabelas para um arquivo JSON local
- É executado manualmente quando você quiser
- Não tem custo
- Pode ser versionado em git (se quiser) ou guardado em local seguro

**Recomendação:** rode `npm run backup` antes de qualquer alteração importante no banco.

## Após aplicar tudo

1. **Push para GitHub** → Vercel redeploy
2. **Teste no sistema** → Preparações, Alimentos, Cardápios
3. **Revisão manual** → Alguns ingredientes podem ter match médio (0.5-0.7) — verificar caso a caso
4. **Alimentos custom** → Itens não-TACO (especiarias, regionais) foram criados com valores do backup — revisar se necessário
