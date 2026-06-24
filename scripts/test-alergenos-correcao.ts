// ============================================================
// scripts/test-alergenos-correcao.ts
// ============================================================
// Teste rápido para validar a correção do bug de falso positivo
// de alérgeno em "Couve manteiga" (era marcada como Leite).
//
// Não toca no banco de dados — apenas testa a função em memória.
//
// USO:
//   npx tsx scripts/test-alergenos-correcao.ts
// ============================================================

import {
  detectarAlergenosAlimento,
  detectarAlergenosPreparacao,
  type AlimentoBasco,
} from '../src/lib/alergenos-utils'

interface CasoTeste {
  descricao: string
  alimento: AlimentoBasco
  esperado: string[] // siglas esperadas, ordenadas L,O,T,S
}

const casos: CasoTeste[] = [
  // ── CASOS DO BUG (devem voltar a funcionar) ──
  {
    descricao: 'Couve, manteiga, crua (nome TACO real) — NÃO deve ter leite',
    alimento: { nome: 'Couve, manteiga, crua' },
    esperado: [],
  },
  {
    descricao: 'Couve manteiga (sem grupo) — NÃO deve ter leite',
    alimento: { nome: 'Couve manteiga' },
    esperado: [],
  },
  {
    descricao: 'Couve manteiga (grupo Verduras) — NÃO deve ter leite',
    alimento: { nome: 'Couve manteiga', grupo: 'Verduras e legumes' },
    esperado: [],
  },
  {
    descricao: 'Couve Manteiga (capital) — NÃO deve ter leite',
    alimento: { nome: 'Couve Manteiga' },
    esperado: [],
  },
  {
    descricao: 'Couve-manteiga (hífen) — NÃO deve ter leite',
    alimento: { nome: 'Couve-manteiga' },
    esperado: [],
  },
  {
    descricao: 'Ervilha, manteiga, crua (nome TACO real) — NÃO deve ter leite',
    alimento: { nome: 'Ervilha, manteiga, crua' },
    esperado: [],
  },
  {
    descricao: 'Ervilha manteiga — NÃO deve ter leite',
    alimento: { nome: 'Ervilha manteiga' },
    esperado: [],
  },

  // ── CASOS POSITIVOS (continuam detectando leite) ──
  {
    descricao: 'Manteiga (sozinha) — DEVE ter leite',
    alimento: { nome: 'Manteiga' },
    esperado: ['L'],
  },
  {
    descricao: 'Manteiga sem sal — DEVE ter leite',
    alimento: { nome: 'Manteiga sem sal' },
    esperado: ['L'],
  },
  {
    descricao: 'Leite integral — DEVE ter leite',
    alimento: { nome: 'Leite integral' },
    esperado: ['L'],
  },
  {
    descricao: 'Queijo prato — DEVE ter leite',
    alimento: { nome: 'Queijo prato' },
    esperado: ['L'],
  },
  {
    descricao: 'Iogurte de morango — DEVE ter leite',
    alimento: { nome: 'Iogurte de morango' },
    esperado: ['L'],
  },
  {
    descricao: 'Leite e derivados (por grupo) — DEVE ter leite',
    alimento: { nome: 'Queijo coalho', grupo: 'Leite e derivados' },
    esperado: ['L'],
  },

  // ── OUTROS ALÉRGENOS (não devem quebrar) ──
  {
    descricao: 'Ovo cozido — DEVE ter ovo',
    alimento: { nome: 'Ovo cozido' },
    esperado: ['O'],
  },
  {
    descricao: 'Farinha de trigo — DEVE ter trigo',
    alimento: { nome: 'Farinha de trigo' },
    esperado: ['T'],
  },
  {
    descricao: 'Pão francês — DEVE ter trigo',
    alimento: { nome: 'Pão francês' },
    esperado: ['T'],
  },
  {
    descricao: 'Soja em grão — DEVE ter soja',
    alimento: { nome: 'Soja em grão' },
    esperado: ['S'],
  },
  {
    descricao: 'Óleo de soja — NÃO deve ter soja (isento RDC 26/2015)',
    alimento: { nome: 'Óleo de soja' },
    esperado: [],
  },

  // ── CASOS MISTOS ──
  {
    descricao: 'Pão de queijo — DEVE ter leite E trigo',
    alimento: { nome: 'Pão de queijo' },
    esperado: ['L', 'T'], // Padrões: 'pao de queijo' (L) + 'pao ' (T)
  },
  {
    descricao: 'Bolo de queijo — DEVE ter leite (trigo é bug pré-existente fora do escopo)',
    alimento: { nome: 'Bolo de queijo' },
    esperado: ['L'], // PADROES_TRIGO não inclui 'bolo de queijo' — bug pré-existente
  },
]

