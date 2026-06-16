// ============================================================
// seed-v8-categorias.ts
// ============================================================
// Marca as preparações existentes com base em heurísticas de nome
// para popular o novo campo "categoria".
//
// Rodar: npx tsx scripts/seed-v8-categorias.ts
// (Depois de rodar `npx prisma db push` para criar a coluna)
// ============================================================

import { db } from '../src/lib/db'

interface RegraHeuristica {
  categoria: 'PAO' | 'LANCHE' | 'BEBIDA' | 'SOBREMESA'
  patterns: RegExp[]
}

const regras: RegraHeuristica[] = [
  {
    categoria: 'PAO',
    patterns: [
      /pão francês/i,
      /pao frances/i,
      /pão de forma/i,
      /pao de forma/i,
      /\bp\b\s*frances/i,
      /^\s*pf\s*$/i,
      /pão franc/i,
    ],
  },
  {
    categoria: 'LANCHE',
    patterns: [
      /lanche/i,
      /salgado/i,
      /pão de queijo/i,
      /pao de queijo/i,
      /coxinha/i,
      /esfiha/i,
      /pastel/i,
    ],
  },
  {
    categoria: 'BEBIDA',
    patterns: [
      /suco/i,
      /leite/i,
      /chá/i,
      /^cha\s/i,
      /vitamina/i,
      /iogurte/i,
      /água/i,
      /^agua\s/i,
    ],
  },
  {
    categoria: 'SOBREMESA',
    patterns: [
      /sobremesa/i,
      /doce/i,
      /gelatina/i,
      /pudim/i,
      /musse/i,
      /mousse/i,
    ],
  },
]

async function main() {
  console.log('Buscando preparações com categoria PREPARACAO (default)...')
  const preps = await db.preparacao.findMany({
    where: { categoria: 'PREPARACAO' },
    select: { id: true, nome: true },
  })
  console.log(`Encontradas ${preps.length} preparações para classificar.`)

  const atualizacoes: { id: string; nome: string; categoria: string }[] = []

  for (const p of preps) {
    for (const regra of regras) {
      if (regra.patterns.some((re) => re.test(p.nome))) {
        atualizacoes.push({ id: p.id, nome: p.nome, categoria: regra.categoria })
        break
      }
    }
  }

  console.log(`\nClassificação heurística:`)
  for (const cat of ['PAO', 'LANCHE', 'BEBIDA', 'SOBREMESA'] as const) {
    const count = atualizacoes.filter((a) => a.categoria === cat).length
    console.log(`  ${cat}: ${count}`)
  }

  if (atualizacoes.length === 0) {
    console.log('\nNenhuma preparação correspondeu às heurísticas. Nada a atualizar.')
    return
  }

  console.log('\nAplicando atualizações...')
  for (const upd of atualizacoes) {
    await db.preparacao.update({
      where: { id: upd.id },
      data: { categoria: upd.categoria },
    })
    console.log(`  [${upd.categoria}] ${upd.nome}`)
  }

  console.log(`\n${atualizacoes.length} preparações atualizadas.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
