// ============================================================
// scripts/restore-supabase-completo.ts
// ============================================================
// Restaura backup completo do banco Supabase.
// Usa o arquivo mais recente de /tmp/backup-supabase-*.json
//
// USO:
//   npx tsx scripts/restore-supabase-completo.ts
// ============================================================

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('\n🔄 RESTORE COMPLETO DO BANCO SUPABASE\n')

  // Encontrar backup mais recente
  const backupDir = '/tmp'
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-supabase-') && f.endsWith('.json'))
    .map(f => ({ file: f, path: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

  if (backups.length === 0) {
    console.error('❌ Nenhum backup encontrado em /tmp/backup-supabase-*.json')
    process.exit(1)
  }

  const backup = backups[0]
  console.log(`📂 Backup: ${backup.file}`)
  const data = JSON.parse(fs.readFileSync(backup.path, 'utf-8'))
  console.log(`📊 Total de registros: ${data._meta.total_registros}`)
  console.log(`📊 Tabelas com dados: ${data._meta.total_tabelas}\n`)

  // Ordem reversa para deletar (filhos primeiro)
  const ordemDelete = [...TABELAS_ORDEM].reverse()
  // Ordem normal para restaurar (pais primeiro)
  const ordemRestore = TABELAS_ORDEM

  // 1. Deletar tudo (ordem reversa)
  console.log('── 1. Limpando banco atual ──')
  for (const tabela of ordemDelete) {
    const delegate = (prisma as unknown as Record<string, { deleteMany: () => Promise<{ count: number }> }>)[tabela]
    if (!delegate) continue
    try {
      const r = await delegate.deleteMany({})
      if (r.count > 0) console.log(`  ✓ ${tabela.padEnd(28)} ${r.count} deletados`)
    } catch (err) {
      // ignora erro de tabela não existir
    }
  }

  // 2. Restaurar (ordem normal)
  console.log('\n── 2. Restaurando dados ──')
  let totalRestaurado = 0
  for (const tabela of ordemRestore) {
    const registros = data.data[tabela]
    if (!registros || registros.length === 0) continue

    const delegate = (prisma as unknown as Record<string, { createMany: (args: { data: unknown[] }) => Promise<{ count: number }> }>)[tabela]
    if (!delegate) continue

    try {
      const r = await delegate.createMany({ data: registros as Record<string, unknown>[] })
      totalRestaurado += r.count
      console.log(`  ✓ ${tabela.padEnd(28)} ${r.count} restaurados`)
    } catch (err) {
      console.log(`  ✗ ${tabela.padEnd(28)} ERRO: ${err instanceof Error ? err.message.slice(0, 80) : err}`)
      // Tenta criar um por um (para identificar qual falha)
      let ok = 0
      for (const reg of registros) {
        try {
          await (delegate as { create: (args: { data: unknown }) => Promise<unknown> }).create({ data: reg })
          ok++
        } catch {
          // skip
        }
      }
      if (ok > 0) {
        console.log(`    ↻ ${ok}/${registros.length} restaurados (individual)`)
        totalRestaurado += ok
      }
    }
  }

  console.log('\n' + '═'.repeat(70))
  console.log('✅ RESTORE COMPLETO')
  console.log('═'.repeat(70))
  console.log(`\n📊 Total restaurado: ${totalRestaurado} registros`)
}

const TABELAS_ORDEM = [
  'user', 'nutricionista',
  'escola', 'tipoRefeicao', 'alimento', 'insumo', 'lanche', 'feriado',
  'cardapioSemestral', 'cardapioNutricional', 'cardapioSemanaNutri', 'cardapioDiaNutri', 'cardapioItem',
  'preparacao', 'preparacaoIngrediente', 'preparacaoPercapita', 'preparacaoSubstituicao',
  'categoriaRefeicao', 'metaNutricional',
  'receita', 'movimentacaoEstoque', 'pedidoCompra', 'itemPedidoCompra', 'contagemEstoque',
  'pfQuantidade', 'pcqQuantidade', 'lancheDistribuicao', 'ajuste', 'historicoSemana',
  'sobrescritaCardapio', 'listaCompras', 'cardapioHorarioRefeicao',
  'account', 'session', 'verificationToken',
]

main()
  .catch(async (err) => {
    console.error('❌ Erro fatal:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
