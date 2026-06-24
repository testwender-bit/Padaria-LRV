// ============================================================
// scripts/fix-arroz-fantasma.ts  (v2 — BULK OPERATIONS)
// ============================================================
// Corrige o bug da preparação "Arroz Branco" fantasma nos cardápios.
//
// ⚠️ v2 — Correção do erro P2028 "Transaction not found":
//   A v1 usava um loop `for` com 1 query por item (168 queries para
//   o caso do arroz). Com o Supabase pooler (pgbouncer, connection_limit=1),
//   a transação excedia o timeout de 30s e era fechada → P2028.
//
//   A v2 usa operações SQL BULK: ~6 queries totais para qualquer quantidade
//   de itens (168 ou 168.000), rodando em <1s.
//
// CONTEXTO:
//   - Existe "Arroz branco" (ativo=true, ingredientes corretos) — A CERTA
//   - Existe "Arroz Branco" (ativo=false OU com "arroz integral") — A FANTASMA
//   - Vários CardapioItem apontam para o ID do fantasma
//   - Fantasma aparece nos cardápios mas não conta kcal
//
// O QUE O SCRIPT FAZ (em uma única transação atômica):
//   1. BULK MERGE  — UPDATE porções do correto += porções do fantasma
//                    onde ambos coexistem no mesmo slot (dia+refeição)
//   2. BULK DELETE — DELETE itens do fantasma que foram merged
//   3. BULK UPDATE — UPDATE preparacao_id fantasma→correto nos itens restantes
//   4. UPDATE vezes_usada do correto (incrementa merges+updates)
//   5. DELETE SobrescritaCardapio + PreparacaoSubstituicao que referenciam fantasma
//   6. Sanity check: COUNT CardapioItem com fantasma_id = 0
//   7. Hard-DELETE do fantasma (cascade em PreparacaoIngrediente + PreparacaoPercapita)
//
// USO:
//   npx tsx scripts/fix-arroz-fantasma.ts            # DRY-RUN (não modifica nada)
//   npx tsx scripts/fix-arroz-fantasma.ts --apply    # APLICA a correção
//
// FLAGS OPCIONAIS (caso a auto-detecção falhe):
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
  const candidatas = await prisma.preparacao.findMany({
    where: {
      OR: [
        { nome: { contains: 'arroz', mode: 'insensitive' } },
        { nome: { contains: 'Arroz', mode: 'insensitive' } },
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

  const arrozBranco = candidatas.filter((p) => normalize(p.nome) === 'arroz branco')

  if (arrozBranco.length < 2) {
    console.log('\n⚠️  Apenas UMA preparação "Arroz branco" encontrada. Não há duplicata.')
    console.log('   Se mesmo assim quiser forçar, use --fantasma-id=XXX --correto-id=YYY\n')
    return null
  }

  if (arrozBranco.length > 2) {
    console.log(`\n⚠️  ${arrozBranco.length} preparações com nome "Arroz branco" encontradas. Ambiguidade.`)
    console.log('   Use --fantasma-id=XXX --correto-id=YYY para forçar.\n')
    for (const p of arrozBranco) {
      console.log(`   • id=${p.id}  ativo=${p.ativo}  ingredientes=${p.ingredientes.length}  usos=${p._count.cardapio_itens}`)
    }
    return null
  }

  const [a, b] = arrozBranco

  function score(p: typeof a): number {
    let s = 0
    if (!p.ativo) s += 100
    const temIntegral = p.ingredientes.some((i) =>
      normalize(i.alimento.nome).includes('arroz integral')
    )
    if (temIntegral) s += 50
    s -= p.ingredientes.length
    return s
  }

  const sa = score(a)
  const sb = score(b)
  const fantasma = sa > sb ? a : b
  const correto = sa > sb ? b : a

  return { fantasma, correto }
}

async function main() {
  console.log('\n' + '═'.repeat(80))
  console.log('🍚 FIX ARROZ FANTASMA  (v2 — BULK OPERATIONS)')
  console.log(`   MODO: ${APLICAR ? '⛔ APLICANDO (write)' : '👀 DRY-RUN (somente leitura)'}`)
  console.log('═'.repeat(80) + '\n')

  // ── 1) Detectar par fantasma/correto ──
  let fantasmaId = fantasmaIdArg
  let corretoId = corretoIdArg

  if (!fantasmaId || !corretoId) {
    console.log('🔍 Auto-detectando par fantasma/correto...\n')
    const par = await detectarPar()
    if (!par) {
      console.log('❌ Não foi possível auto-detectar. Abortando.')
      console.log('   Dica: rode `npx tsx scripts/diagnostic-preparacoes-fantasma.ts` para ver os IDs.')
      return
    }
    if (!fantasmaId) fantasmaId = par.fantasma.id
    if (!corretoId) corretoId = par.correto.id

    console.log(`   Fantasma: "${par.fantasma.nome}" (id: ${par.fantasma.id})`)
    console.log(`     ativo=${par.fantasma.ativo}  ingredientes=${par.fantasma.ingredientes.length}`)
    console.log(`     ingredientes: ${par.fantasma.ingredientes.map((i) => i.alimento.nome).join(', ') || '(nenhum)'}`)
    console.log(`     usos em cardápios: ${par.fantasma._count.cardapio_itens}`)
    console.log()
    console.log(`   Correto:  "${par.correto.nome}" (id: ${par.correto.id})`)
    console.log(`     ativo=${par.correto.ativo}  ingredientes=${par.correto.ingredientes.length}`)
    console.log(`     ingredientes: ${par.correto.ingredientes.map((i) => i.alimento.nome).join(', ')}`)
    console.log(`     usos em cardápios: ${par.correto._count.cardapio_itens}`)
    console.log()
  } else {
    console.log(`   Fantasma ID (forçado): ${fantasmaId}`)
    console.log(`   Correto  ID (forçado): ${corretoId}\n`)
  }

  if (fantasmaId === corretoId) {
    console.log('❌ IDs iguais — abortando.')
    return
  }

  // ── 2) DRY-RUN: contagens BULK ──
  // Conta quantos itens do fantasma têm match com o correto (MERGE)
  // e quantos não têm (UPDATE) — usando SQL EXISTS em vez de loop.
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

  // ── 3) Preview (top 20 de cada tipo, para inspeção) ──
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

  // Para cada item do preview, determinar se é MERGE ou UPDATE
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

  // ── 4) Contagem de outras referências (para limpeza) ──
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
    if (sobrescritasCount > 0) console.log(`  • ${sobrescritasCount} SobrescritaCardapio (fantasma como substituta)`)
    if (substOrigemCount > 0) console.log(`  • ${substOrigemCount} PreparacaoSubstituicao (fantasma como origem)`)
    if (substDestinoCount > 0) console.log(`  • ${substDestinoCount} PreparacaoSubstituicao (fantasma como destino)`)
    console.log()
  }

  if (!APLICAR) {
    console.log('═'.repeat(80))
    console.log('👀 DRY-RUN concluído — nada foi modificado.')
    console.log('   Para aplicar: npx tsx scripts/fix-arroz-fantasma.ts --apply')
    console.log('═'.repeat(80) + '\n')
    return
  }

  // ── 5) APLICAR — TUDO EM BULK, EM UMA TRANSAÇÃO ──
  console.log('═'.repeat(80))
  console.log('⛔ APLICANDO CORREÇÃO (BULK OPERATIONS)...')
  console.log('═'.repeat(80) + '\n')

  const resultado = await prisma.$transaction(
    async (tx) => {
      // ── 5a) BULK MERGE ──
      // Soma porções do fantasma no correto onde ambos coexistem no mesmo slot.
      // PostgreSQL: UPDATE ... FROM com JOIN.
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

      // ── 5b) BULK DELETE ──
      // Deleta os itens do fantasma que foram merged (têm correto no mesmo slot).
      const deletedMergedRows = await tx.$executeRaw`
        DELETE FROM "CardapioItem"
        WHERE preparacao_id = ${fantasmaId}
          AND EXISTS (
            SELECT 1 FROM "CardapioItem" c2
            WHERE c2.preparacao_id = ${corretoId}
              AND c2.dia_id = "CardapioItem".dia_id
              AND c2.tipo_refeicao_id = "CardapioItem".tipo_refeicao_id
          )
      `
      console.log(`   ✓ DELETE merged: ${deletedMergedRows} item(s) do fantasma removidos`)

      // ── 5c) BULK UPDATE ──
      // Troca preparacao_id dos itens restantes (não-merged) do fantasma para o correto.
      const updatesResult = await tx.cardapioItem.updateMany({
        where: { preparacao_id: fantasmaId },
        data: { preparacao_id: corretoId },
      })
      console.log(`   ✓ UPDATE: ${updatesResult.count} item(s) tiveram preparacao_id trocado`)

      // ── 5d) Incrementar vezes_usada no correto ──
      const totalUsosTransferidos = deletedMergedRows + updatesResult.count
      if (totalUsosTransferidos > 0) {
        await tx.preparacao.update({
          where: { id: corretoId },
          data: { vezes_usada: { increment: totalUsosTransferidos } },
        })
        console.log(`   ✓ vezes_usada do correto incrementada: +${totalUsosTransferidos}`)
      }

      // ── 5e) Limpeza: SobrescritaCardapio ──
      const sobrescritasDel = await tx.sobrescritaCardapio.deleteMany({
        where: { preparacao_substituta_id: fantasmaId },
      })
      if (sobrescritasDel.count > 0) {
        console.log(`   ✓ SobrescritaCardapio: ${sobrescritasDel.count} removida(s)`)
      }

      // ── 5f) Limpeza: PreparacaoSubstituicao ──
      const substDel = await tx.preparacaoSubstituicao.deleteMany({
        where: {
          OR: [
            { preparacao_origem_id: fantasmaId },
            { preparacao_destino_id: fantasmaId },
          ],
        },
      })
      if (substDel.count > 0) {
        console.log(`   ✓ PreparacaoSubstituicao: ${substDel.count} removida(s)`)
      }

      // ── 5g) Sanity check final ──
      const restantes = await tx.cardapioItem.count({
        where: { preparacao_id: fantasmaId },
      })
      if (restantes > 0) {
        throw new Error(
          `Ainda existem ${restantes} CardapioItem referenciando o fantasma. Abortando hard-delete.`
        )
      }
      console.log(`   ✓ Sanity check: 0 itens restantes referenciando o fantasma`)

      // ── 5h) Hard-delete do fantasma ──
      // Cascade automático em PreparacaoIngrediente e PreparacaoPercapita.
      await tx.preparacao.delete({ where: { id: fantasmaId } })
      console.log(`   ✓ Hard-delete do fantasma: OK`)

      return {
        mergesOk: deletedMergedRows,
        updatesOk: updatesResult.count,
        sobrescritasRemovidas: sobrescritasDel.count,
        substituicoesRemovidas: substDel.count,
        totalUsosTransferidos,
      }
    },
    { timeout: 30000 }
  )

  console.log('\n' + '═'.repeat(80))
  console.log('✅ CORREÇÃO APLICADA COM SUCESSO!')
  console.log('═'.repeat(80))
  console.log(`   Merges (soma + delete): ${resultado.mergesOk}`)
  console.log(`   Updates (troca prep_id): ${resultado.updatesOk}`)
  console.log(`   Sobrescritas removidas: ${resultado.sobrescritasRemovidas}`)
  console.log(`   Substituições removidas: ${resultado.substituicoesRemovidas}`)
  console.log(`   vezes_usada incrementada no correto: +${resultado.totalUsosTransferidos}`)
  console.log(`   Hard-delete do fantasma: OK`)
  console.log()
  console.log('═'.repeat(80))
  console.log('🎉 PRÓXIMOS PASSOS:')
  console.log('   1. Abra /nutricao/cardapios no navegador')
  console.log('   2. Abra um cardápio que tinha o fantasma')
  console.log('   3. Confirme que só aparece "Arroz branco" (o correto)')
  console.log('   4. Confirme que o kcal está sendo calculado')
  console.log('   5. Se tudo OK, commit no git')
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
