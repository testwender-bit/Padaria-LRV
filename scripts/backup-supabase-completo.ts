// ============================================================
// scripts/backup-supabase-completo.ts
// ============================================================
// Backup COMPLETO do banco Supabase (todas as 34 tabelas).
// Salva tudo em /tmp/backup-supabase-YYYYMMDD.json
//
// Alternativa ao backup do painel Supabase (que é pago no free tier).
// Este script é GRATUITO e exporta tudo para um arquivo JSON local.
//
// USO:
//   npx tsx scripts/backup-supabase-completo.ts
//
// Para restaurar (em caso de problema):
//   npx tsx scripts/restore-supabase-completo.ts
// ============================================================

import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

// Ordem de dependência (FKs) — para restore funcionar na ordem correta
const TABELAS_ORDEM = [
  // 1. Autenticação
  'user',
  'nutricionista',
  // 2. Configurações base
  'escola',
  'tipoRefeicao',
  'alimento',
  'insumo',
  'lanche',
  'feriado',
  // 3. Cardápios
  'cardapioSemestral',
  'cardapioNutricional',
  'cardapioSemanaNutri',
  'cardapioDiaNutri',
  'cardapioItem',
  // 4. Preparações
  'preparacao',
  'preparacaoIngrediente',
  'preparacaoPercapita',
  'preparacaoSubstituicao',
  // 5. Categorias
  'categoriaRefeicao',
  'metaNutricional',
  // 6. Estoque
  'receita',
  'movimentacaoEstoque',
  'pedidoCompra',
  'itemPedidoCompra',
  'contagemEstoque',
  // 7. Outros
  'pfQuantidade',
  'pcqQuantidade',
  'lancheDistribuicao',
  'ajuste',
  'historicoSemana',
  'sobrescritaCardapio',
  'listaCompras',
  'cardapioHorarioRefeicao',
  // 8. NextAuth auxiliares
  'account',
  'session',
  'verificationToken',
]

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('💾 BACKUP COMPLETO DO BANCO SUPABASE')
  console.log('═'.repeat(70))
  console.log()

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')
  const backupPath = `/tmp/backup-supabase-${timestamp}.json`

  const backup: Record<string, unknown[]> = {}
  const stats: Array<{ tabela: string; count: number }> = []
  let totalRegistros = 0

  for (const tabela of TABELAS_ORDEM) {
    const delegate = (prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[tabela]
    if (!delegate) {
      console.log(`  ⚠️  Modelo não encontrado: ${tabela}`)
      continue
    }

    try {
      const registros = await delegate.findMany()
      backup[tabela] = registros
      totalRegistros += registros.length
      stats.push({ tabela, count: registros.length })
      const marker = registros.length === 0 ? '  ' : '✓'
      console.log(`  ${marker} ${tabela.padEnd(28)} ${String(registros.length).padStart(6)}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ✗ ${tabela.padEnd(28)} ERRO: ${msg.slice(0, 120)}`)
      backup[tabela] = []
      stats.push({ tabela, count: 0 })
    }
  }

  // Salvar backup
  const output = {
    _meta: {
      backup_at: new Date().toISOString(),
      total_registros: totalRegistros,
      total_tabelas: stats.filter(s => s.count > 0).length,
      tabelas: stats,
    },
    data: backup,
  }

  fs.writeFileSync(backupPath, JSON.stringify(output, null, 2))

  console.log('\n' + '═'.repeat(70))
  console.log('✅ BACKUP COMPLETO')
  console.log('═'.repeat(70))
  console.log(`\n📊 Total de registros: ${totalRegistros}`)
  console.log(`📊 Tabelas com dados: ${stats.filter(s => s.count > 0).length}`)
  console.log(`💾 Arquivo: ${backupPath}`)
  console.log(`   Tamanho: ${(fs.statSync(backupPath).size / 1024).toFixed(1)} KB`)
  console.log(`\n📋 Para restaurar (em caso de problema):`)
  console.log(`   npx tsx scripts/restore-supabase-completo.ts`)
  console.log(`\n⚠️  GUARDE ESTE ARQUIVO EM LOCAL SEGURO!`)
  console.log(`   Ele contém TODOS os dados do sistema.`)
}

main()
  .catch(async (err) => {
    console.error('❌ Erro fatal:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
