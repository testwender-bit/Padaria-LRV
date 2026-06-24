// ============================================================
// scripts/fix-carne-moida-fantasma.ts
// ============================================================
// Corrige o bug da preparação fantasma "Carne moída ao molho"
// substituindo pela preparação correta "Carne bovina moída em molho"
// em todos os cardápios.
//
// Mesma lógica do fix-arroz-fantasma.ts (v2 - bulk SQL operations):
//   1. BULK MERGE  — UPDATE porções do correto += porções do fantasma
//                    onde ambos coexistem no mesmo slot
//   2. BULK DELETE — DELETE itens do fantasma que foram merged
//   3. BULK UPDATE — UPDATE preparacao_id fantasma→correto nos restantes
//   4. UPDATE vezes_usada do correto
//   5. DELETE SobrescritaCardapio + PreparacaoSubstituicao
//   6. Hard-delete do fantasma
//
// USO:
//   npx tsx scripts/fix-carne-moida-fantasma.ts            # DRY-RUN
//   npx tsx scripts/fix-carne-moida-fantasma.ts --apply    # APLICA
//
// FLAGS OPCIONAIS:
//   --fantasma-id=xxxx   força o ID do fantasma
//   --correto-id=xxxx    força o ID do correto
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')
const fantasmaIdArg = process.argv.find((a) => a.startsWith('--fantasma-id='))?.split('=')[1]
const corretoIdArg = process.argv.find((a) => a.startsWith('--correto-id='))?.split('=')[1]

// ── Helpers ──
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

async function detectarPar() {
  // Busca todas as preparações cujo nome normalizado contém "carne" + "moida" + "molho"
  const candidatas = await prisma.preparacao.findMany({
    where: {
      AND: [
        { nome: { contains: 'carne', mode: 'insensitive' } },
        { nome: { contains: 'molho', mode: 'insensitive' } },
      ],
    },
    include: {
      ingredientes: {
        include: {
          alimento: { select: { nome: true, grupo: true } },
        },
      },
      _count: { select: { cardapio_itens: true } },
    },
  })

  // Filtra só as que têm "moída" (ou "moida") no nome
  const comMoida = candidatas.filter((p) => {
    const n = normalize(p.nome)
    return n.includes('moida') || n.includes('moída')
  })

  if (comMoida.length < 2) {
    console.log(`\n⚠️  Apenas ${comMoida.length} preparação(ões) "carne moída ao/em molho" encontrada(s).`)
    console.log('   Para forçar, use --fantasma-id=XXX --correto-id=YYY\n')
    for (const p of comMoida) {
      console.log(`   • id=${p.id}  nome="${p.nome}"  ativo=${p.ativo}  ingredientes=${p.ingredientes.length}  usos=${p._count.cardapio_itens}`)
    }
    return null
  }

  // Heurística: fantasma = "ao molho" (palavra "ao"), correto = "em molho" (palavra "em")
  // ou: fantasma = inativo/sem ingredientes, correto = ativo/com ingredientes
  function ehFantasma(p: typeof comMoida[0]): boolean {
    const n = normalize(p.nome)
    if (n.includes('ao molho')) return true
    if (n.includes('em molho')) return false
    // Fallback heurístico
    if (!p.ativo) return true
    if (p.ingredientes.length === 0) return true
    return false
  }

  const fantasmas = comMoida.filter(ehFantasma)
  const corretos = comMoida.filter((p) => !ehFantasma(p))

  if (fantasmas.length === 0) {
    console.log('\n⚠️  Nenhum fantasma "carne moída AO molho" encontrada. Mostrando todas:')
    for (const p of comMoida) {
      console.log(`   • id=${p.id}  nome="${p.nome}"  ativo=${p.ativo}  ingredientes=${p.ingredientes.length}  usos=${p._count.cardapio_itens}`)
    }
    return null
  }
  if (corretos.length === 0) {
    console.log('\n⚠️  Nenhum correto "carne bovina moída EM molho" encontrada. Mostrando todas:')
    for (const p of comMoida) {
      console.log(`   • id=${p.id}  nome="${p.nome}"  ativo=${p.ativo}  ingredientes=${p.ingredientes.length}  usos=${p._count.cardapio_itens}`)
    }
    return null
  }

  // Pega o primeiro de cada (ou o com mais usos se houver múltiplos)
  const fantasma = fantasmas.slice().sort((a, b) => b._count.cardapio_itens - a._count.cardapio_itens)[0]
  const correto = corretos.slice().sort((a, b) => b._count.cardapio_itens - a._count.cardapio_itens)[0]

  return { fantasma, correto }
}

