// ============================================================
// scripts/setup-bifasica-v813.ts
// ============================================================
// Reconfigura a categoria BIFASICA para funcionar como uma
// "creche + lanche pré-escola extra" em vez de LANCHE_1+LANCHE_2.
//
// v8.14 — Estrutura final (4 linhas no PDF, cabe em 1 folha A4):
//   1. CAFE_MANHA (07h30) — 20%
//      ↳ FRUTA (08h45 / 13h30) — 15% [SUB — mesma fruta servida 2x, cálculo 1x]
//   2. LANCHE_PRE_ESCOLA (09h00 / 15h00) — 10%  [slot próprio, acima do almoço]
//   3. ALMOCO (10h00) — 30%
//   4. JANTAR (15h30) — 25%
//   Total: 100%
//
// Mudanças v8.14:
//   - FRUTA_MANHA renomeado para FRUTA (genérico, nome amigável)
//   - FRUTA tem 2 horários (08h45 / 13h30) — mesma fruta servida 2x, cálculo 1x
//   - HIDRATACAO removido da BIFASICA (vira FRUTA, absorve os 5%)
//   - LANCHE_PRE_ESCOLA deixa de ser sub de CAFE_MANHA — vira slot próprio
//   - LANCHE_PRE_ESCOLA tem 2 horários (09h00 / 15h00)
//   - LANCHE_PRE_ESCOLA fica ACIMA do ALMOCO (cronologicamente 09h00 < 10h00)
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
  console.log('🏫 SETUP BIFÁSICA v8.14 (creche + lanche pré-escola)')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN (use --apply para gravar)'}\n`)

  // 1. Criar/atualizar LANCHE_PRE_ESCOLA (v8.14: slot próprio, 2 horários)
  const existenteLANCHE_PRE = await prisma.tipoRefeicao.findUnique({
    where: { codigo: 'LANCHE_PRE_ESCOLA' },
  })

  console.log('📋 Etapa 1: Tipo de Refeição LANCHE_PRE_ESCOLA')
  if (existenteLANCHE_PRE) {
    console.log(`  ✓ Já existe (horário=${existenteLANCHE_PRE.horario}, sub_de_codigo=${existenteLANCHE_PRE.sub_de_codigo || '(null)'})`)
    // v8.14: vira slot PRÓPRIO (sem sub_de_codigo), com 2 horários (09h00 / 15h00)
    if (MODO_APLICAR) {
      console.log(`  → Atualizando para slot próprio, horário '09h00 / 15h00' (v8.14)...`)
      await prisma.tipoRefeicao.update({
        where: { id: existenteLANCHE_PRE.id },
        data: {
          nome: 'Lanche Pré-Escola',
          horario: '09h00 / 15h00',  // v8.14: 2 horários
          ordem: 7,
          sub_de_codigo: null,  // v8.14: deixa de ser sub, vira slot próprio
        },
      })
      console.log(`  ✓ Atualizado`)
    }
  } else {
    console.log(`  → Criando LANCHE_PRE_ESCOLA (horário '09h00 / 15h00', slot próprio)...`)
    if (MODO_APLICAR) {
      await prisma.tipoRefeicao.create({
        data: {
          codigo: 'LANCHE_PRE_ESCOLA',
          nome: 'Lanche Pré-Escola',
          horario: '09h00 / 15h00',
          ordem: 7,
          sub_de_codigo: null,  // v8.14: slot próprio
        },
      })
      console.log(`  ✓ Criado`)
    }
  }

  // 2. Renomear FRUTA_MANHA → "Fruta" + 2 horários + sub de CAFE_MANHA (v8.14)
  console.log('\n📋 Etapa 2: Renomear FRUTA_MANHA → "Fruta" com 2 horários (08h45 / 13h30)')
  const frutaManha = await prisma.tipoRefeicao.findUnique({
    where: { codigo: 'FRUTA_MANHA' },
  })
  if (!frutaManha) {
    console.log('  ⚠️  FRUTA_MANHA não encontrado — pulando')
  } else {
    console.log(`  Atual: nome='${frutaManha.nome}', horário='${frutaManha.horario}', sub_de_codigo=${frutaManha.sub_de_codigo || '(null)'}`)
    if (MODO_APLICAR) {
      console.log(`  → Atualizando: nome='Fruta', horário='08h45 / 13h30', sub_de_codigo='CAFE_MANHA'...`)
      await prisma.tipoRefeicao.update({
        where: { id: frutaManha.id },
        data: {
          nome: 'Fruta',  // v8.14: genérico (não só manhã)
          horario: '08h45 / 13h30',  // v8.14: 2 horários (manhã + tarde)
          sub_de_codigo: 'CAFE_MANHA',  // mantém como sub de CAFE_MANHA
        },
      })
      console.log(`  ✓ Atualizado`)
    }
  }

  // 3. Limpar e recriar CategoriaRefeicao BIFASICA (v8.14: 5 tipos, 4 linhas no PDF)
  console.log('\n📋 Etapa 3: Reconfigurar CategoriaRefeicao BIFASICA (v8.14)')
  const antigas = await prisma.categoriaRefeicao.findMany({
    where: { categoria_escola: 'BIFASICA' },
    include: { tipo_refeicao: { select: { codigo: true } } },
  })
  console.log(`  Associações BIFASICA atuais: ${antigas.length}`)
  for (const a of antigas) {
    console.log(`    - ${a.tipo_refeicao.codigo} (${a.percentual_energia}%)`)
  }

  // v8.14: 5 tipos (CAFE_MANHA + FRUTA sub + LANCHE_PRE_ESCOLA + ALMOCO + JANTAR)
  // HIDRATACAO removido da BIFASICA — vira FRUTA (15% = 10% fruta + 5% hidratação absorvido)
  // LANCHE_PRE_ESCOLA vira slot próprio (deixou de ser sub em v8.14)
  const novasAssoc = [
    { codigo: 'CAFE_MANHA',         percentual: 20 },
    { codigo: 'FRUTA_MANHA',        percentual: 15 },  // 10% (fruta) + 5% (hidratação absorvido)
    { codigo: 'LANCHE_PRE_ESCOLA',  percentual: 10 },  // slot próprio (deixou de ser sub)
    { codigo: 'ALMOCO',             percentual: 30 },
    { codigo: 'JANTAR',             percentual: 25 },
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
    console.log(`  → Criando 5 novas associações:`)
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
    console.log(`  → (seriam criadas 5 novas associações):`)
    for (const nova of novasAssoc) {
      console.log(`    - ${nova.codigo} (${nova.percentual}%)`)
    }
  }

  // 4. Resumo final
  console.log('\n' + '═'.repeat(70))
  console.log('📋 CONFIGURAÇÃO FINAL DA BIFÁSICA (v8.14)')
  console.log('═'.repeat(70))
  console.log('  Slots na BIFASICA (após aplicar):')
  console.log('    1. CAFE_MANHA (Café da Manhã) — 07h30 — 20%')
  console.log('       ↳ FRUTA (Fruta) — 08h45 / 13h30 — 15% [SUB — mesma fruta 2x, cálculo 1x]')
  console.log('    2. LANCHE_PRE_ESCOLA (Lanche Pré-Escola) — 09h00 / 15h00 — 10%  ← slot próprio')
  console.log('    3. ALMOCO (Almoço) — 10h00 — 30%')
  console.log('    4. JANTAR (Jantar) — 15h30 — 25%')
  console.log('')
  console.log('  Total energia: 20+15+10+30+25 = 100%')
  console.log('  Total de linhas no PDF: 4 (cabe em 1 folha A4 paisagem)')
  console.log('')
  console.log('  Mudanças v8.14:')
  console.log('    - FRUTA_MANHA renomeado para "Fruta" (genérico)')
  console.log('    - FRUTA tem 2 horários (08h45 / 13h30) — mesma fruta servida 2x, cálculo 1x')
  console.log('    - HIDRATACAO removido da BIFASICA (5% absorvido pela FRUTA)')
  console.log('    - LANCHE_PRE_ESCOLA vira slot próprio (deixou de ser sub)')
  console.log('    - LANCHE_PRE_ESCOLA tem 2 horários (09h00 / 15h00)')
  console.log('    - LANCHE_PRE_ESCOLA fica ACIMA do ALMOCO (cronológico)')
  console.log('')
  console.log('  Observações:')
  console.log('    - Cardápios bifásicos EXISTENTES com itens em HIDRATACAO:')
  console.log('      os itens ficam órfãos (HIDRATACAO não existe mais na BIFASICA).')
  console.log('      Solução: mover manualmente para FRUTA ou recriar o cardápio.')
  console.log('    - Cardápios bifásicos EXISTENTES com itens em LANCHE_PRE_ESCOLA:')
  console.log('      continuam funcionando (slot próprio agora).')
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
