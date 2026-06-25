// ============================================================
// scripts/zerar-acucar-creche-bercario.ts
// ============================================================
// Para cada ingrediente cujo alimento é açúcar (refinado/mascavo/cristal)
// ou pertence ao grupo "Produtos açucarados", cria/atualiza as
// percapitas BERCARIO e CRECHE para quantidade_gramas = 0.
//
// Isso faz com que:
//   - Cálculo nutricional zere a contribuição do açúcar em creche/berçário
//   - Lista de compras não inclua açúcar para escolas de creche
//   - PDF e UI (após filtro) não mostrem "Açúcar" na lista de ingredientes
//     de cardápios de creche/berçário
//
// Respeita casos especiais: se o nutricionista deliberadamente cadastrou
// creche=10 (ex: Batata doce caramelada), PERGUNTA antes de sobrescrever.
//
// USO:
//   npx tsx scripts/zerar-acucar-creche-bercario.ts          # dry-run (relatório)
//   npx tsx scripts/zerar-acucar-creche-bercario.ts --apply   # aplicar
//   npx tsx scripts/zerar-acucar-creche-bercario.ts --apply --force  # sobrescreve casos especiais
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const MODO_APLICAR = process.argv.includes('--apply')
const FORCAR = process.argv.includes('--force')

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('🍬 ZERAR AÇÚCAR EM CRECHE/BERCÁRIO (v8.12)')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN (use --apply para gravar)'}${FORCAR ? ' + --force (sobrescreve casos especiais)' : ''}\n`)

  // 1. Busca todos os ingredientes cujo alimento é açúcar
  //    Critério: nome contém "açúcar" (refinado, mascavo, cristal) — não inclui
  //    "Cereal matinal açúcar" nem "Café coado sem açúcar" nem "Produtos açucarados" genéricos.
  const ingredientesAcucar = await prisma.preparacaoIngrediente.findMany({
    where: {
      alimento: {
        OR: [
          { nome: { equals: 'Açúcar, refinado', mode: 'insensitive' } },
          { nome: { equals: 'Açúcar, mascavo', mode: 'insensitive' } },
          { nome: { equals: 'Açúcar, cristal', mode: 'insensitive' } },
          { nome: { equals: 'Açúcar refinado', mode: 'insensitive' } },
          { nome: { equals: 'Açúcar cristal', mode: 'insensitive' } },
          { nome: { equals: 'Açúcar mascavo', mode: 'insensitive' } },
          { nome: { equals: 'Açúcar', mode: 'insensitive' } },
        ],
      },
    },
    include: {
      alimento: { select: { id: true, nome: true, grupo: true } },
      percapitas: true,
      preparacao: { select: { id: true, nome: true } },
    },
  })

  console.log(`📊 Ingredientes de açúcar encontrados: ${ingredientesAcucar.length}\n`)

  let percapitasCriadas = 0
  let percapitasZeradas = 0
  let casosEspeciaisPreservados = 0
  let casosEspeciaisSobrescritos = 0
  const updatesPendentes: Array<{ id: string; quantidade_gramas: number }> = []
  const insertsPendentes: Array<{ ingrediente_id: string; fase_escolar: string; quantidade_gramas: number; auto_calculado: boolean }> = []
  const exemplos: Array<{ preparacao: string; alimento: string; caso: string }> = []

  for (const ing of ingredientesAcucar) {
    const percapitaBercario = ing.percapitas.find(p => p.fase_escolar === 'BERCARIO')
    const percapitaCreche = ing.percapitas.find(p => p.fase_escolar === 'CRECHE')

    // CASO 1: berçário sem percapita (cai no fallback automático de 40%) — criar com 0
    if (!percapitaBercario) {
      insertsPendentes.push({
        ingrediente_id: ing.id,
        fase_escolar: 'BERCARIO',
        quantidade_gramas: 0,
        auto_calculado: false,  // false = override manual, não recalcular
      })
      percapitasCriadas++
      if (exemplos.length < 8) exemplos.push({ preparacao: ing.preparacao.nome, alimento: ing.alimento.nome, caso: 'BERCARIO sem percapita → criar=0' })
    }
    // CASO 2: berçário com percapita > 0 — sobrescrever para 0 (a menos que --force)
    else if (percapitaBercario.quantidade_gramas > 0) {
      if (FORCAR) {
        updatesPendentes.push({ id: percapitaBercario.id, quantidade_gramas: 0 })
        percapitasZeradas++
        casosEspeciaisSobrescritos++
        if (exemplos.length < 8) exemplos.push({ preparacao: ing.preparacao.nome, alimento: ing.alimento.nome, caso: `BERCARIO=${percapitaBercario.quantidade_gramas}g → 0 (--force)` })
      } else {
        casosEspeciaisPreservados++
        if (exemplos.length < 12) exemplos.push({ preparacao: ing.preparacao.nome, alimento: ing.alimento.nome, caso: `BERCARIO=${percapitaBercario.quantidade_gramas}g preservado (use --force para sobrescrever)` })
      }
    }

    // CASO 3: creche sem percapita — criar com 0
    if (!percapitaCreche) {
      insertsPendentes.push({
        ingrediente_id: ing.id,
        fase_escolar: 'CRECHE',
        quantidade_gramas: 0,
        auto_calculado: false,
      })
      percapitasCriadas++
    }
    // CASO 4: creche com percapita > 0 — sobrescrever para 0 (a menos que --force)
    else if (percapitaCreche.quantidade_gramas > 0) {
      if (FORCAR) {
        updatesPendentes.push({ id: percapitaCreche.id, quantidade_gramas: 0 })
        percapitasZeradas++
        casosEspeciaisSobrescritos++
      } else {
        casosEspeciaisPreservados++
      }
    }
  }

  // Mostra exemplos
  console.log('📍 Exemplos de mudanças:')
  for (const ex of exemplos) {
    console.log(`  • ${ex.preparacao} (${ex.alimento})`)
    console.log(`    → ${ex.caso}`)
  }

  console.log('\n' + '═'.repeat(70))
  console.log('📋 RELATÓRIO FINAL')
  console.log('═'.repeat(70))
  console.log(`Ingredientes analisados:           ${ingredientesAcucar.length}`)
  console.log(`Percapitas BERCARIO/CRECHE a criar (null → 0):  ${percapitasCriadas}`)
  console.log(`Percapitas BERCARIO/CRECHE a zerar (>0 → 0):    ${percapitasZeradas}`)
  console.log(`Casos especiais preservados (>0 sem --force):   ${casosEspeciaisPreservados}`)
  console.log(`Casos especiais sobrescritos (com --force):     ${casosEspeciaisSobrescritos}`)
  console.log(`Total de INSERTs pendentes:        ${insertsPendentes.length}`)
  console.log(`Total de UPDATEs pendentes:        ${updatesPendentes.length}`)

  // Aplica em batch
  if (MODO_APLICAR && (insertsPendentes.length > 0 || updatesPendentes.length > 0)) {
    console.log(`\n🔄 Aplicando alterações em batch...`)

    // INSERTs (criar percapitas que não existem)
    if (insertsPendentes.length > 0) {
      console.log(`  → Criando ${insertsPendentes.length} percapitas BERCARIO/CRECHE com quantidade=0...`)
      const batchSize = 100
      let applied = 0
      for (let i = 0; i < insertsPendentes.length; i += batchSize) {
        const batch = insertsPendentes.slice(i, i + batchSize)
        await prisma.$transaction(
          batch.map(p => prisma.preparacaoPercapita.create({
            data: {
              ingrediente_id: p.ingrediente_id,
              fase_escolar: p.fase_escolar,
              quantidade_gramas: p.quantidade_gramas,
              auto_calculado: p.auto_calculado,
            },
          })),
          { timeout: 60000, maxWait: 10000 }
        )
        applied += batch.length
        console.log(`     ✓ ${applied}/${insertsPendentes.length} criadas`)
      }
    }

    // UPDATEs (zerar percapitas existentes)
    if (updatesPendentes.length > 0) {
      console.log(`  → Zerando ${updatesPendentes.length} percapitas BERCARIO/CRECHE existentes...`)
      const batchSize = 100
      let applied = 0
      for (let i = 0; i < updatesPendentes.length; i += batchSize) {
        const batch = updatesPendentes.slice(i, i + batchSize)
        await prisma.$transaction(
          batch.map(u => prisma.preparacaoPercapita.update({
            where: { id: u.id },
            data: { quantidade_gramas: u.quantidade_gramas, auto_calculado: false },
          })),
          { timeout: 60000, maxWait: 10000 }
        )
        applied += batch.length
        console.log(`     ✓ ${applied}/${updatesPendentes.length} zeradas`)
      }
    }

    console.log('✅ Alterações aplicadas com sucesso.')
  } else if (MODO_APLICAR) {
    console.log('\nℹ️  Nenhuma alteração para aplicar.')
  } else {
    console.log(`\n👁️  DRY-RUN. Para aplicar de fato, rode com --apply`)
    if (casosEspeciaisPreservados > 0) {
      console.log(`⚠️  ${casosEspeciaisPreservados} caso(s) especial(is) preservado(s). Use --apply --force para sobrescrever.`)
    }
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
