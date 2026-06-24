// ============================================================
// scripts/fix-paes-fantasma.ts
// ============================================================
// Corrige TODOS os pães fantasma do banco.
//
// REGRA (acordada com o usuário):
//   - FANTASMA  = "Pão X" sem especificar "francês" ou "QC"
//   - CORRETO   = "Pão francês X" (mesma terminação X)
//   - QC        = "Pão QC X" é produto DIFERENTE, NÃO tocar
//
// O QUE O SCRIPT FAZ:
//   1. Auto-detecta todos os pares (fantasma, correto) — mesma lógica do diagnóstico
//   2. Para cada par, processa em BULK (v2-style, sem loop 1-by-1):
//      a. MERGE: soma porções do fantasma no correto onde ambos coexistem no mesmo slot
//      b. DELETE merged: remove itens do fantasma que foram merged
//      c. UPDATE: troca preparacao_id dos itens restantes do fantasma → correto
//      d. Incrementa vezes_usada do correto
//      e. Remove SobrescritaCardapio e PreparacaoSubstituicao que referenciam o fantasma
//   3. Hard-delete de TODOS os fantasmas processados (depois de sanity check)
//
// TRANSAÇÃO ÚNICA ATÔMICA: se qualquer par falhar, rollback total.
//
// USO:
//   npx tsx scripts/fix-paes-fantasma.ts            # DRY-RUN (não modifica)
//   npx tsx scripts/fix-paes-fantasma.ts --apply    # APLICA correção
//
// FLAGS OPCIONAIS:
//   --skip=ID1,ID2   pula fantasmas específicos (não processa, não deleta)
//                    útil se você quer revisar um par antes
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')
const skipArg = process.argv.find((a) => a.startsWith('--skip='))?.split('=')[1]
const skipIds = skipArg
  ? skipArg.split(',').map((s) => s.trim()).filter(Boolean)
  : []

// ── Helpers ──
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function temFrances(nomeNorm: string): boolean {
  return (
    nomeNorm.includes('frances') ||
    nomeNorm.includes('francez') ||
    /^pao\s+franc/.test(nomeNorm)
  )
}

function temQC(nomeNorm: string): boolean {
  return (
    nomeNorm.includes('qc') ||
    nomeNorm.includes('cachorro') ||
    nomeNorm.includes('hot dog') ||
    nomeNorm.includes('hotdog')
  )
}

function extrairTerminacao(nomeNorm: string): string {
  return nomeNorm
    .replace(/^pao\s+frances\s+/, '')
    .replace(/^pao\s+francez\s+/, '')
    .replace(/^pao\s+franc\s+/, '')
    .replace(/^pao\s+qc\s+/, '')
    .replace(/^pao\s+cachorro\s*-?\s*quente\s+/, '')
    .replace(/^pao\s+/, '')
    .trim()
}

interface Par {
  fantasma: {
    id: string
    nome: string
    ativo: boolean
    numIngredientes: number
    numUsos: number
  }
  correto: {
    id: string
    nome: string
    ativo: boolean
    numIngredientes: number
    numUsos: number
  }
  terminacao: string
}

