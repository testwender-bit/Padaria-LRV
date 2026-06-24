// ============================================================
// scripts/test-ordenacao-v5.ts
// ============================================================
// Testa a nova ordenação por PERFIS (v5):
//   - PAO_LANCHE: Bebida → Pão → Fruta
//   - COMIDA: Salada → Arroz → Feijão → Proteína → Acompanhamento → Fruta
//   - CUSCUZ: Cuscuz → Acompanhamento → Fruta
//
// Não toca no banco — testa apenas a lógica em memória.
//
// USO:
//   npx tsx scripts/test-ordenacao-v5.ts
// ============================================================

import {
  sortItensByRefeicao,
  detectarPerfilSlot,
  calcularOrdemCanonicaSlot,
} from '../src/lib/ordenacao-preparacoes'

interface CasoTeste {
  descricao: string
  itens: { id: string; preparacao: { nome: string }; tipo_refeicao_id: string; ordem?: number }[]
  tiposRefeicao: { id: string; codigo: string }[]
  esperadoNomes: string[]
}

const tiposRefeicaoPadrao = [
  { id: '1', codigo: 'LANCHE' },
  { id: '2', codigo: 'ALMOCO' },
]

function criarItem(id: string, nome: string): CasoTeste['itens'][0] {
  return { id, preparacao: { nome }, tipo_refeicao_id: '1' }
}

const casos: CasoTeste[] = [
  // ── PERFIL PAO_LANCHE: Bebida → Pão → Fruta ──
  {
    descricao: 'Lanche com pão francês + suco + banana (PAO_LANCHE)',
    itens: [
      criarItem('1', 'Pão francês'),
      criarItem('2', 'Suco de laranja'),
      criarItem('3', 'Banana'),
    ],
    tiposRefeicao: tiposRefeicaoPadrao,
    esperadoNomes: ['Suco de laranja', 'Pão francês', 'Banana'],
  },
  {
    descricao: 'Lanche com vitamina + pão com doce + maçã (PAO_LANCHE)',
    itens: [
      criarItem('1', 'Pão com doce de fruta'),
      criarItem('2', 'Vitamina de banana'),
      criarItem('3', 'Maçã'),
    ],
    tiposRefeicao: tiposRefeicaoPadrao,
    esperadoNomes: ['Vitamina de banana', 'Pão com doce de fruta', 'Maçã'],
  },
  {
    descricao: 'Lanche com pão QC + leite + fruta (PAO_LANCHE)',
    itens: [
      criarItem('1', 'Pão QC com manteiga'),
      criarItem('2', 'Leite integral'),
      criarItem('3', 'Mamão'),
    ],
    tiposRefeicao: tiposRefeicaoPadrao,
    esperadoNomes: ['Leite integral', 'Pão QC com manteiga', 'Mamão'],
  },

  // ── PERFIL COMIDA: Salada → Arroz → Feijão → Proteína → Acompanhamento → Fruta ──
  {
    descricao: 'Almoço completo com salada, arroz, feijão, carne, batata, fruta (COMIDA)',
    itens: [
      criarItem('1', 'Arroz branco'),
      criarItem('2', 'Feijão carioca'),
      criarItem('3', 'Salada de alface e tomate'),
      criarItem('4', 'Carne moída ao molho'),
      criarItem('5', 'Purê de batata'),
      criarItem('6', 'Banana'),
    ],
    tiposRefeicao: tiposRefeicaoPadrao,
    esperadoNomes: [
      'Salada de alface e tomate',
      'Arroz branco',
      'Feijão carioca',
      'Carne moída ao molho',
      'Purê de batata',
      'Banana',
    ],
  },
  {
    descricao: 'Almoço sem salada e sem fruta (COMIDA parcial)',
    itens: [
      criarItem('1', 'Arroz branco'),
      criarItem('2', 'Frango grelhado'),
      criarItem('3', 'Feijão tropeiro'),
    ],
    tiposRefeicao: tiposRefeicaoPadrao,
    esperadoNomes: ['Arroz branco', 'Feijão tropeiro', 'Frango grelhado'],
  },
  {
    descricao: 'Almoço com macarrão (acompanhamento) e proteína (COMIDA)',
    itens: [
      criarItem('1', 'Macarrão alho e óleo'),
      criarItem('2', 'Carne de panela'),
      criarItem('3', 'Arroz branco'),
    ],
    tiposRefeicao: tiposRefeicaoPadrao,
    esperadoNomes: ['Arroz branco', 'Carne de panela', 'Macarrão alho e óleo'],
  },

  // ── PERFIL CUSCUZ: Cuscuz → Acompanhamento → Fruta ──
  {
    descricao: 'Lanche com cuscuz + ovo + banana (CUSCUZ)',
    itens: [
      criarItem('1', 'Cuscuz de milho'),
      criarItem('2', 'Ovo cozido'),
      criarItem('3', 'Banana'),
    ],
    tiposRefeicao: tiposRefeicaoPadrao,
    esperadoNomes: ['Cuscuz de milho', 'Ovo cozido', 'Banana'],
  },
  {
    descricao: 'Lanche com cuscuz + carne + fruta (CUSCUZ)',
    itens: [
      criarItem('1', 'Cuscuz'),
      criarItem('2', 'Carne moída'),
      criarItem('3', 'Laranja'),
    ],
    tiposRefeicao: tiposRefeicaoPadrao,
    esperadoNomes: ['Cuscuz', 'Carne moída', 'Laranja'],
  },
  {
    descricao: 'Cuscuz com legumes (CUSCUZ — legumes como acompanhamento)',
    itens: [
      criarItem('1', 'Cuscuz de tapioca'),
      criarItem('2', 'Legumes refogados'),
      criarItem('3', 'Banana'),
    ],
    tiposRefeicao: tiposRefeicaoPadrao,
    esperadoNomes: ['Cuscuz de tapioca', 'Legumes refogados', 'Banana'],
  },
]

