// ============================================================
// scripts/test-caso-misto.ts
// ============================================================
// Testa o fix do bug "Suco de maracujá não obedece ordem" (v6.4).
//
// Cenário do bug: slot com itens com ordem manual + item novo sem ordem.
// Antes do v6.4: itens sem ordem iam para o FIM da lista, ignorando prioridade.
// Depois do v6.4: itens sem ordem são inseridos na posição correta por prioridade.
//
// USO:
//   npx tsx scripts/test-caso-misto.ts
// ============================================================

import { sortItensByRefeicao } from '../src/lib/ordenacao-preparacoes'

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

let pass = 0
let fail = 0

function criarItem(id: string, nome: string, categoria?: string, ordem?: number): ItemTeste {
  return { id, preparacao: { nome, categoria }, tipo_refeicao_id: '1', ordem }
}

function testar(descricao: string, itens: ItemTeste[], esperadoNomes: string[]) {
  const ordenados = sortItensByRefeicao(itens, tiposRefeicaoPadrao)
  const obtido = ordenados.map(i => i.preparacao.nome)
  const ok = JSON.stringify(obtido) === JSON.stringify(esperadoNomes)
  const simbolo = ok ? '✅' : '❌'
  console.log(`${simbolo} ${descricao}`)
  console.log(`   esperado: ${esperadoNomes.join(' → ')}`)
  console.log(`   obtido:  ${obtido.join(' → ')}\n`)
  if (ok) pass++
  else fail++
}

console.log('\n' + '═'.repeat(80))
console.log('🧪 TESTE DO FIX DO CASO MISTO (v6.4)')
console.log('   Bug: "Suco de maracujá não obedece ordem quando tem itens com ordem manual"')
console.log('═'.repeat(80) + '\n')

// ── Caso do bug reportado ──
console.log('── Caso do bug reportado (Suco de maracujá) ──\n')

testar(
  'BUG: Pão (ordem=1) + Banana (ordem=2) + Suco (sem ordem) → Suco deve ir PRIMEIRO',
  [
    criarItem('1', 'Pão francês', 'PAO', 1),
    criarItem('2', 'Banana', 'FRUTA', 2),
    criarItem('3', 'Suco de maracujá', 'BEBIDA', 0),  // novo, sem ordem
  ],
  ['Suco de maracujá', 'Pão francês', 'Banana']
  // Antes v6.4: Pão → Banana → Suco ❌
  // Depois v6.4: Suco → Pão → Banana ✅ (Suco tem prio 0, menor que Pão prio 1)
)

testar(
  'BUG: Pão (ordem=1) + Banana (ordem=2) + Laranja (sem ordem, fruta) → fruta vai pro fim',
  [
    criarItem('1', 'Pão francês', 'PAO', 1),
    criarItem('2', 'Banana', 'FRUTA', 2),
    criarItem('3', 'Laranja', 'FRUTA', 0),  // novo, sem ordem, fruta (prio 3)
  ],
  ['Pão francês', 'Banana', 'Laranja']
  // Fruta tem prio 3 (última), então vai depois dos itens com ordem manual
)

testar(
  'BUG: Arroz (ordem=1) + Feijão (ordem=2) + Salada (sem ordem) → Salada deve ir PRIMEIRO',
  [
    criarItem('1', 'Arroz branco', undefined, 1),
    criarItem('2', 'Feijão', undefined, 2),
    criarItem('3', 'Salada de alface', 'ACOMPANHAMENTO', 0),  // novo, sem ordem
  ],
  ['Salada de alface', 'Arroz branco', 'Feijão']
  // Salada tem prio 0 (sempre primeiro), então entra ANTES do Arroz
)

testar(
  'BUG: Arroz (ordem=1) + Carne (ordem=2) + Fruta (sem ordem) → Fruta deve ir por ÚLTIMO',
  [
    criarItem('1', 'Arroz branco', undefined, 1),
    criarItem('2', 'Carne moída', undefined, 2),
    criarItem('3', 'Banana', 'FRUTA', 0),  // novo, sem ordem, fruta (prio 6)
  ],
  ['Arroz branco', 'Carne moída', 'Banana']
  // Fruta tem prio 6 (última), então vai depois dos itens com ordem manual
)

// ── Casos de regressão (já funcionavam) ──
console.log('── Casos de regressão (não devem quebrar) ──\n')

testar(
  'SÓ itens com ordem manual → respeita ordem',
  [
    criarItem('1', 'Pão francês', 'PAO', 1),
    criarItem('2', 'Banana', 'FRUTA', 2),
    criarItem('3', 'Suco', 'BEBIDA', 3),
  ],
  ['Pão francês', 'Banana', 'Suco']
)

testar(
  'SÓ itens sem ordem → auto-sort canônico',
  [
    criarItem('1', 'Banana', 'FRUTA'),
    criarItem('2', 'Pão francês', 'PAO'),
    criarItem('3', 'Suco', 'BEBIDA'),
  ],
  ['Suco', 'Pão francês', 'Banana']
)

testar(
  'Misto com 2 sem ordem: Suco + Laranja entram nas posições corretas',
  [
    criarItem('1', 'Pão francês', 'PAO', 1),
    criarItem('2', 'Banana', 'FRUTA', 2),
    criarItem('3', 'Suco', 'BEBIDA', 0),       // prio 0 → antes do Pão
    criarItem('4', 'Laranja', 'FRUTA', 0),     // prio 3 → depois da Banana
  ],
  ['Suco', 'Pão francês', 'Banana', 'Laranja']
)

testar(
  'Misto: item sem ordem com MESMA prioridade que item com ordem → fica depois',
  [
    criarItem('1', 'Pão francês', 'PAO', 1),       // prio 1
    criarItem('2', 'Pão QC com manteiga', 'PAO', 0), // prio 1 (mesma) → depois
  ],
  ['Pão francês', 'Pão QC com manteiga']
  // Mesma prioridade → mantém ordem manual primeiro
)

console.log('═'.repeat(80))
console.log(`RESULTADO: ${pass} passou(aram) · ${fail} falhou(aram)`)
console.log('═'.repeat(80) + '\n')

if (fail > 0) process.exit(1)
console.log('✅ Bug do caso misto RESOLVIDO — Suco de maracujá agora obedece ordem!\n')
