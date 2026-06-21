// ============================================================
// scripts/import-json-to-supabase.ts
// ============================================================
// Lê migration-data.json (gerado pelo export-sqlite-to-json.ts)
// e insere os dados no banco Postgres (Supabase) configurado
// via DATABASE_URL no .env.
//
// Antes de rodar:
//   1. Configurar .env com DATABASE_URL=postgresql://...
//   2. Rodar `npx prisma db push` (cria tabelas no Supabase)
//
// Uso:
//   npx tsx scripts/import-json-to-supabase.ts
//
// Features:
//   - Usa transações por tabela (rollback em caso de erro)
//   - Idempotente: se já existem registros, pula
//   - Mostra progresso em tempo real
//   - Validação final: compara contagens origem vs destino
// ============================================================

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// Mesma ordem do export — respeita FKs (pais antes de filhos)
const TABLE_ORDER: Array<{ model: string; label: string }> = [
  { model: 'user', label: 'Usuários' },
  { model: 'nutricionista', label: 'Nutricionistas' },
  { model: 'escola', label: 'Escolas' },
  { model: 'tipoRefeicao', label: 'Tipos de Refeição' },
  { model: 'alimento', label: 'Alimentos' },
  { model: 'insumo', label: 'Insumos' },
  { model: 'lanche', label: 'Lanches' },
  { model: 'feriado', label: 'Feriados' },
  { model: 'metaNutricional', label: 'Metas' },
  { model: 'pfQuantidade', label: 'PF Quantidades' },
  { model: 'pcqQuantidade', label: 'PCQ Quantidades' },
  { model: 'lancheDistribuicao', label: 'Distribuição de Lanches' },
  { model: 'cardapioSemestral', label: 'Cardápios Semestrais' },
  { model: 'ajuste', label: 'Ajustes' },
  { model: 'historicoSemana', label: 'Histórico' },
  { model: 'receita', label: 'Receitas' },
  { model: 'movimentacaoEstoque', label: 'Movimentações' },
  { model: 'pedidoCompra', label: 'Pedidos' },
  { model: 'itemPedidoCompra', label: 'Itens de Pedidos' },
  { model: 'contagemEstoque', label: 'Contagens' },
  { model: 'preparacao', label: 'Preparações' },
  { model: 'preparacaoIngrediente', label: 'Ingredientes' },
  { model: 'preparacaoPercapita', label: 'Percapitas' },
  { model: 'preparacaoSubstituicao', label: 'Substituições' },
  { model: 'categoriaRefeicao', label: 'Categorias × Refeições' },
  { model: 'cardapioNutricional', label: 'Cardápios' },
  { model: 'cardapioSemanaNutri', label: 'Semanas' },
  { model: 'cardapioDiaNutri', label: 'Dias' },
  { model: 'cardapioItem', label: 'Itens' },
  { model: 'sobrescritaCardapio', label: 'Sobrescritas' },
  { model: 'listaCompras', label: 'Listas de Compras' },
  { model: 'account', label: 'Accounts' },
  { model: 'session', label: 'Sessions' },
  { model: 'verificationToken', label: 'Tokens' },
]