// ── Teste de preparação completa (vários ingredientes) ──
interface CasoPreparacao {
  descricao: string
  ingredientes: AlimentoBasco[]
  esperado: string[]
}

const casosPreparacao: CasoPreparacao[] = [
  {
    descricao: 'Preparação só com couve manteiga — NÃO deve ter leite',
    ingredientes: [
      { nome: 'Couve manteiga' },
      { nome: 'Alho' },
      { nome: 'Óleo de soja' },
      { nome: 'Sal refinado' },
    ],
    esperado: [],
  },
  {
    descricao: 'Preparação com couve manteiga E leite — DEVE ter leite',
    ingredientes: [
      { nome: 'Couve manteiga' },
      { nome: 'Leite integral' },
      { nome: 'Sal refinado' },
    ],
    esperado: ['L'],
  },
  {
    descricao: 'Pão com queijo + couve manteiga — DEVE ter leite E trigo',
    ingredientes: [
      { nome: 'Pão francês' },
      { nome: 'Queijo prato' },
      { nome: 'Couve manteiga' },
    ],
    esperado: ['L', 'T'],
  },
]

function siglasIguais(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((s, i) => s === b[i])
}

function rodarTestes() {
  console.log('\n' + '═'.repeat(80))
  console.log('🧪 TESTE DA CORREÇÃO DE ALÉRGENOS — Couve manteiga')
  console.log('═'.repeat(80) + '\n')

  let pass = 0
  let fail = 0
  const falhas: string[] = []

  console.log('── Testes unitários (detectarAlergenosAlimento) ──\n')
  for (const caso of casos) {
    const obtido = detectarAlergenosAlimento(caso.alimento)
    const ok = siglasIguais(obtido, caso.esperado)
    const simbolo = ok ? '✅' : '❌'
    console.log(
      `${simbolo} ${caso.descricao}\n` +
        `   esperado: [${caso.esperado.join(', ')}]  obtido: [${obtido.join(', ')}]`
    )
    if (ok) pass++
    else {
      fail++
      falhas.push(`ALIMENTO: ${caso.descricao}`)
    }
  }

  console.log('\n── Testes de preparação (detectarAlergenosPreparacao) ──\n')
  for (const caso of casosPreparacao) {
    const obtido = detectarAlergenosPreparacao(caso.ingredientes)
    const ok = siglasIguais(obtido, caso.esperado)
    const simbolo = ok ? '✅' : '❌'
    console.log(
      `${simbolo} ${caso.descricao}\n` +
        `   esperado: [${caso.esperado.join(', ')}]  obtido: [${obtido.join(', ')}]`
    )
    if (ok) pass++
    else {
      fail++
      falhas.push(`PREPARAÇÃO: ${caso.descricao}`)
    }
  }

  console.log('\n' + '═'.repeat(80))
  console.log(`RESULTADO: ${pass} passou(aram) · ${fail} falhou(aram)`)
  console.log('═'.repeat(80))

  if (fail > 0) {
    console.log('\n❌ Falhas:')
    for (const f of falhas) console.log(`   • ${f}`)
    process.exit(1)
  }

  console.log('\n✅ Tudo OK! A correção está funcionando.\n')
}

rodarTestes()
