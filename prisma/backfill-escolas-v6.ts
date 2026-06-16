// ============================================================
// backfill-escolas-v6.ts
// Atualiza escolas existentes com campos novos (segmento, alunos_parcial,
// alunos_integral, dia_pao_frances, dia_lanche, mescla_parcial_integral).
//
// Execução:
//   npx tsx prisma/backfill-escolas-v6.ts
// ============================================================

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const escolas = await prisma.escola.findMany()
  console.log(`Atualizando ${escolas.length} escolas com campos v6...`)

  for (const esc of escolas) {
    // Inferir segmento a partir da categoria
    let segmento = 'REGULAR'
    switch (esc.categoria) {
      case 'CRECHE':
        segmento = 'CRECHE'
        break
      case 'INTEGRAL':
        segmento = 'INTEGRAL'
        break
      case 'BIFASICA':
        segmento = 'REGULAR'
        break
      case 'INTERIOR':
        segmento = 'REGULAR'
        break
      default:
        segmento = 'REGULAR'
    }

    await prisma.escola.update({
      where: { id: esc.id },
      data: {
        segmento,
        // Deixa os demais campos com defaults (0/null/false)
        // — a nutricionista vai preencher depois na UI
      },
    })
  }

  console.log('✓ Backfill concluído')
}

main()
  .catch((e) => {
    console.error('Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