async function detectarPares(): Promise<{ pares: Par[]; semPar: { id: string; nome: string; numUsos: number }[] }> {
  const todas = await prisma.preparacao.findMany({
    where: {
      OR: [
        { nome: { contains: 'pão', mode: 'insensitive' } },
        { nome: { contains: 'pao', mode: 'insensitive' } },
        { nome: { contains: 'Pão', mode: 'insensitive' } },
        { nome: { contains: 'Pao', mode: 'insensitive' } },
      ],
    },
    include: {
      ingredientes: { select: { id: true } },
      _count: { select: { cardapio_itens: true } },
    },
    orderBy: { nome: 'asc' },
  })

  const fantasmas: Par['fantasma'][] = []
  const frances: Par['correto'][] = []

  for (const p of todas) {
    const nomeNorm = normalize(p.nome)
    const base = {
      id: p.id,
      nome: p.nome,
      ativo: p.ativo,
      numIngredientes: p.ingredientes.length,
      numUsos: p._count.cardapio_itens,
    }

    if (temFrances(nomeNorm)) {
      frances.push(base)
    } else if (temQC(nomeNorm)) {
      // QC = produto diferente, não tocar
      continue
    } else if (/^pao\b/.test(nomeNorm)) {
      // Só é fantasma se tiver usos em cardápios OU estiver inativo
      // (se não tem usos e está ativo, é só uma preparação sem uso, não é "fantasma" no sentido de bug)
      if (base.numUsos > 0 || !base.ativo) {
        fantasmas.push(base)
      }
    }
  }

  // Indexar frances por terminacao
  const francesPorTerminacao = new Map<string, Par['correto'][]>()
  for (const f of frances) {
    const t = extrairTerminacao(normalize(f.nome))
    if (!francesPorTerminacao.has(t)) francesPorTerminacao.set(t, [])
    francesPorTerminacao.get(t)!.push(f)
  }

  const pares: Par[] = []
  const semPar: { id: string; nome: string; numUsos: number }[] = []

  for (const fantasma of fantasmas) {
    if (skipIds.includes(fantasma.id)) {
      console.log(`   ⏭️  Pulando "${fantasma.nome}" (id=${fantasma.id}) por --skip`)
      continue
    }

    const terminacao = extrairTerminacao(normalize(fantasma.nome))
    const candidatos = francesPorTerminacao.get(terminacao) || []

    if (candidatos.length === 0) {
      semPar.push({ id: fantasma.id, nome: fantasma.nome, numUsos: fantasma.numUsos })
      continue
    }

    // Escolher o melhor candidato (ativo > mais ingredientes > mais usos)
    const melhor = candidatos.slice().sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1
      if (a.numIngredientes !== b.numIngredientes) {
        return b.numIngredientes - a.numIngredientes
      }
      return b.numUsos - a.numUsos
    })[0]

    pares.push({ fantasma, correto: melhor, terminacao })
  }

  return { pares, semPar }
}

