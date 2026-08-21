// v9.8: Migração para popular lanche_bifasica_modo='LANCHE' em todas as
// semanas existentes do cardápio semestral. O campo foi adicionado no schema
// com @default("LANCHE"), mas semanas já cadastradas antes da migração do
// schema podem ter ficado com NULL em alguns bancos (postgres + prisma).
//
// Rodar UMA vez após aplicar o patch v9.8.
//
// Uso:
//   npx tsx scripts/migrar-lanche-bifasica-modo.ts
//
// Comportamento:
// - Para cada CardapioSemestral sem lanche_bifasica_modo (ou com valor vazio):
//   seta lanche_bifasica_modo = 'LANCHE'.
// - Idempotente: pode rodar quantas vezes quiser.
// - Não altera lanche_bifasica_id (mantido para compatibilidade).

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Iniciando migração v9.8 — lanche_bifasica_modo...\n')

  // Busca todos os cardápios semestrais
  const todos = await prisma.cardapioSemestral.findMany({
    select: {
      id: true,
      ano: true,
      semana: true,
      lanche_bifasica_modo: true,
      lanche_bifasica_id: true,
    },
    orderBy: [{ ano: 'asc' }, { semana: 'asc' }],
  })

  console.log(`📊 Total de cardápios semestrais encontrados: ${todos.length}`)

  // Filtra os que precisam ser atualizados (modo vazio ou null)
  const paraAtualizar = todos.filter(
    (c) => !c.lanche_bifasica_modo || c.lanche_bifasica_modo.trim() === ''
  )

  if (paraAtualizar.length === 0) {
    console.log('\n✅ Todos os cardápios já têm lanche_bifasica_modo definido. Nada a fazer.')
    return
  }

  console.log(`\n🔧 ${paraAtualizar.length} cardápio(s) precisam ser atualizados:\n`)

  let count = 0
  for (const c of paraAtualizar) {
    await prisma.cardapioSemestral.update({
      where: { id: c.id },
      data: { lanche_bifasica_modo: 'LANCHE' },
    })
    count++
    console.log(`  ✓ Semana ${c.semana}/${c.ano} — setado lanche_bifasica_modo = 'LANCHE'`)
  }

  console.log(`\n✅ Migração concluída! ${count} cardápio(s) atualizado(s).`)
  console.log('\n📝 Notas:')
  console.log('  - Todas as semanas existentes foram setadas para LANCHE (mesmo lanche das outras escolas).')
  console.log('  - O campo lanche_bifasica_id NÃO foi alterado (mantido para compatibilidade).')
  console.log('  - Para mudar o modo de uma semana específica, vá em /cardapio e edite a semana.')
}

main()
  .catch((error) => {
    console.error('\n❌ Erro durante migração:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
