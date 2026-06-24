// ============================================================
// scripts/diagnostic-preparacoes-fantasma.ts
// ============================================================
// Lista TODAS as preparações "fantasma" do banco, ou seja:
//   - ativo = false (soft-deleted) MAS ainda referenciada em CardapioItem
//   - OU ativo = true MAS sem nenhum ingrediente cadastrado
//
// Essas preparações aparecem nos cardápios já lançados mas:
//   - Não aparecem na lista de seleção (filtro ativo=true)
//   - Não contribuem com kcal (sem ingredientes válidos)
//
// USO:
//   npx tsx scripts/diagnostic-preparacoes-fantasma.ts
//
// Saída: tabela com id, nome, ativo, qtd ingredientes, qtd usos em cardápios.
// Não modifica nada — somente leitura.
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n' + '═'.repeat(80))
  console.log('👻 DIAGNÓSTICO DE PREPARAÇÕES FANTASMA')
  console.log('═'.repeat(80) + '\n')

  // 1) Buscar todas as preparações com contadores
  const todas = await prisma.preparacao.findMany({
    include: {
      _count: {
        select: {
          ingredientes: true,
          cardapio_itens: true,
        },
      },
    },
    orderBy: { nome: 'asc' },
  })

  // 2) Filtrar fantasmas
  const fantasmas = todas.filter(
    (p) =>
      // Caso A: soft-deleted mas ainda referenciada em cardápios
      (p.ativo === false && p._count.cardapio_itens > 0) ||
      // Caso B: ativa mas sem ingredientes (não contribui com kcal)
      (p.ativo === true && p._count.ingredientes === 0 && p._count.cardapio_itens > 0)
  )

  if (fantasmas.length === 0) {
    console.log('✅ Nenhuma preparação fantasma encontrada.\n')
    return
  }

  console.log(`⚠️  ${fantasmas.length} preparação(ões) fantasma encontrada(s):\n`)

  // Cabeçalho da tabela
  const fmt = (s: string, w: number) => s.padEnd(w).substring(0, w)
  console.log(
    fmt('ID', 28) +
      fmt('NOME', 35) +
      fmt('ATIVO', 7) +
      fmt('INGR', 6) +
      fmt('USOS', 6) +
      'PROBLEMA'
  )
  console.log('─'.repeat(100))

  for (const p of fantasmas) {
    const problema =
      p.ativo === false
        ? 'soft-deleted mas ainda em cardápios'
        : 'sem ingredientes mas ainda em cardápios'
    console.log(
      fmt(p.id, 28) +
        fmt(p.nome, 35) +
        fmt(p.ativo ? 'true' : 'FALSE', 7) +
        fmt(String(p._count.ingredientes), 6) +
        fmt(String(p._count.cardapio_itens), 6) +
        problema
    )
  }

  // 3) Para cada fantasma, listar onde ela é usada (top 5 cardápios)
  console.log('\n' + '═'.repeat(80))
  console.log('📋 ONDE AS FANTASMAS SÃO USADAS (top 5 cardápios por fantasma)')
  console.log('═'.repeat(80))

  for (const p of fantasmas) {
    console.log(`\n→ "${p.nome}" (id: ${p.id})`)

    const itens = await prisma.cardapioItem.findMany({
      where: { preparacao_id: p.id },
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
      take: 5,
    })

    if (itens.length === 0) {
      console.log('   (sem usos)')
      continue
    }

    for (const it of itens) {
      const cardapioNome = it.dia.semana.cardapio.nome
      const escolaNome = it.dia.semana.cardapio.escola?.nome || 'BASE'
      console.log(
        `   • Cardápio "${cardapioNome}" (${escolaNome}) — ` +
          `sem ${it.dia.semana.numero} ${it.dia.dia_semana} — ` +
          `${it.tipo_refeicao.nome} — ${it.porcoes} porçõe(s)`
      )
    }
    if (p._count.cardapio_itens > 5) {
      console.log(`   ... e mais ${p._count.cardapio_itens - 5} uso(s)`)
    }
  }

  // 4) Sugestão de "gêmeos" — preparações com mesmo nome normalizado
  console.log('\n' + '═'.repeat(80))
  console.log('🔍 GÊMEOS DE NOME (mesmo nome normalizado, IDs diferentes)')
  console.log('═'.repeat(80) + '\n')

  const porNomeNormalizado = new Map<string, typeof todas>()
  for (const p of todas) {
    const norm = p.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    if (!porNomeNormalizado.has(norm)) porNomeNormalizado.set(norm, [])
    porNomeNormalizado.get(norm)!.push(p)
  }

  const gemeos = [...porNomeNormalizado.entries()].filter(([, arr]) => arr.length > 1)
  if (gemeos.length === 0) {
    console.log('Nenhum gêmeo encontrado.\n')
    return
  }

  for (const [nome, arr] of gemeos) {
    console.log(`"${nome}" (${arr.length} ocorrências):`)
    for (const p of arr) {
      console.log(
        `   • id=${p.id}  nome="${p.nome}"  ativo=${p.ativo}  ` +
          `ingredientes=${p._count.ingredientes}  usos=${p._count.cardapio_itens}`
      )
    }
    console.log()
  }

  console.log('═'.repeat(80))
  console.log('💡 PRÓXIMO PASSO:')
  console.log('   Rode: npx tsx scripts/fix-arroz-fantasma.ts         (dry-run)')
  console.log('   Depois: npx tsx scripts/fix-arroz-fantasma.ts --apply')
  console.log('═'.repeat(80) + '\n')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