async function main() {
  console.log('\n' + '═'.repeat(80))
  console.log('🍞 FIX PÃES FANTASMA  (BULK OPERATIONS)')
  console.log(`   MODO: ${APLICAR ? '⛔ APLICANDO (write)' : '👀 DRY-RUN (somente leitura)'}`)
  if (skipIds.length > 0) {
    console.log(`   SKIP IDs: ${skipIds.join(', ')}`)
  }
  console.log('═'.repeat(80) + '\n')

  // ── 1) Detectar pares ──
  console.log('🔍 Auto-detectando pares (fantasma → "Pão francês X")...\n')
  const { pares, semPar } = await detectarPares()

  if (pares.length === 0) {
    console.log('ℹ️  Nenhum par válido encontrado.')
    if (semPar.length > 0) {
      console.log(`\n⚠️  ${semPar.length} fantasma(s) sem "Pão francês" correspondente:`)
      for (const f of semPar) {
        console.log(`   • "${f.nome}" (id=${f.id}, ${f.numUsos} usos)`)
      }
    }
    return
  }

  // ── 2) Mostrar pares encontrados ──
  console.log(`✅ ${pares.length} par(es) válido(s) encontrado(s):\n`)
  for (const par of pares) {
    console.log(
      `   • FANTASMA: "${par.fantasma.nome}" (id=${par.fantasma.id})\n` +
        `     ativo=${par.fantasma.ativo}  ingredientes=${par.fantasma.numIngredientes}  usos=${par.fantasma.numUsos}\n` +
        `     ↳ CORRETO: "${par.correto.nome}" (id=${par.correto.id})\n` +
        `       ativo=${par.correto.ativo}  ingredientes=${par.correto.numIngredientes}  usos=${par.correto.numUsos}\n` +
        `     terminação casada: "${par.terminacao}"\n`
    )
  }

  if (semPar.length > 0) {
    console.log('─'.repeat(80))
    console.log(`⚠️  ${semPar.length} fantasma(s) SEM par (serão ignorados — atenção manual):`)
    for (const f of semPar) {
      console.log(`   • "${f.nome}" (id=${f.id}, ${f.numUsos} usos)`)
    }
    console.log('─'.repeat(80) + '\n')
  }

  // ── 3) DRY-RUN: contagens BULK por par ──
  console.log('─'.repeat(80))
  console.log('📊 CONTAGEM BULK POR PAR (SQL EXISTS):')
  console.log('─'.repeat(80))

  let totalMerges = 0
  let totalUpdates = 0
  const detalhes: {
    par: Par
    merges: number
    updates: number
    sobrescritas: number
    substituicoes: number
  }[] = []

  for (const par of pares) {
    // MERGE = itens do fantasma que têm correto no mesmo slot
    const mergeRows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM "CardapioItem" f
      WHERE f.preparacao_id = ${par.fantasma.id}
        AND EXISTS (
          SELECT 1 FROM "CardapioItem" c
          WHERE c.preparacao_id = ${par.correto.id}
            AND c.dia_id = f.dia_id
            AND c.tipo_refeicao_id = f.tipo_refeicao_id
        )
    `
    const merges = Number(mergeRows[0]?.count ?? 0)

    // UPDATE = itens do fantasma SEM correto no mesmo slot
    const updateRows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM "CardapioItem" f
      WHERE f.preparacao_id = ${par.fantasma.id}
        AND NOT EXISTS (
          SELECT 1 FROM "CardapioItem" c
          WHERE c.preparacao_id = ${par.correto.id}
            AND c.dia_id = f.dia_id
            AND c.tipo_refeicao_id = f.tipo_refeicao_id
        )
    `
    const updates = Number(updateRows[0]?.count ?? 0)

    const sobrescritas = await prisma.sobrescritaCardapio.count({
      where: { preparacao_substituta_id: par.fantasma.id },
    })
    const substOrigem = await prisma.preparacaoSubstituicao.count({
      where: { preparacao_origem_id: par.fantasma.id },
    })
    const substDestino = await prisma.preparacaoSubstituicao.count({
      where: { preparacao_destino_id: par.fantasma.id },
    })

    totalMerges += merges
    totalUpdates += updates
    detalhes.push({
      par,
      merges,
      updates,
      sobrescritas,
      substituicoes: substOrigem + substDestino,
    })

    console.log(
      `   ${par.fantasma.nome} → ${par.correto.nome}\n` +
        `     ${merges} merge(s) + ${updates} update(s) = ${merges + updates} itens` +
        (sobrescritas + substOrigem + substDestino > 0
          ? `  + ${sobrescritas} sobrescrita(s) + ${substOrigem + substDestino} substituição(ões) para limpar`
          : '')
    )
  }

  console.log('\n' + '─'.repeat(80))
  console.log(`TOTAL: ${totalMerges} merge(s) + ${totalUpdates} update(s) = ${totalMerges + totalUpdates} itens`)
  console.log(`       ${pares.length} fantasma(s) serão hard-deletados`)
  console.log('─'.repeat(80) + '\n')

  if (!APLICAR) {
    console.log('═'.repeat(80))
    console.log('👀 DRY-RUN concluído — nada foi modificado.')
    console.log('   Para aplicar: npx tsx scripts/fix-paes-fantasma.ts --apply')
    console.log('═'.repeat(80) + '\n')
    return
  }

  // ── 4) APLICAR — TUDO EM UMA TRANSAÇÃO ATÔMICA ──
  console.log('═'.repeat(80))
  console.log('⛔ APLICANDO CORREÇÃO (BULK OPERATIONS, TRANSAÇÃO ÚNICA)...')
  console.log('═'.repeat(80) + '\n')

  const resultado = await prisma.$transaction(
    async (tx) => {
      const resultados = []

      for (const d of detalhes) {
        const { par, merges, updates } = d
        console.log(`\n   🔄 Processando: "${par.fantasma.nome}" → "${par.correto.nome}"`)

        // ── 4a) BULK MERGE ──
        if (merges > 0) {
          const mergedRows = await tx.$executeRaw`
            UPDATE "CardapioItem" AS correto
            SET porcoes = correto.porcoes + fantasma.porcoes
            FROM "CardapioItem" AS fantasma
            WHERE fantasma.preparacao_id = ${par.fantasma.id}
              AND correto.preparacao_id = ${par.correto.id}
              AND fantasma.dia_id = correto.dia_id
              AND fantasma.tipo_refeicao_id = correto.tipo_refeicao_id
          `
          console.log(`      ✓ MERGE: ${mergedRows} item(s) do correto tiveram porções somadas`)

          // ── 4b) BULK DELETE merged ──
          const deletedRows = await tx.$executeRaw`
            DELETE FROM "CardapioItem"
            WHERE preparacao_id = ${par.fantasma.id}
              AND EXISTS (
                SELECT 1 FROM "CardapioItem" c2
                WHERE c2.preparacao_id = ${par.correto.id}
                  AND c2.dia_id = "CardapioItem".dia_id
                  AND c2.tipo_refeicao_id = "CardapioItem".tipo_refeicao_id
              )
          `
          console.log(`      ✓ DELETE merged: ${deletedRows} item(s) do fantasma removidos`)
        }

        // ── 4c) BULK UPDATE ──
        if (updates > 0) {
          const updResult = await tx.cardapioItem.updateMany({
            where: { preparacao_id: par.fantasma.id },
            data: { preparacao_id: par.correto.id },
          })
          console.log(`      ✓ UPDATE: ${updResult.count} item(s) tiveram preparacao_id trocado`)
        }

        // ── 4d) Incrementar vezes_usada no correto ──
        const totalTransferido = merges + updates
        if (totalTransferido > 0) {
          await tx.preparacao.update({
            where: { id: par.correto.id },
            data: { vezes_usada: { increment: totalTransferido } },
          })
          console.log(`      ✓ vezes_usada do correto incrementada: +${totalTransferido}`)
        }

        // ── 4e) Limpeza: SobrescritaCardapio ──
        if (d.sobrescritas > 0) {
          const sobDel = await tx.sobrescritaCardapio.deleteMany({
            where: { preparacao_substituta_id: par.fantasma.id },
          })
          console.log(`      ✓ SobrescritaCardapio: ${sobDel.count} removida(s)`)
        }

        // ── 4f) Limpeza: PreparacaoSubstituicao ──
        if (d.substituicoes > 0) {
          const substDel = await tx.preparacaoSubstituicao.deleteMany({
            where: {
              OR: [
                { preparacao_origem_id: par.fantasma.id },
                { preparacao_destino_id: par.fantasma.id },
              ],
            },
          })
          console.log(`      ✓ PreparacaoSubstituicao: ${substDel.count} removida(s)`)
        }

        // ── 4g) Sanity check: nenhum CardapioItem restante ──
        const restantes = await tx.cardapioItem.count({
          where: { preparacao_id: par.fantasma.id },
        })
        if (restantes > 0) {
          throw new Error(
            `Ainda existem ${restantes} CardapioItem referenciando "${par.fantasma.nome}" (id=${par.fantasma.id}). Abortando.`
          )
        }

        // ── 4h) Hard-delete do fantasma ──
        await tx.preparacao.delete({ where: { id: par.fantasma.id } })
        console.log(`      ✓ Hard-delete do fantasma: OK`)

        resultados.push({
          fantasma: par.fantasma.nome,
          correto: par.correto.nome,
          merges,
          updates,
          totalTransferido,
        })
      }

      return resultados
    },
    { timeout: 60000 }
  )

  console.log('\n' + '═'.repeat(80))
  console.log('✅ CORREÇÃO APLICADA COM SUCESSO!')
  console.log('═'.repeat(80))
  console.log(`   ${resultado.length} par(es) processado(s):\n`)
  for (const r of resultado) {
    console.log(
      `   • "${r.fantasma}" → "${r.correto}"\n` +
        `     merges: ${r.merges}  updates: ${r.updates}  usos transferidos: +${r.totalTransferido}\n` +
        `     fantasma hard-deletado: SIM`
    )
  }
  console.log('\n' + '═'.repeat(80))
  console.log('🎉 PRÓXIMOS PASSOS:')
  console.log('   1. Abra /nutricao/cardapios no navegador')
  console.log('   2. Abra um cardápio que tinha algum pão fantasma')
  console.log('   3. Confirme que só aparecem "Pão francês X" e "Pão QC X" (sem "Pão X" genérico)')
  console.log('   4. Confirme que o kcal está sendo calculado')
  console.log('   5. Se tudo OK, commit no git')
  if (semPar.length > 0) {
    console.log('\n   ⚠️  Lembre de revisar manualmente os fantasmas sem par:')
    for (const f of semPar) {
      console.log(`      • "${f.nome}" (id=${f.id})`)
    }
  }
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
