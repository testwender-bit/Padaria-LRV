// ============================================================
// scripts/test-caso-torta.ts
// ============================================================
// Teste rápido do caso reportado pelo usuário:
//   Torta de carne moída (PREPARACAO) + Laranja (FRUTA) + Suco de maracujá (BEBIDA)
//
// Antes do v6.2: ordem errada (Torta → Laranja → Suco)
// Depois do v6.2: ordem correta (Torta → Suco → Laranja)
//   porque fruta sempre por último, depois da bebida
//
// USO:
//   npx tsx scripts/test-caso-torta.ts
// ============================================================

import { sortItensByRefeicao, detectarPerfilSlotAvancado } from '../src/lib/ordenacao-preparacoes'

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

console.log('\n' + '═'.repeat(80))
console.log('🧪 TESTE DO CASO REPORTADO: Torta de carne + Laranja + Suco')
console.log('═'.repeat(80) + '\n')

const itens: ItemTeste[] = [
  { id: '1', preparacao: { nome: 'Torta de carne moída', categoria: 'PREPARACAO' }, tipo_refeicao_id: '1', ordem: 0 },
  { id: '2', preparacao: { nome: 'Laranja', categoria: 'FRUTA' }, tipo_refeicao_id: '1', ordem: 0 },
  { id: '3', preparacao: { nome: 'Suco de maracujá', categoria: 'BEBIDA' }, tipo_refeicao_id: '1', ordem: 0 },
]

const perfil = detectarPerfilSlotAvancado(itens)
console.log(`Perfil detectado: ${perfil}`)
console.log(`(esperado: COMIDA — não tem pão nem cuscuz)\n`)

const ordenados = sortItensByRefeicao(itens, tiposRefeicaoPadrao)
const obtido = ordenados.map(i => i.preparacao.nome)
const esperado = ['Torta de carne moída', 'Suco de maracujá', 'Laranja']

console.log('Ordem obtida:')
ordenados.forEach((i, idx) => {
  console.log(`  ${idx + 1}. ${i.preparacao.nome}  (categoria: ${i.preparacao.categoria})`)
})

console.log('\nOrdem esperada (v6.2 — fruta sempre por último):')
console.log('  1. Torta de carne moída  (proteína por palavra-chave "carne")')
console.log('  2. Suco de maracujá      (bebida)')
console.log('  3. Laranja               (fruta — sempre por último)')

console.log()
const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
console.log(`${ok ? '✅ PASSOU' : '❌ FALHOU'}`)
console.log()

// Casos adicionais para garantir que a regra está consistente
console.log('─'.repeat(80))
console.log('CASOS ADICIONAIS (validar consistência da regra "fruta por último")')
console.log('─'.repeat(80) + '\n')

function testar(descricao: string, itensTeste: ItemTeste[], esperado: string[]) {
  const ord = sortItensByRefeicao(itensTeste, tiposRefeicaoPadrao)
  const obt = ord.map(i => i.preparacao.nome)
  const ok = JSON.stringify(obt) === JSON.stringify(esperado)
  console.log(`${ok ? '✅' : '❌'} ${descricao}`)
  console.log(`   esperado: ${esperado.join(' → ')}`)
  console.log(`   obtido:  ${obt.join(' → ')}\n`)
}

testar(
  'Almoço completo: Salada + Arroz + Feijão + Carne + Purê + Suco + Banana',
  [
    { id: '1', preparacao: { nome: 'Banana', categoria: 'FRUTA' }, tipo_refeicao_id: '2', ordem: 0 },
    { id: '2', preparacao: { nome: 'Suco de uva', categoria: 'BEBIDA' }, tipo_refeicao_id: '2', ordem: 0 },
    { id: '3', preparacao: { nome: 'Purê de batata', categoria: 'ACOMPANHAMENTO' }, tipo_refeicao_id: '2', ordem: 0 },
    { id: '4', preparacao: { nome: 'Carne moída', categoria: 'PREPARACAO' }, tipo_refeicao_id: '2', ordem: 0 },
    { id: '5', preparacao: { nome: 'Feijão carioca', categoria: 'PREPARACAO' }, tipo_refeicao_id: '2', ordem: 0 },
    { id: '6', preparacao: { nome: 'Arroz branco', categoria: 'PREPARACAO' }, tipo_refeicao_id: '2', ordem: 0 },
    { id: '7', preparacao: { nome: 'Salada de alface', categoria: 'ACOMPANHAMENTO' }, tipo_refeicao_id: '2', ordem: 0 },
  ],
  ['Salada de alface', 'Arroz branco', 'Feijão carioca', 'Carne moída', 'Purê de batata', 'Suco de uva', 'Banana']
)

testar(
  'Lanche com pão: Suco + Pão + Banana (PAO_LANCHE — bebida antes, fruta no fim)',
  [
    { id: '1', preparacao: { nome: 'Banana', categoria: 'FRUTA' }, tipo_refeicao_id: '1', ordem: 0 },
    { id: '2', preparacao: { nome: 'Pão francês', categoria: 'PAO' }, tipo_refeicao_id: '1', ordem: 0 },
    { id: '3', preparacao: { nome: 'Suco de laranja', categoria: 'BEBIDA' }, tipo_refeicao_id: '1', ordem: 0 },
  ],
  ['Suco de laranja', 'Pão francês', 'Banana']
)

testar(
  'Cuscuz: Cuscuz + Carne + Suco + Banana (CUSCUZ — fruta no fim)',
  [
    { id: '1', preparacao: { nome: 'Banana', categoria: 'FRUTA' }, tipo_refeicao_id: '1', ordem: 0 },
    { id: '2', preparacao: { nome: 'Cuscuz' }, tipo_refeicao_id: '1', ordem: 0 },
    { id: '3', preparacao: { nome: 'Carne moída', categoria: 'PREPARACAO' }, tipo_refeicao_id: '1', ordem: 0 },
    { id: '4', preparacao: { nome: 'Suco', categoria: 'BEBIDA' }, tipo_refeicao_id: '1', ordem: 0 },
  ],
  ['Cuscuz', 'Carne moída', 'Suco', 'Banana']
)

testar(
  'Caso do usuário: Torta de carne + Laranja + Suco (fruta no fim)',
  [
    { id: '1', preparacao: { nome: 'Torta de carne moída', categoria: 'PREPARACAO' }, tipo_refeicao_id: '1', ordem: 0 },
    { id: '2', preparacao: { nome: 'Laranja', categoria: 'FRUTA' }, tipo_refeicao_id: '1', ordem: 0 },
    { id: '3', preparacao: { nome: 'Suco de maracujá', categoria: 'BEBIDA' }, tipo_refeicao_id: '1', ordem: 0 },
  ],
  ['Torta de carne moída', 'Suco de maracujá', 'Laranja']
)

console.log('═'.repeat(80))
if (ok) {
  console.log('✅ Caso do usuário RESOLVIDO — fruta agora fica por último')
} else {
  console.log('❌ Caso do usuário AINDA NÃO resolvido')
}
console.log('═'.repeat(80) + '\n')
