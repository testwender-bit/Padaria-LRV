// ============================================================
// scripts/setup-bifasica-v813.ts
// ============================================================
// Reconfigura a categoria BIFASICA para funcionar como uma
// "creche + lanche pré-escola extra" em vez de LANCHE_1+LANCHE_2.
//
// O QUE FAZ:
//   1. Cria o novo tipo de refeição LANCHE_PRE_ESCOLA (horário 09h00)
//   2. Marca FRUTA_MANHA como sub de CAFE_MANHA (sub_de_codigo="CAFE_MANHA")
//   3. Limpa as associações CategoriaRefeicao BIFASICA antigas (LANCHE_1/LANCHE_2)
//   4. Recria CategoriaRefeicao BIFASICA com 6 tipos:
//      CAFE_MANHA (20%), FRUTA_MANHA (10%), ALMOCO (30%),
//      HIDRATACAO (5%), LANCHE_PRE_ESCOLA (10%), JANTAR (25%)
//
// Após rodar este script:
//   - Cardápios de BIFASICA existentes continuam funcionando
//     (mas podem ter itens em LANCHE_1/LANCHE_2 que precisam ser
//      re-mapeados — fazer manualmente no editor)
//   - NOVOS cardápios BIFASICA criados a partir de agora terão 6 slots
//   - Replicação CRECHE → BIFASICA passa a ser permitida
//
// USO:
//   npx tsx scripts/setup-bifasica-v813.ts          # dry-run
//   npx tsx scripts/setup-bifasica-v813.ts --apply  # aplicar
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const MODO_APLICAR = process.argv.includes('--apply')

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('🏫 SETUP BIFÁSICA v8.13 (creche + lanche pré-escola)')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN (use --apply para gravar)'}\n`)

  // 1. Criar/atualizar LANCHE_PRE_ESCOLA
  const existenteLANCHE_PRE = await prisma.tipoRefeicao.findUnique({
    where: { codigo: 'LANCHE_PRE_ESCOLA' },
  })

  console.log('📋 Etapa 1: Tipo de Refeição LANCHE_PRE_ESCOLA')
  if (existenteLANCHE_PRE) {
    console.log(`  ✓ Já existe (id=${existenteLANCHE_PRE.id}, horário=${existenteLANCHE_PRE.horario})`)
    if (MODO_APLICAR && existenteLANCHE_PRE.horario !== '09h00min') {
      console.log(`  → Atualizando horário para 09h00min...`)
      await prisma.tipoRefeicao.update({
        where: { id: existenteLANCHE_PRE.id },
        data: { nome: 'Lanche Pré-Escola', horario: '09h00min', ordem: 7 },
      })
    }
  } else {
    console.log(`  → Criando LANCHE_PRE_ESCOLA (horário 09h00min)...`)
    if (MODO_APLICAR) {
      await prisma.tipoRefeicao.create({
        data: {
          codigo: 'LANCHE_PRE_ESCOLA',
          nome: 'Lanche Pré-Escola',
          horario: '09h00min',
          ordem: 7,
        },
      })
      console.log(`  ✓ Criado`)
    }
  }

  // 2. Marcar FRUTA_MANHA como sub de CAFE_MANHA
  console.log('\n📋 Etapa 2: Marcar FRUTA_MANHA como sub de CAFE_MANHA')
  const frutaManha = await prisma.tipoRefeicao.findUnique({
    where: { codigo: 'FRUTA_MANHA' },
  })
  if (!frutaManha) {
    console.log('  ⚠️  FRUTA_MANHA não encontrado — pulando')
  } else {
    console.log(`  FRUTA_MANHA atual: sub_de_codigo = ${frutaManha.sub_de_codigo || '(null)'}`)
    if (MODO_APLICAR && frutaManha.sub_de_codigo !== 'CAFE_MANHA') {
      console.log(`  → Marcando como sub de CAFE_MANHA...`)
      await prisma.tipoRefeicao.update({
        where: { id: frutaManha.id },
        data: { sub_de_codigo: 'CAFE_MANHA' },
      })
      console.log(`  ✓ Marcado`)
    } else if (frutaManha.sub_de_codigo === 'CAFE_MANHA') {
      console.log(`  ✓ Já está marcado`)
    }
  }

  // 3. Limpar e recriar CategoriaRefeicao BIFASICA
  console.log('\n📋 Etapa 3: Reconfigurar CategoriaRefeicao BIFASICA')
  const antigas = await prisma.categoriaRefeicao.findMany({
    where: { categoria_escola: 'BIFASICA' },
    include: { tipo_refeicao: { select: { codigo: true } } },
  })
  console.log(`  Associações BIFASICA atuais: ${antigas.length}`)
  for (const a of antigas) {
    console.log(`    - ${a.tipo_refeicao.codigo} (${a.percentual_energia}%)`)
  }

  const novasAssoc = [
    { codigo: 'CAFE_MANHA',       percentual: 20 },
    { codigo: 'FRUTA_MANHA',      percentual: 10 },
    { codigo: 'ALMOCO',           percentual: 30 },
    { codigo: 'HIDRATACAO',       percentual: 5  },
    { codigo: 'LANCHE_PRE_ESCOLA',percentual: 10 },
    { codigo: 'JANTAR',           percentual: 25 },
  ]

  if (MODO_APLICAR) {
    // Limpa associações antigas
    if (antigas.length > 0) {
      console.log(`  → Removendo ${antigas.length} associações antigas...`)
      await prisma.categoriaRefeicao.deleteMany({
        where: { categoria_escola: 'BIFASICA' },
      })
    }
    // Cria novas
    console.log(`  → Criando 6 novas associações:`)
    for (const nova of novasAssoc) {
      const tipo = await prisma.tipoRefeicao.findUnique({
        where: { codigo: nova.codigo },
      })
      if (!tipo) {
        console.log(`    ⚠️  Tipo ${nova.codigo} não encontrado — pulando`)
        continue
      }
      await prisma.categoriaRefeicao.create({
        data: {
          categoria_escola: 'BIFASICA',
          tipo_refeicao_id: tipo.id,
          percentual_energia: nova.percentual,
        },
      })
      console.log(`    ✓ ${nova.codigo} (${nova.percentual}%)`)
    }
  } else {
    console.log(`  → (seriam criadas 6 novas associações):`)
    for (const nova of novasAssoc) {
      console.log(`    - ${nova.codigo} (${nova.percentual}%)`)
    }
  }

  // 4. Resumo final
  console.log('\n' + '═'.repeat(70))
  console.log('📋 CONFIGURAÇÃO FINAL DA BIFÁSICA')
  console.log('═'.repeat(70))
  console.log('  Slots na BIFASICA (após aplicar):')
  console.log('    1. CAFE_MANHA (Café da Manhã) — 07h30min — 20%')
  console.log('       ↳ FRUTA_MANHA (Fruta da Manhã) — 08h45min — 10% [SUB]')
  console.log('    2. ALMOCO (Almoço) — 10h00min — 30%')
  console.log('    3. HIDRATACAO (Hidratação) — 13h30min — 5%')
  console.log('    4. LANCHE_PRE_ESCOLA (Lanche Pré-Escola) — 09h00min — 10%  ← NOVO')
  console.log('    5. JANTAR (Jantar) — 15h30min — 25%')
  console.log('')
  console.log('  Total energia: 20+10+30+5+10+25 = 100%')
  console.log('')
  console.log('  FRUTA_MANHA agora é SUB de CAFE_MANHA:')
  console.log('    - Editor: renderiza como sub-bloco dentro do slot CAFE_MANHA')
  console.log('    - PDF: renderiza na mesma célula do CAFE_MANHA')
  console.log('')
  console.log('  Replicação CRECHE → BIFASICA passa a funcionar:')
  console.log('    - Itens CAFE_MANHA → CAFE_MANHA')
  console.log('    - Itens FRUTA_MANHA → FRUTA_MANHA')
  console.log('    - Itens ALMOCO → ALMOCO')
  console.log('    - Itens HIDRATACAO → HIDRATACAO')
  console.log('    - Itens JANTAR → JANTAR')
  console.log('    - Slot LANCHE_PRE_ESCOLA fica vazio (preencher manualmente)')
  console.log('')
  if (MODO_APLICAR) {
    console.log('✅ ALTERAÇÕES APLICADAS no banco de dados.')
  } else {
    console.log('👁️  DRY-RUN. Para aplicar de fato, rode com --apply')
  }
  console.log('═'.repeat(70) + '\n')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
