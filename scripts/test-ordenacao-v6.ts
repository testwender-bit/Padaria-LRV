// ============================================================
// scripts/test-ordenacao-v6.ts
// ============================================================
// Testa a v6 da ordenação:
//   1. Usa categoria do banco (FRUTA, ACOMPANHAMENTO, BEBIDA) como referência primária
//   2. Fix bug "item novo com ordem=0": itens sem ordem vão para o FIM da lista
//      (depois dos itens com ordem manual), não para o topo
//   3. Botão "Reordenar semana" (calculaOrdemCanonicaSlot com categoria)
//
// Não toca no banco — testa apenas a lógica em memória.
//
// USO:
//   npx tsx scripts/test-ordenacao-v6.ts
// ============================================================

import {
  sortItensByRefeicao,
  detectarPerfilSlotAvancado,
  calcularOrdemCanonicaSlot,
} from '../src/lib/ordenacao-preparacoes'

interface ItemTeste {
  id: string
  preparacao: { nome: string; categoria?: string }
  tipo_refeicao_id: string
  ordem?: number
}

const tiposRefeicaoPadrao = [
  { id: '1', codigo: 'LANCHE' },
  { id: '2', codigo: 'ALMOCO' },
]

function criarItem(id: string, nome: string, categoria?: string, ordem?: number): ItemTeste {
  return {
    id,
    preparacao: { nome, categoria },
    tipo_refeicao_id: '1',
    ordem,
  }
}

let pass = 0
let fail = 0

function arraysIguais(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((s, i) => s === b[i])
}

function testar(descricao: string, itens: ItemTeste[], esperadoNomes: string[]) {
  const ordenados = sortItensByRefeicao(itens, tiposRefeicaoPadrao)
  const obtido = ordenados.map(i => i.preparacao.nome)
  const ok = arraysIguais(obtido, esperadoNomes)
  const simbolo = ok ? '✅' : '❌'
  console.log(`${simbolo} ${descricao}`)
  console.log(`   esperado: ${esperadoNomes.join(' → ')}`)
  console.log(`   obtido:  ${obtido.join(' → ')}`)
  console.log()
  if (ok) pass++
  else fail++
}

// ─── TESTES v6 ──────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(80))
console.log('🧪 TESTE DA ORDENAÇÃO v6 (categoria do banco + fix bug item novo)')
console.log('═'.repeat(80) + '\n')

// ── TESTE 1: Categoria FRUTA do banco deve ter precedência sobre nome ──
console.log('── Categoria do banco tem precedência ──\n')

testar(
  'Fruta com nome estranho ("Fruta do conde") + categoria FRUTA no banco → vai pro fim',
  [
    criarItem('1', 'Pão francês', 'PAO'),
    criarItem('2', 'Suco de laranja', 'BEBIDA'),
    criarItem('3', 'Fruta do conde', 'FRUTA'), // "conde" não é KW de fruta, mas categoria é FRUTA
  ],
  ['Suco de laranja', 'Pão francês', 'Fruta do conde']
)

testar(
  'Acompanhamento com nome genérico + categoria ACOMPANHAMENTO → fica após proteína',
  [
    criarItem('1', 'Arroz branco'),
    criarItem('2', 'Carne moída'),
    criarItem('3', 'Mistura especial da casa', 'ACOMPANHAMENTO'), // nome não indica, mas categoria sim
  ],
  ['Arroz branco', 'Carne moída', 'Mistura especial da casa']
)

testar(
  'Bebida com nome que parece fruta ("Vitamina de banana") + categoria BEBIDA → fica primeiro',
  [
    criarItem('1', 'Vitamina de banana', 'BEBIDA'), // categoria BEBIDA tem precedência
    criarItem('2', 'Pão francês', 'PAO'),
    criarItem('3', 'Banana', 'FRUTA'),
  ],
  ['Vitamina de banana', 'Pão francês', 'Banana']
)

// ── TESTE 2: Fix bug "item novo com ordem=0" ──
console.log('── Fix bug "item novo com ordem=0" ──\n')

testar(
  'Slot com 2 itens ordenados (1, 2) + 1 item novo (ordem=0) → item novo vai pro FIM',
  [
    criarItem('1', 'Pão francês', 'PAO', 1),
    criarItem('2', 'Suco de laranja', 'BEBIDA', 2),
    criarItem('3', 'Banana', 'FRUTA', 0), // novo, sem ordem
  ],
  ['Pão francês', 'Suco de laranja', 'Banana']
  // ANTES do v6: Banana ia para o TOPO (porque 0 < 1), bagunçando a lista
)

testar(
  'Slot com 3 itens ordenados (1, 2, 3) + 2 itens novos (ordem=0) → novos vão pro FIM na ordem canônica',
  [
    criarItem('1', 'Arroz branco', undefined, 1),
    criarItem('2', 'Feijão', undefined, 2),
    criarItem('3', 'Carne moída', undefined, 3),
    criarItem('4', 'Banana', 'FRUTA', 0), // novo
    criarItem('5', 'Salada de alface', 'ACOMPANHAMENTO', 0), // novo
  ],
  ['Arroz branco', 'Feijão', 'Carne moída', 'Salada de alface', 'Banana']
  // Novos vão pro fim, mas ordenados entre si pela prioridade canônica
  // (Salada vem antes de Banana porque ACOMPANHAMENTO < FRUTA no perfil COMIDA)
)

