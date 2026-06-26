// ============================================================
// scripts/setup-apae-v817.ts
// ============================================================
// Cria a categoria de escola APAE com 3 tipos de refeição:
//   - CAFE_MANHA (Café da Manhã) — 20%
//   - LANCHE (Lanche) — 60%
//   - FRUTA (Fruta) — 20%
//
// Também cria metas nutricionais básicas para APAE (se não existirem).
//
// USO:
//   npx tsx scripts/setup-apae-v817.ts          # dry-run
//   npx tsx scripts/setup-apae-v817.ts --apply  # aplicar
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const MODO_APLICAR = process.argv.includes('--apply')

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('🏫 SETUP CATEGORIA APAE (v8.17)')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN (use --apply para gravar)'}\n`)

  // Buscar tipos de refeição existentes
  const cafeManha = await prisma.tipoRefeicao.findUnique({ where: { codigo: 'CAFE_MANHA' } })
  const lanche = await prisma.tipoRefeicao.findUnique({ where: { codigo: 'LANCHE' } })
  const frutaManha = await prisma.tipoRefeicao.findUnique({ where: { codigo: 'FRUTA_MANHA' } })

  console.log('📋 Tipos de refeição:')
  console.log(`  CAFE_MANHA: ${cafeManha ? '✓' : '✗ não encontrado'}`)
  console.log(`  LANCHE:     ${lanche ? '✓' : '✗ não encontrado'}`)
  console.log(`  FRUTA_MANHA:${frutaManha ? '✓' : '✗ não encontrado'}`)

  if (!cafeManha || !lanche || !frutaManha) {
    console.error('\n❌ Tipos de refeição base não encontrados. Rode o seed-nutricao primeiro.')
    process.exit(1)
  }

  // Verificar se já existe associação APAE
  const existentes = await prisma.categoriaRefeicao.findMany({
    where: { categoria_escola: 'APAE' },
    include: { tipo_refeicao: { select: { codigo: true } } },
  })
  console.log(`\n📋 Associações APAE atuais: ${existentes.length}`)
  for (const a of existentes) {
    console.log(`  - ${a.tipo_refeicao.codigo} (${a.percentual_energia}%)`)
  }

  // v8.17: 3 tipos para APAE
  const novasAssoc = [
    { codigo: 'CAFE_MANHA', percentual: 20 },
    { codigo: 'LANCHE',     percentual: 60 },
    { codigo: 'FRUTA_MANHA',percentual: 20 },
  ]

  if (MODO_APLICAR) {
    if (existentes.length > 0) {
      console.log(`\n→ Removendo ${existentes.length} associações antigas...`)
      await prisma.categoriaRefeicao.deleteMany({ where: { categoria_escola: 'APAE' } })
    }
    console.log(`→ Criando 3 novas associações:`)
    for (const nova of novasAssoc) {
      const tipo = await prisma.tipoRefeicao.findUnique({ where: { codigo: nova.codigo } })
      if (!tipo) {
        console.log(`  ⚠️  Tipo ${nova.codigo} não encontrado — pulando`)
        continue
      }
      await prisma.categoriaRefeicao.create({
        data: {
          categoria_escola: 'APAE',
          tipo_refeicao_id: tipo.id,
          percentual_energia: nova.percentual,
        },
      })
      console.log(`  ✓ ${nova.codigo} (${nova.percentual}%)`)
    }
  } else {
    console.log(`\n→ (seriam criadas 3 associações):`)
    for (const nova of novasAssoc) {
      console.log(`  - ${nova.codigo} (${nova.percentual}%)`)
    }
  }

  // Verificar metas nutricionais APAE
  const metas = await prisma.metaNutricional.findMany({
    where: { categoria_escola: 'APAE' },
  })
  console.log(`\n📋 Metas nutricionais APAE: ${metas.length}`)

  if (metas.length === 0 && MODO_APLICAR) {
    console.log('→ Criando meta nutricional padrão APAE...')
    // Buscar uma meta existente (CRECHE) para usar como base
    const metaBase = await prisma.metaNutricional.findFirst({
      where: { categoria_escola: 'CRECHE' },
    })
    if (metaBase) {
      await prisma.metaNutricional.create({
        data: {
          ...metaBase,
          id: undefined,  // deixa Prisma gerar novo ID
          categoria_escola: 'APAE',
        },
      })
      console.log('  ✓ Meta criada (baseada em CRECHE)')
    } else {
      console.log('  ⚠️  Nenhuma meta CRECHE encontrada para usar como base — crie manualmente')
    }
  }

  // Resumo final
  console.log('\n' + '═'.repeat(70))
  console.log('📋 CONFIGURAÇÃO FINAL APAE (v8.17)')
  console.log('═'.repeat(70))
  console.log('  Categoria: APAE')
  console.log('  Refeições:')
  console.log('    1. CAFE_MANHA (Café da Manhã) — 20%')
  console.log('    2. LANCHE (Lanche) — 60%')
  console.log('    3. FRUTA_MANHA (Fruta) — 20%')
  console.log('')
  console.log('  Para cadastrar escola APAE:')
  console.log('    - Vá em /escolas')
  console.log('    - Crie escola com categoria "APAE"')
  console.log('    - Depois crie cardápio vinculado a essa escola')
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
