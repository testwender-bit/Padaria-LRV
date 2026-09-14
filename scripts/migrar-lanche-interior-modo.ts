// v9.9.0: Migração para popular lanche_interior_modo='LANCHE' em todas as
// semanas existentes do cardápio semestral. O campo foi adicionado no schema
// com @default("LANCHE"), mas semanas já cadastradas antes da migração do
// schema podem ter ficado com NULL em alguns bancos (postgres + prisma).
//
// Rodar UMA vez após aplicar o patch v9.9.0 e rodar `npx prisma db push`.
// (Na maioria dos casos o `prisma db push` já preenche o default e o script
// simplesmente não terá nada a fazer — ele é idempotente e seguro.)
//
// Uso:
//   npx tsx scripts/migrar-lanche-interior-modo.ts
//
// Comportamento:
// - Para cada CardapioSemestral sem lanche_interior_modo (ou com valor vazio):
//   seta lanche_interior_modo = 'LANCHE'.
// - Idempotente: pode rodar quantas vezes quiser.
// - NÃO altera lanche_bifasica_modo nem lanche_bifasica_id.
// - NÃO altera escolas (a flag interior_especial é marcada manualmente
//   pelo usuário em /configuracoes).

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Iniciando migração v9.9.0 — lanche_interior_modo...\n')

  // Busca todos os cardápios semestrais
  const todos = await prisma.cardapioSemestral.findMany({
    select: {
      id: true,
      ano: true,
      semana: true,
      lanche_interior_modo: true,
    },
    orderBy: [{ ano: 'asc' }, { semana: 'asc' }],
  })

  console.log(`📊 Total de cardápios semestrais encontrados: ${todos.length}`)

  // Filtra os que precisam ser atualizados (modo vazio ou null)
  const paraAtualizar = todos.filter(
    (c) => !c.lanche_interior_modo || c.lanche_interior_modo.trim() === ''
  )

  if (paraAtualizar.length === 0) {
    console.log('\n✅ Todos os cardápios já têm lanche_interior_modo definido. Nada a fazer.')
    return
  }

  console.log(`\n🔧 ${paraAtualizar.length} cardápio(s) precisam ser atualizados:\n`)

  let count = 0
  for (const c of paraAtualizar) {
    await prisma.cardapioSemestral.update({
      where: { id: c.id },
      data: { lanche_interior_modo: 'LANCHE' },
    })
    count++
    console.log(`  ✓ Semana ${c.semana}/${c.ano} — setado lanche_interior_modo = 'LANCHE'`)
  }

  console.log(`\n✅ Migração concluída! ${count} cardápio(s) atualizado(s).`)
  console.log('\n📝 Notas:')
  console.log('  - Todas as semanas existentes foram setadas para LANCHE (mesmo lanche das outras escolas).')
  console.log('  - Para ativar o modo especial: marque "Interior Especial" na escola desejada em /configuracoes')
  console.log('    e escolha o "Modo Lanche Interior" da semana em /cardapio.')
}

main()
  .catch((error) => {
    console.error('\n❌ Erro durante migração:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