testar(
  'Slot SÓ com itens sem ordem (todos ordem=0) → aplica auto-sort canônico',
  [
    criarItem('1', 'Banana', 'FRUTA'),
    criarItem('2', 'Pão francês', 'PAO'),
    criarItem('3', 'Suco de laranja', 'BEBIDA'),
  ],
  ['Suco de laranja', 'Pão francês', 'Banana']
)

testar(
  'Slot SÓ com itens com ordem → respeita ordem manual (não reordena)',
  [
    criarItem('1', 'Banana', 'FRUTA', 1),
    criarItem('2', 'Pão francês', 'PAO', 2),
    criarItem('3', 'Suco', 'BEBIDA', 3),
  ],
  ['Banana', 'Pão francês', 'Suco']
)

// ── TESTE 3: 3 perfis continuam funcionando com categoria do banco ──
console.log('── Perfis PAO_LANCHE / COMIDA / CUSCUZ com categoria ──\n')

testar(
  'PAO_LANCHE: Bebida → Pão → Fruta (usando categoria)',
  [
    criarItem('1', 'Pão francês', 'PAO'),
    criarItem('2', 'Suco de laranja', 'BEBIDA'),
    criarItem('3', 'Banana', 'FRUTA'),
  ],
  ['Suco de laranja', 'Pão francês', 'Banana']
)

testar(
  'COMIDA: Salada → Arroz → Feijão → Proteína → Acompanhamento → Fruta',
  [
    criarItem('1', 'Arroz branco'),
    criarItem('2', 'Feijão carioca'),
    criarItem('3', 'Salada de alface', 'ACOMPANHAMENTO'),
    criarItem('4', 'Carne moída'),
    criarItem('5', 'Purê de batata', 'ACOMPANHAMENTO'),
    criarItem('6', 'Banana', 'FRUTA'),
  ],
  [
    'Salada de alface', // Salada vem primeiro (é ACOMPANHAMENTO mas tem "salada" no nome → detecta como SALADA por fallback)
    'Arroz branco',
    'Feijão carioca',
    'Carne moída',
    'Purê de batata',
    'Banana',
  ]
)

testar(
  'CUSCUZ: Cuscuz → Acompanhamento → Fruta (usando categoria)',
  [
    criarItem('1', 'Cuscuz de milho'),
    criarItem('2', 'Ovo cozido'),
    criarItem('3', 'Banana', 'FRUTA'),
  ],
  ['Cuscuz de milho', 'Ovo cozido', 'Banana']
)

// ── TESTE 4: detectarPerfilSlotAvancado ──
console.log('── Detecção de perfil com categoria do banco ──\n')

function testarPerfil(descricao: string, itens: ItemTeste[], esperado: string) {
  const obtido = detectarPerfilSlotAvancado(itens)
  const ok = obtido === esperado
  const simbolo = ok ? '✅' : '❌'
  console.log(`${simbolo} ${descricao}: esperado=${esperado}, obtido=${obtido}`)
  if (ok) pass++
  else fail++
}

testarPerfil('Só pão (categoria PAO)', [
  criarItem('1', 'Pão francês', 'PAO'),
], 'PAO_LANCHE')

testarPerfil('Pão + bebida', [
  criarItem('1', 'Pão francês', 'PAO'),
  criarItem('2', 'Suco', 'BEBIDA'),
], 'PAO_LANCHE')

testarPerfil('Só cuscuz (sem categoria, detecta por nome)', [
  criarItem('1', 'Cuscuz'),
], 'CUSCUZ')

testarPerfil('Cuscuz + pão (cuscuz vence)', [
  criarItem('1', 'Cuscuz'),
  criarItem('2', 'Pão francês', 'PAO'),
], 'CUSCUZ')

testarPerfil('Arroz + feijão + carne (comida)', [
  criarItem('1', 'Arroz'),
  criarItem('2', 'Feijão'),
  criarItem('3', 'Carne'),
], 'COMIDA')

testarPerfil('Vazio', [], 'COMIDA')

testarPerfil('Lanche especial (categoria LANCHE)', [
  criarItem('1', 'Rosca', 'LANCHE'),
], 'PAO_LANCHE')

console.log()

// ── TESTE 5: calcularOrdemCanonicaSlot (botão Reordenar semana) ──
console.log('── Botão "Reordenar semana" (calcularOrdemCanonicaSlot) ──\n')

function testarCanonico(descricao: string, itens: ItemTeste[], esperadoNomes: string[]) {
  const ordenados = calcularOrdemCanonicaSlot(itens, tiposRefeicaoPadrao)
  const obtido = ordenados.map(i => i.preparacao.nome)
  const ok = arraysIguais(obtido, esperadoNomes)
  const simbolo = ok ? '✅' : '❌'
  console.log(`${simbolo} ${descricao}`)
  console.log(`   esperado: ${esperadoNomes.join(' → ')}`)
  console.log(`   obtido:  ${obtido.join(' → ')}`)
  console.log()
  if (ok) pass++
  else fail++
}

testarCanonico(
  'Reordenar ignora ordem manual e aplica canônica',
  [
    criarItem('1', 'Banana', 'FRUTA', 5),       // fruta por último
    criarItem('2', 'Pão francês', 'PAO', 1),    // pão no meio
    criarItem('3', 'Suco de laranja', 'BEBIDA', 3), // bebida primeiro
  ],
  ['Suco de laranja', 'Pão francês', 'Banana']
)

// ── RESULTADO FINAL ──
console.log('═'.repeat(80))
console.log(`RESULTADO: ${pass} passou(aram) · ${fail} falhou(aram)`)
console.log('═'.repeat(80))

if (fail > 0) process.exit(1)