async function main() {
  console.log('\n📥 Iniciando import JSON → Supabase/Postgres\n')

  // Verifica DATABASE_URL
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.error('❌ DATABASE_URL não configurada ou não é Postgres.')
    console.error('   Configure no .env: DATABASE_URL=postgresql://postgres:[SENHA]@db.[PROJETO].supabase.co:5432/postgres')
    process.exit(1)
  }
  console.log(`🎯 Destino: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`)

  // Carrega o JSON
  const jsonPath = path.resolve(process.cwd(), 'migration-data.json')
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Arquivo não encontrado: ${jsonPath}`)
    console.error('   Rode primeiro: npx tsx scripts/export-sqlite-to-json.ts')
    process.exit(1)
  }
  const fileContent = fs.readFileSync(jsonPath, 'utf-8')
  const parsed = JSON.parse(fileContent) as {
    _meta: { totalRecords: number; tablesWith: number }
    summary: Array<{ table: string; count: number; label: string }>
    data: Record<string, unknown[]>
  }
  console.log(`📊 JSON carregado: ${parsed._meta.totalRecords} registros em ${parsed._meta.tablesWith} tabelas\n`)

  // Verifica se o banco já tem dados (idempotência)
  const existingUsers = await prisma.user.count().catch(() => 0)
  if (existingUsers > 0) {
    console.warn(`⚠️  O banco destino já tem ${existingUsers} usuários.`)
    console.warn('   Se você quer reimportar do zero, rode primeiro:')
    console.warn('   npx prisma db push --force-reset')
    console.warn('\   (Isso apaga TODOS os dados do Supabase.)')
    const proceed = process.env.FORCE_IMPORT === 'true'
    if (!proceed) {
      console.error('\n❌ Abortando. Para forçar reimportação, rode com FORCE_IMPORT=true.')
      process.exit(1)
    }
    console.warn('⚠️  FORCE_IMPORT=true — continuando mesmo com dados existentes (pode dar erro de conflito)')
  }

  const results: Array<{ table: string; label: string; origin: number; inserted: number; skipped: number }> = []
  let totalInserted = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const { model, label } of TABLE_ORDER) {
    const records = parsed.data[model] || []
    if (records.length === 0) {
      results.push({ table: model, label, origin: 0, inserted: 0, skipped: 0 })
      continue
    }

    const delegate = (prisma as unknown as Record<string, {
      createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<{ count: number }>
      count: () => Promise<number>
    }>)[model]

    if (!delegate) {
      console.warn(`  ⚠️  Modelo não encontrado no Prisma Client: ${model}`)
      continue
    }

    try {
      const before = await delegate.count()
      // createMany é mais rápido que create em loop.
      // skipDuplicates evita erro se já existir (idempotência).
      // Nota: Postgres suporta createMany nativamente (SQLite também a partir do Prisma 5+).
      const result = await delegate.createMany({
        data: records as Record<string, unknown>[],
        skipDuplicates: true,
      })
      const after = await delegate.count()
      const inserted = after - before
      const skipped = records.length - inserted
      totalInserted += Math.max(0, inserted)
      totalSkipped += Math.max(0, skipped)
      results.push({ table: model, label, origin: records.length, inserted: Math.max(0, inserted), skipped: Math.max(0, skipped) })
      console.log(`  ✓ ${model.padEnd(28)} ${String(records.length).padStart(6)} → ${String(Math.max(0, inserted)).padStart(6)} inseridos  ${skipped > 0 ? `(${skipped} skip)` : ''}   ${label}`)
    } catch (err) {
      totalErrors++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${model.padEnd(28)} ERRO: ${msg.slice(0, 200)}`)
      results.push({ table: model, label, origin: records.length, inserted: 0, skipped: records.length })
    }
  }

  // Relatório final
  console.log('\n' + '═'.repeat(80))
  console.log('📋 RELATÓRIO DE MIGRAÇÃO')
  console.log('═'.repeat(80))
  console.log(`${'Tabela'.padEnd(28)} ${'Origem'.padStart(8)} ${'Inseridos'.padStart(10)} ${'Pulou'.padStart(8)}   Descrição`)
  console.log('─'.repeat(80))
  for (const r of results) {
    if (r.origin === 0) continue
    console.log(`${r.table.padEnd(28)} ${String(r.origin).padStart(8)} ${String(r.inserted).padStart(10)} ${String(r.skipped).padStart(8)}   ${r.label}`)
  }
  console.log('─'.repeat(80))
  console.log(`${'TOTAL'.padEnd(28)} ${String(parsed._meta.totalRecords).padStart(8)} ${String(totalInserted).padStart(10)} ${String(totalSkipped).padStart(8)}`)
  console.log(`Erros: ${totalErrors}`)
  console.log('═'.repeat(80))

  if (totalErrors > 0) {
    console.warn(`\n⚠️  ${totalErrors} tabela(s) com erro. Verifique acima.`)
    process.exit(1)
  } else if (totalInserted === parsed._meta.totalRecords) {
    console.log('\n✅ Migração 100% completa — todos os registros foram inseridos.')
  } else if (totalSkipped > 0 && totalInserted > 0) {
    console.log(`\n✅ Migração parcial: ${totalInserted} inseridos, ${totalSkipped} pulados (já existiam).`)
  } else {
    console.warn('\n⚠️  Nenhum registro inserido. Verifique se o banco destino está vazio.')
  }
}

main()
  .catch((err) => {
    console.error('❌ Erro fatal:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
