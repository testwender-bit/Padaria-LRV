// ============================================================
// scripts/setup-creche-complemento-v815.ts
// ============================================================
// Reconfigura a categoria CRECHE para ter FRUTA como slot próprio
// (deixou de ser sub de CAFE_MANHA) com COMPLEMENTO como sub dela.
//
// v8.15 — Estrutura final da CRECHE (4 linhas no PDF):
//   1. CAFE_MANHA (Café da Manhã) — 07h30 — 20%
//   2. FRUTA (Fruta) — 08h45 / 13h30 — 10%  ← vira slot próprio
//      ↳ COMPLEMENTO (Complemento) — 13h30 — 5% [SUB — absorve HIDRATACAO]
//   3. ALMOCO (Almoço) — 10h00 — 30%
//   4. JANTAR (Jantar) — 15h30 — 25%
//
// Mudanças:
//   - FRUTA_MANHA: sub_de_codigo = null (vira slot próprio)
//   - Criado tipo COMPLEMENTO (horário 13h30, sub_de_codigo = 'FRUTA_MANHA')
//   - HIDRATACAO removido da CRECHE (5% absorvido pelo COMPLEMENTO)
//
// Também aplica à BIFASICA para manter consistência:
//   1. CAFE_MANHA — 07h30 — 20%
//   2. FRUTA — 08h45 / 13h30 — 10%
//      ↳ COMPLEMENTO — 13h30 — 5% [SUB]
//   3. LANCHE_PRE_ESCOLA — 09h00 / 15h00 — 10%
//   4. ALMOCO — 10h00 — 30%
//   5. JANTAR — 15h30 — 25%
//
// USO:
//   npx tsx scripts/setup-creche-complemento-v815.ts          # dry-run
//   npx tsx scripts/setup-creche-complemento-v815.ts --apply  # aplicar
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const MODO_APLICAR = process.argv.includes('--apply')

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('🏫 SETUP CRECHE v8.15 (Fruta slot próprio + Complemento sub)')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN (use --apply para gravar)'}\n`)

  // ── ETAPA 1: FRUTA_MANHA vira slot próprio ──
  console.log('📋 Etapa 1: FRUTA_MANHA vira slot próprio (deixa de ser sub de CAFE_MANHA)')
  const frutaManha = await prisma.tipoRefeicao.findUnique({
    where: { codigo: 'FRUTA_MANHA' },
  })
  if (!frutaManha) {
    console.log('  ⚠️  FRUTA_MANHA não encontrado — pulando')
  } else {
    console.log(`  Atual: nome='${frutaManha.nome}', horário='${frutaManha.horario}', sub_de_codigo=${frutaManha.sub_de_codigo || '(null)'}`)
    if (MODO_APLICAR) {
      console.log(`  → Atualizando: sub_de_codigo=null (vira slot próprio)...`)
      await prisma.tipoRefeicao.update({
        where: { id: frutaManha.id },
        data: {
          nome: 'Fruta',
          horario: '08h45 / 13h30',
          sub_de_codigo: null,
        },
      })
      console.log(`  ✓ Atualizado`)
    }
  }

  // ── ETAPA 2: Criar COMPLEMENTO ──
  console.log('\n📋 Etapa 2: Criar tipo COMPLEMENTO (sub de FRUTA_MANHA)')
  const existenteComplemento = await prisma.tipoRefeicao.findUnique({
    where: { codigo: 'COMPLEMENTO' },
  })

  if (existenteComplemento) {
    console.log(`  ✓ Já existe (horário=${existenteComplemento.horario}, sub_de_codigo=${existenteComplemento.sub_de_codigo || '(null)'})`)
    if (MODO_APLICAR && existenteComplemento.sub_de_codigo !== 'FRUTA_MANHA') {
      console.log(`  → Atualizando: sub_de_codigo='FRUTA_MANHA', horário='13h30'...`)
      await prisma.tipoRefeicao.update({
        where: { id: existenteComplemento.id },
        data: {
          nome: 'Complemento',
          horario: '13h30',
          ordem: 8,
          sub_de_codigo: 'FRUTA_MANHA',
        },
      })
      console.log(`  ✓ Atualizado`)
    }
  } else {
    console.log(`  → Criando COMPLEMENTO (horário 13h30, sub de FRUTA_MANHA)...`)
    if (MODO_APLICAR) {
      await prisma.tipoRefeicao.create({
        data: {
          codigo: 'COMPLEMENTO',
          nome: 'Complemento',
          horario: '13h30',
          ordem: 8,
          sub_de_codigo: 'FRUTA_MANHA',
        },
      })
      console.log(`  ✓ Criado`)
    }
  }

  // ── ETAPA 3: Recriar CategoriaRefeicao CRECHE ──
  console.log('\n📋 Etapa 3: Reconfigurar CategoriaRefeicao CRECHE (v8.15)')
  const antigasCreche = await prisma.categoriaRefeicao.findMany({
    where: { categoria_escola: 'CRECHE' },
    include: { tipo_refeicao: { select: { codigo: true } } },
  })
  console.log(`  Associações CRECHE atuais: ${antigasCreche.length}`)
  for (const a of antigasCreche) {
    console.log(`    - ${a.tipo_refeicao.codigo} (${a.percentual_energia}%)`)
  }

  const novasAssocCreche = [
    { codigo: 'CAFE_MANHA',    percentual: 20 },
    { codigo: 'FRUTA_MANHA',   percentual: 10 },
    { codigo: 'COMPLEMENTO',   percentual: 5  },
    { codigo: 'ALMOCO',        percentual: 30 },
    { codigo: 'JANTAR',        percentual: 25 },
  ]

  if (MODO_APLICAR) {
    if (antigasCreche.length > 0) {
      console.log(`  → Removendo ${antigasCreche.length} associações antigas...`)
      await prisma.categoriaRefeicao.deleteMany({ where: { categoria_escola: 'CRECHE' } })
    }
    console.log(`  → Criando 5 novas associações:`)
    for (const nova of novasAssocCreche) {
      const tipo = await prisma.tipoRefeicao.findUnique({ where: { codigo: nova.codigo } })
      if (!tipo) {
        console.log(`    ⚠️  Tipo ${nova.codigo} não encontrado — pulando`)
        continue
      }
      await prisma.categoriaRefeicao.create({
        data: {
          categoria_escola: 'CRECHE',
          tipo_refeicao_id: tipo.id,
          percentual_energia: nova.percentual,
        },
      })
      console.log(`    ✓ ${nova.codigo} (${nova.percentual}%)`)
    }
  } else {
    console.log(`  → (seriam criadas 5 novas associações):`)
    for (const nova of novasAssocCreche) {
      console.log(`    - ${nova.codigo} (${nova.percentual}%)`)
    }
  }

  // ── ETAPA 4: Recriar CategoriaRefeicao BIFASICA ──
  console.log('\n📋 Etapa 4: Reconfigurar CategoriaRefeicao BIFASICA (mesma mudança)')
  const antigasBifasica = await prisma.categoriaRefeicao.findMany({
    where: { categoria_escola: 'BIFASICA' },
    include: { tipo_refeicao: { select: { codigo: true } } },
  })
  console.log(`  Associações BIFASICA atuais: ${antigasBifasica.length}`)
  for (const a of antigasBifasica) {
    console.log(`    - ${a.tipo_refeicao.codigo} (${a.percentual_energia}%)`)
  }

  const novasAssocBifasica = [
    { codigo: 'CAFE_MANHA',         percentual: 20 },
    { codigo: 'FRUTA_MANHA',        percentual: 10 },
    { codigo: 'COMPLEMENTO',        percentual: 5  },
    { codigo: 'LANCHE_PRE_ESCOLA',  percentual: 10 },
    { codigo: 'ALMOCO',             percentual: 30 },
    { codigo: 'JANTAR',             percentual: 25 },
  ]

  if (MODO_APLICAR) {
    if (antigasBifasica.length > 0) {
      console.log(`  → Removendo ${antigasBifasica.length} associações antigas...`)
      await prisma.categoriaRefeicao.deleteMany({ where: { categoria_escola: 'BIFASICA' } })
    }
    console.log(`  → Criando 6 novas associações:`)
    for (const nova of novasAssocBifasica) {
      const tipo = await prisma.tipoRefeicao.findUnique({ where: { codigo: nova.codigo } })
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
    for (const nova of novasAssocBifasica) {
      console.log(`    - ${nova.codigo} (${nova.percentual}%)`)
    }
  }

  // ── RESUMO FINAL ──
  console.log('\n' + '═'.repeat(70))
  console.log('📋 CONFIGURAÇÃO FINAL (v8.15)')
  console.log('═'.repeat(70))
  console.log('  CRECHE (4 linhas no PDF):')
  console.log('    1. CAFE_MANHA (Café da Manhã) — 07h30 — 20%')
  console.log('    2. FRUTA (Fruta) — 08h45 / 13h30 — 10%  ← slot próprio')
  console.log('       ↳ COMPLEMENTO (Complemento) — 13h30 — 5% [SUB]')
  console.log('    3. ALMOCO (Almoço) — 10h00 — 30%')
  console.log('    4. JANTAR (Jantar) — 15h30 — 25%')
  console.log('')
  console.log('  BIFASICA (5 linhas no PDF — adiciona LANCHE_PRE_ESCOLA):')
  console.log('    1. CAFE_MANHA — 07h30 — 20%')
  console.log('    2. FRUTA — 08h45 / 13h30 — 10%')
  console.log('       ↳ COMPLEMENTO — 13h30 — 5% [SUB]')
  console.log('    3. LANCHE_PRE_ESCOLA — 09h00 / 15h00 — 10%')
  console.log('    4. ALMOCO — 10h00 — 30%')
  console.log('    5. JANTAR — 15h30 — 25%')
  console.log('')
  console.log('  Mudanças v8.15:')
  console.log('    - FRUTA_MANHA: sub_de_codigo=null (vira slot próprio)')
  console.log('    - Criado tipo COMPLEMENTO (sub de FRUTA_MANHA, horário 13h30)')
  console.log('    - HIDRATACAO removido da CRECHE e BIFASICA')
  console.log('    - 5% da HIDRATACAO absorvido por COMPLEMENTO')
  console.log('')
  console.log('  Observações:')
  console.log('    - Cardápios existentes com itens em HIDRATACAO:')
  console.log('      os itens ficam órfãos. Mover manualmente para COMPLEMENTO ou recriar.')
  console.log('    - Editor e PDF já suportam múltiplos subs por pai (v8.13.2)')
  console.log('      e slot próprio com subs — sem mudança de código necessária.')
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
