// ============================================================
// scripts/recalcular-ferro-heme.ts
// ============================================================
// Recalcula o campo ferro_heme_mg para TODOS os alimentos
// baseado na função estimarFerroHeme (grupo + nome do alimento).
//
// USO:
//   npx tsx scripts/recalcular-ferro-heme.ts          # dry-run
//   npx tsx scripts/recalcular-ferro-heme.ts --apply   # aplicar
// ============================================================

import { PrismaClient } from '@prisma/client'
import { estimarFerroHeme } from '../src/lib/ferro-heme-utils'

const prisma = new PrismaClient()
const MODO_APLICAR = process.argv.includes('--apply')

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('🩸 RECALCULAR FERRO HEME')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN'}\n`)

  const alimentos = await prisma.alimento.findMany({
    select: { id: true, codigo_taco: true, nome: true, grupo: true, ferro_mg: true, ferro_heme_mg: true },
  })

  console.log(`📊 Total de alimentos: ${alimentos.length}`)
  const comHemeAntes = alimentos.filter(a => a.ferro_heme_mg > 0).length
  console.log(`📊 Com ferro_heme > 0 (antes): ${comHemeAntes}`)

  let atualizados = 0
  const estatisticas: Record<string, number> = {}

  for (const al of alimentos) {
    const hemeCalculado = estimarFerroHeme({
      grupo: al.grupo,
      nome: al.nome,
      ferro_mg: al.ferro_mg,
    })

    if (hemeCalculado !== al.ferro_heme_mg) {
      estatisticas[al.grupo] = (estatisticas[al.grupo] || 0) + 1
      atualizados++

      if (MODO_APLICAR) {
        await prisma.alimento.update({
          where: { id: al.id },
          data: { ferro_heme_mg: hemeCalculado },
        })
      }

      // Mostrar amostra
      if (atualizados <= 30) {
        console.log(`  ${hemeCalculado > 0 ? '✓' : ' '} ${al.nome.padEnd(45)} ferro=${al.ferro_mg}mg → heme=${hemeCalculado}mg [${al.grupo}]`)
      }
    }
  }

  console.log(`\n── ESTATÍSTICAS ──`)
  console.log(`  Total atualizado: ${atualizados}`)
  for (const [grupo, count] of Object.entries(estatisticas).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${grupo.padEnd(40)} ${count}`)
  }

  if (MODO_APLICAR) {
    // Verificar resultado
    const comHemeDepois = await prisma.alimento.count({ where: { ferro_heme_mg: { gt: 0 } } })
    console.log(`\n✅ Com ferro_heme > 0 (depois): ${comHemeDepois}`)
  } else {
    console.log(`\n👁️  DRY-RUN — para aplicar: npx tsx scripts/recalcular-ferro-heme.ts --apply`)
  }
}

main()
  .catch(async (err) => {
    console.error('❌ Erro:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