async function main() {
  console.log('\n' + '═'.repeat(80))
  console.log('🥩 FIX CARNE MOÍDA AO MOLHO FANTASMA  (BULK OPERATIONS)')
  console.log(`   MODO: ${APLICAR ? '⛔ APLICANDO (write)' : '👀 DRY-RUN (somente leitura)'}`)
  console.log('═'.repeat(80) + '\n')

  let fantasmaId = fantasmaIdArg
  let corretoId = corretoIdArg

  if (!fantasmaId || !corretoId) {
    console.log('🔍 Auto-detectando par fantasma/correto...\n')
    const par = await detectarPar()
    if (!par) {
      console.log('❌ Não foi possível auto-detectar. Abortando.')
      console.log('   Dica: rode o SQL abaixo no Supabase para ver os IDs:')
      console.log('   SELECT id, nome, ativo FROM "Preparacao" WHERE LOWER(nome) LIKE \'%carne moída%\';')
      return
    }
    if (!fantasmaId) fantasmaId = par.fantasma.id
    if (!corretoId) corretoId = par.correto.id

    console.log(`   Fantasma: "${par.fantasma.nome}" (id: ${par.fantasma.id})`)
    console.log(`     ativo=${par.fantasma.ativo}  ingredientes=${par.fantasma.ingredientes.length}  usos=${par.fantasma._count.cardapio_itens}`)
    console.log(`     ingredientes: ${par.fantasma.ingredientes.map((i) => i.alimento.nome).join(', ') || '(nenhum)'}`)
    console.log()
    console.log(`   Correto:  "${par.correto.nome}" (id: ${par.correto.id})`)
    console.log(`     ativo=${par.correto.ativo}  ingredientes=${par.correto.ingredientes.length}  usos=${par.correto._count.cardapio_itens}`)
    console.log(`     ingredientes: ${par.correto.ingredientes.map((i) => i.alimento.nome).join(', ')}`)
    console.log()
  } else {
    console.log(`   Fantasma ID (forçado): ${fantasmaId}`)
    console.log(`   Correto  ID (forçado): ${corretoId}\n`)
  }

  if (fantasmaId === corretoId) {
    console.log('❌ IDs iguais — abortando.')
    return
  }

  // ── DRY-RUN: contagens BULK ──
  const mergeCountRows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM "CardapioItem" f
    WHERE f.preparacao_id = ${fantasmaId}
      AND EXISTS (
        SELECT 1 FROM "CardapioItem" c
        WHERE c.preparacao_id = ${corretoId}
          AND c.dia_id = f.dia_id
          AND c.tipo_refeicao_id = f.tipo_refeicao_id
      )
  `
  const mergesCount = Number(mergeCountRows[0]?.count ?? 0)

  const updateCountRows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM "CardapioItem" f
    WHERE f.preparacao_id = ${fantasmaId}
      AND NOT EXISTS (
        SELECT 1 FROM "CardapioItem" c
        WHERE c.preparacao_id = ${corretoId}
          AND c.dia_id = f.dia_id
          AND c.tipo_refeicao_id = f.tipo_refeicao_id
      )
  `
  const updatesCount = Number(updateCountRows[0]?.count ?? 0)

  // Preview top 20
  const itensPreview = await prisma.cardapioItem.findMany({
    where: { preparacao_id: fantasmaId },
    include: {
      dia: {
        include: {
          semana: {
            include: {
              cardapio: { select: { nome: true, escola: { select: { nome: true } } } },
            },
          },
        },
      },
      tipo_refeicao: { select: { nome: true } },
    },
    orderBy: [{ dia: { semana: { numero: 'asc' } } }, { dia: { dia_semana: 'asc' } }],
    take: 20,
  })

  const slotsComCorreto = new Set<string>()
  if (itensPreview.length > 0) {
    const diaIds = itensPreview.map((i) => i.dia_id)
    const tiposRefeicaoIds = itensPreview.map((i) => i.tipo_refeicao_id)
    const existentes = await prisma.cardapioItem.findMany({
      where: {
        preparacao_id: corretoId,
        dia_id: { in: diaIds },
        tipo_refeicao_id: { in: tiposRefeicaoIds },
      },
      select: { dia_id: true, tipo_refeicao_id: true },
    })
    for (const e of existentes) {
      slotsComCorreto.add(`${e.dia_id}|${e.tipo_refeicao_id}`)
    }
  }

  console.log('─'.repeat(80))
  console.log(`RESUMO (via SQL BULK COUNT):`)
  console.log(`  ${mergesCount} item(ns) → MERGE (soma porções no item do correto, deleta do fantasma)`)
  console.log(`  ${updatesCount} item(ns) → UPDATE (troca preparacao_id do fantasma → correto)`)
  console.log(`  Total de itens do fantasma: ${mergesCount + updatesCount}`)
  console.log('─'.repeat(80) + '\n')

  if (itensPreview.length > 0) {
    console.log(`PREVIEW (primeiros ${Math.min(20, itensPreview.length)} itens):`)
    for (const it of itensPreview) {
      const c = it.dia.semana.cardapio
      const slot = `${it.dia_id}|${it.tipo_refeicao_id}`
      const acao = slotsComCorreto.has(slot) ? 'MERGE' : 'UPDATE'
      console.log(
        `  [${acao}] "${c.nome}" (${c.escola?.nome || 'BASE'}) ` +
          `sem ${it.dia.semana.numero} ${it.dia.dia_semana} ` +
          `${it.tipo_refeicao.nome} — ${it.porcoes} porção(ões)`
      )
    }
    if (mergesCount + updatesCount > 20) {
      console.log(`  ... e mais ${(mergesCount + updatesCount) - 20} item(ns)`)
    }
    console.log()
  }

  // Contagem de outras referências (limpeza)
  const sobrescritasCount = await prisma.sobrescritaCardapio.count({
    where: { preparacao_substituta_id: fantasmaId },
  })
  const substOrigemCount = await prisma.preparacaoSubstituicao.count({
    where: { preparacao_origem_id: fantasmaId },
  })
  const substDestinoCount = await prisma.preparacaoSubstituicao.count({
    where: { preparacao_destino_id: fantasmaId },
  })

  if (sobrescritasCount + substOrigemCount + substDestinoCount > 0) {
    console.log('LIMPEZA ADICIONAL necessária:')
    if (sobrescritasCount > 0) console.log(`  • ${sobrescritasCount} SobrescritaCardapio`)
    if (substOrigemCount > 0) console.log(`  • ${substOrigemCount} PreparacaoSubstituicao (origem)`)
    if (substDestinoCount > 0) console.log(`  • ${substDestinoCount} PreparacaoSubstituicao (destino)`)
    console.log()
  }

  if (!APLICAR) {
    console.log('═'.repeat(80))
    console.log('👀 DRY-RUN concluído — nada foi modificado.')
    console.log('   Para aplicar: npx tsx scripts/fix-carne-moida-fantasma.ts --apply')
    console.log('═'.repeat(80) + '\n')
    return
  }

  // ── APLICAR — TUDO EM BULK, EM UMA TRANSAÇÃO ──
  console.log('═'.repeat(80))
  console.log('⛔ APLICANDO CORREÇÃO (BULK OPERATIONS)...')
  console.log('═'.repeat(80) + '\n')

  const resultado = await prisma.$transaction(
    async (tx) => {
      // 1) BULK MERGE
      if (mergesCount > 0) {
        const mergedRows = await tx.$executeRaw`
          UPDATE "CardapioItem" AS correto
          SET porcoes = correto.porcoes + fantasma.porcoes
          FROM "CardapioItem" AS fantasma
          WHERE fantasma.preparacao_id = ${fantasmaId}
            AND correto.preparacao_id = ${corretoId}
            AND fantasma.dia_id = correto.dia_id
            AND fantasma.tipo_refeicao_id = correto.tipo_refeicao_id
        `
        console.log(`   ✓ MERGE: ${mergedRows} item(s) do correto tiveram porções somadas`)

        // 2) BULK DELETE merged
        const deletedRows = await tx.$executeRaw`
          DELETE FROM "CardapioItem"
          WHERE preparacao_id = ${fantasmaId}
            AND EXISTS (
              SELECT 1 FROM "CardapioItem" c2
              WHERE c2.preparacao_id = ${corretoId}
                AND c2.dia_id = "CardapioItem".dia_id
                AND c2.tipo_refeicao_id = "CardapioItem".tipo_refeicao_id
            )
        `
        console.log(`   ✓ DELETE merged: ${deletedRows} item(s) do fantasma removidos`)
      }

      // 3) BULK UPDATE
      const updatesResult = await tx.cardapioItem.updateMany({
        where: { preparacao_id: fantasmaId },
        data: { preparacao_id: corretoId },
      })
      console.log(`   ✓ UPDATE: ${updatesResult.count} item(s) tiveram preparacao_id trocado`)

      // 4) Incrementar vezes_usada no correto
      const totalUsosTransferidos = mergesCount + updatesResult.count
      if (totalUsosTransferidos > 0) {
        await tx.preparacao.update({
          where: { id: corretoId },
          data: { vezes_usada: { increment: totalUsosTransferidos } },
        })
        console.log(`   ✓ vezes_usada do correto incrementada: +${totalUsosTransferidos}`)
      }

      // 5) Limpeza SobrescritaCardapio
      if (sobrescritasCount > 0) {
        const sobrescritasDel = await tx.sobrescritaCardapio.deleteMany({
          where: { preparacao_substituta_id: fantasmaId },
        })
        console.log(`   ✓ SobrescritaCardapio: ${sobrescritasDel.count} removida(s)`)
      }

      // 6) Limpeza PreparacaoSubstituicao
      if (substOrigemCount + substDestinoCount > 0) {
        const substDel = await tx.preparacaoSubstituicao.deleteMany({
          where: {
            OR: [
              { preparacao_origem_id: fantasmaId },
              { preparacao_destino_id: fantasmaId },
            ],
          },
        })
        console.log(`   ✓ PreparacaoSubstituicao: ${substDel.count} removida(s)`)
      }

      // 7) Sanity check
      const restantes = await tx.cardapioItem.count({
        where: { preparacao_id: fantasmaId },
      })
      if (restantes > 0) {
        throw new Error(
          `Ainda existem ${restantes} CardapioItem referenciando o fantasma. Abortando hard-delete.`
        )
      }
      console.log(`   ✓ Sanity check: 0 itens restantes referenciando o fantasma`)

      // 8) Hard-delete do fantasma
      await tx.preparacao.delete({ where: { id: fantasmaId } })
      console.log(`   ✓ Hard-delete do fantasma: OK`)

      return {
        mergesOk: mergesCount,
        updatesOk: updatesResult.count,
        totalUsosTransferidos,
      }
    },
    { timeout: 30000 }
  )

  console.log('\n' + '═'.repeat(80))
  console.log('✅ CORREÇÃO APLICADA COM SUCESSO!')
  console.log('═'.repeat(80))
  console.log(`   Merges: ${resultado.mergesOk}`)
  console.log(`   Updates: ${resultado.updatesOk}`)
  console.log(`   vezes_usada incrementada no correto: +${resultado.totalUsosTransferidos}`)
  console.log(`   Hard-delete do fantasma: OK`)
  console.log()
  console.log('═'.repeat(80))
  console.log('🎉 PRÓXIMOS PASSOS:')
  console.log('   1. Abra /nutricao/cardapios no navegador')
  console.log('   2. Abra um cardápio que tinha "Carne moída ao molho"')
  console.log('   3. Confirme que só aparece "Carne bovina moída em molho"')
  console.log('   4. Confirme que o kcal está sendo calculado')
  console.log('═'.repeat(80) + '\n')
}

main()
  .catch((e) => {
    console.error('\n❌ Erro:', e)
    console.error('\nNenhuma mudança foi aplicada (rollback automático).')
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