function arraysIguais(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((s, i) => s === b[i])
}

function rodarTestes() {
  console.log('\n' + '═'.repeat(80))
  console.log('🧪 TESTE DA NOVA ORDENAÇÃO v5 (perfis PAO_LANCHE / COMIDA / CUSCUZ)')
  console.log('═'.repeat(80) + '\n')

  let pass = 0
  let fail = 0

  for (const caso of casos) {
    const ordenados = sortItensByRefeicao(caso.itens, caso.tiposRefeicao)
    const obtidoNomes = ordenados.map(i => i.preparacao.nome)
    const perfil = detectarPerfilSlot(caso.itens.map(i => i.preparacao.nome))

    const ok = arraysIguais(obtidoNomes, caso.esperadoNomes)
    const simbolo = ok ? '✅' : '❌'
    console.log(`${simbolo} ${caso.descricao}`)
    console.log(`   perfil detectado: ${perfil}`)
    console.log(`   esperado: ${caso.esperadoNomes.join(' → ')}`)
    console.log(`   obtido:  ${obtidoNomes.join(' → ')}`)
    console.log()
    if (ok) pass++
    else fail++
  }

  // ── Testes de perfil (apenas detecção) ──
  console.log('── Testes de detecção de perfil ──\n')

  const testesPerfil: { desc: string; nomes: string[]; esperado: string }[] = [
    { desc: 'Só pão', nomes: ['Pão francês'], esperado: 'PAO_LANCHE' },
    { desc: 'Pão + bebida', nomes: ['Pão francês', 'Suco'], esperado: 'PAO_LANCHE' },
    { desc: 'Só cuscuz', nomes: ['Cuscuz'], esperado: 'CUSCUZ' },
    { desc: 'Cuscuz + pão', nomes: ['Cuscuz', 'Pão francês'], esperado: 'CUSCUZ' },
    { desc: 'Arroz + feijão + carne', nomes: ['Arroz', 'Feijão', 'Carne'], esperado: 'COMIDA' },
    { desc: 'Vazio', nomes: [], esperado: 'COMIDA' },
    { desc: 'Lanche especial (rosca)', nomes: ['Rosca'], esperado: 'PAO_LANCHE' },
  ]

  for (const t of testesPerfil) {
    const obtido = detectarPerfilSlot(t.nomes)
    const ok = obtido === t.esperado
    const simbolo = ok ? '✅' : '❌'
    console.log(`${simbolo} ${t.desc}: esperado=${t.esperado}, obtido=${obtido}`)
    if (ok) pass++
    else fail++
  }

  // ── Testes de calcularOrdemCanonicaSlot (botão Reordenar) ──
  console.log('\n── Testes de calcularOrdemCanonicaSlot (botão Reordenar dia) ──\n')

  const testeCanonico = {
    desc: 'Botão reordenar deve aplicar ordem canônica ignorando ordem manual',
    itens: [
      { id: '1', preparacao: { nome: 'Banana' }, tipo_refeicao_id: '1', ordem: 5 },
      { id: '2', preparacao: { nome: 'Pão francês' }, tipo_refeicao_id: '1', ordem: 1 },
      { id: '3', preparacao: { nome: 'Suco de laranja' }, tipo_refeicao_id: '1', ordem: 3 },
    ],
    esperado: ['Suco de laranja', 'Pão francês', 'Banana'],
  }

  const ordenadosCanonico = calcularOrdemCanonicaSlot(testeCanonico.itens, tiposRefeicaoPadrao)
  const obtidoCanonico = ordenadosCanonico.map(i => i.preparacao.nome)
  const ok = arraysIguais(obtidoCanonico, testeCanonico.esperado)
  console.log(`${ok ? '✅' : '❌'} ${testeCanonico.desc}`)
  console.log(`   esperado: ${testeCanonico.esperado.join(' → ')}`)
  console.log(`   obtido:  ${obtidoCanonico.join(' → ')}\n`)
  if (ok) pass++
  else fail++

  // ── Teste: ordem manual deve ser respeitada ──
  console.log('── Teste: ordem manual deve ser respeitada pelo sortItensByRefeicao ──\n')

  const itensComOrdemManual = [
    { id: '1', preparacao: { nome: 'Banana' }, tipo_refeicao_id: '1', ordem: 1 },
    { id: '2', preparacao: { nome: 'Pão francês' }, tipo_refeicao_id: '1', ordem: 2 },
    { id: '3', preparacao: { nome: 'Suco' }, tipo_refeicao_id: '1', ordem: 3 },
  ]
  const ordenadosManual = sortItensByRefeicao(itensComOrdemManual, tiposRefeicaoPadrao)
  const esperadoManual = ['Banana', 'Pão francês', 'Suco'] // respeita ordem manual (1, 2, 3)
  const obtidoManual = ordenadosManual.map(i => i.preparacao.nome)
  const okManual = arraysIguais(obtidoManual, esperadoManual)
  console.log(`${okManual ? '✅' : '❌'} Ordem manual respeitada`)
  console.log(`   esperado: ${esperadoManual.join(' → ')}`)
  console.log(`   obtido:  ${obtidoManual.join(' → ')}\n`)
  if (okManual) pass++
  else fail++

  console.log('═'.repeat(80))
  console.log(`RESULTADO: ${pass} passou(aram) · ${fail} falhou(aram)`)
  console.log('═'.repeat(80))

  if (fail > 0) process.exit(1)
}

rodarTestes()
