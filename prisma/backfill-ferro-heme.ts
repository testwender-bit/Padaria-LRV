// ============================================================
// backfill-ferro-heme.ts — Atualiza ferro_heme_mg de TODOS os
// alimentos já existentes no banco, sem precisar reseedar.
//
// Uso: npx tsx prisma/backfill-ferro-heme.ts
// ============================================================
import { PrismaClient } from '@prisma/client'
import { estimarFerroHeme } from '../src/lib/ferro-heme-utils'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Backfill de ferro_heme_mg em alimentos existentes...')

  const alimentos = await prisma.alimento.findMany({
    select: { id: true, nome: true, grupo: true, ferro_mg: true, ferro_heme_mg: true },
  })

  console.log(`  → ${alimentos.length} alimentos encontrados`)

  let atualizados = 0
  let inalterados = 0

  for (const a of alimentos) {
    const estimado = estimarFerroHeme({
      grupo: a.grupo || '',
      nome: a.nome || '',
      ferro_mg: a.ferro_mg,
    })

    // Comparar com tolerância de 3 casas
    const atualNum = Number(a.ferro_heme_mg || 0)
    if (Math.abs(atualNum - estimado) < 0.001) {
      inalterados++
      continue
    }

    await prisma.alimento.update({
      where: { id: a.id },
      data: { ferro_heme_mg: estimado },
    })
    atualizados++

    // Loga amostras para validação
    if (atualizados <= 15 && estimado > 0) {
      console.log(`  ✓ "${a.nome}" [${a.grupo}] ferro_mg=${a.ferro_mg} → heme=${estimado}`)
    }
  }

  console.log('')
  console.log(`  ✓ ${atualizados} alimentos atualizados`)
  console.log(`  ✓ ${inalterados} já estavam corretos`)

  // Resumo por grupo
  const comHeme = await prisma.alimento.findMany({
    where: { ferro_heme_mg: { gt: 0 } },
    select: { grupo: true },
  })
  const porGrupo: Record<string, number> = {}
  for (const a of comHeme) {
    porGrupo[a.grupo] = (porGrupo[a.grupo] || 0) + 1
  }
  console.log('  ✓ Alimentos com ferro heme > 0:')
  for (const [g, n] of Object.entries(porGrupo)) {
    console.log(`    • ${g}: ${n}`)
  }

  console.log('\n✅ Backfill concluído.')
}

main()
  .catch((e) => {
    console.error('Erro no backfill:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
