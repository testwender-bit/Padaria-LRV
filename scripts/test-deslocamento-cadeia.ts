// ============================================================
// scripts/test-deslocamento-cadeia.ts
// ============================================================
// Testa a nova lógica de DESLOCAMENTO EM CADEIA da replicação.
//
// Cenário: base tem pão na terça, escola quer pão na sexta.
//   Cadeia esperada:
//   - Pão da terça → sexta
//   - Comida da sexta → quinta
//   - Comida da quinta → quarta
//   - Comida da quarta → terça (preenche o buraco)
//   Resultado: nenhum dia vazio, pão na sexta, todos com comida.
//
// Como o teste unitário da função realocarComDeslocamento exigiria
// simular Prisma transaction, este teste valida a LÓGICA da cadeia
// em memória, usando a mesma estrutura que a função usa.
//
// USO:
//   npx tsx scripts/test-deslocamento-cadeia.ts
// ============================================================

const ORDEM_DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

// Simula um dia com seus itens
interface ItemSimples {
  preparacao: string
  tipo_refeicao: string
}
type Dia = { dia: string; itens: ItemSimples[] }

// Snapshot do conteúdo de cada dia da cadeia
type Snapshot = Record<string, ItemSimples[]>

/**
 * Simula a lógica de deslocamento em cadeia (mesma da função real).
 * Recebe o estado atual de todos os dias, e devolve o novo estado
 * após o deslocamento.
 */
function realocarCadeia(
  dias: Record<string, ItemSimples[]>,
  diaOrigem: string,
  diaDestino: string,
  diasBloqueados: Set<string>
): Record<string, ItemSimples[]> {
  const resultado: Record<string, ItemSimples[]> = { ...dias }

  const idxOrigem = ORDEM_DIAS.indexOf(diaOrigem)
  const idxDestino = ORDEM_DIAS.indexOf(diaDestino)
  if (idxOrigem === -1 || idxDestino === -1) return resultado
  if (idxOrigem === idxDestino) return resultado

  // Verifica intermediários bloqueados
  const intermediariosBloqueados: string[] = []
  if (idxDestino > idxOrigem) {
    for (let i = idxOrigem + 1; i < idxDestino; i++) {
      if (diasBloqueados.has(ORDEM_DIAS[i])) {
        intermediariosBloqueados.push(ORDEM_DIAS[i])
      }
    }
  } else if (idxDestino < idxOrigem) {
    for (let i = idxOrigem - 1; i > idxDestino; i--) {
      if (diasBloqueados.has(ORDEM_DIAS[i])) {
        intermediariosBloqueados.push(ORDEM_DIAS[i])
      }
    }
  }

  // Se há intermediários bloqueados, faz swap puro
  if (intermediariosBloqueados.length > 0) {
    const tmp = resultado[diaOrigem]
    resultado[diaOrigem] = resultado[diaDestino]
    resultado[diaDestino] = tmp
    return resultado
  }

  // Constrói cadeia
  const cadeia: string[] = [diaOrigem]
  if (idxDestino > idxOrigem) {
    for (let i = idxOrigem + 1; i <= idxDestino; i++) cadeia.push(ORDEM_DIAS[i])
  } else {
    for (let i = idxOrigem - 1; i >= idxDestino; i--) cadeia.push(ORDEM_DIAS[i])
  }

  // Snapshot
  const snapshot: Snapshot = {}
  for (const dia of cadeia) {
    snapshot[dia] = [...(dias[dia] || [])]
  }

  // Reatribui: cada dia recebe conteúdo do dia SEGUINTE da cadeia (circular)
  for (let i = 0; i < cadeia.length; i++) {
    const diaAtual = cadeia[i]
    const diaProximo = cadeia[(i + 1) % cadeia.length]
    resultado[diaAtual] = [...(snapshot[diaProximo] || [])]
  }

  return resultado
}

// ── Helpers para os testes ──
function item(prep: string): ItemSimples {
  return { preparacao: prep, tipo_refeicao: 'LANCHE' }
}

function comparar(
  descricao: string,
  obtido: Record<string, ItemSimples[]>,
  esperado: Record<string, ItemSimples[]>
): boolean {
  let ok = true
  for (const dia of ORDEM_DIAS) {
    const obt = (obtido[dia] || []).map(i => i.preparacao).join(', ')
    const esp = (esperado[dia] || []).map(i => i.preparacao).join(', ')
    if (obt !== esp) {
      ok = false
      break
    }
  }
  console.log(`${ok ? '✅' : '❌'} ${descricao}`)
  for (const dia of ORDEM_DIAS) {
    const obt = (obtido[dia] || []).map(i => i.preparacao).join(', ') || '(vazio)'
    const esp = (esperado[dia] || []).map(i => i.preparacao).join(', ') || '(vazio)'
    const simbolo = obt === esp ? '  ' : '❌'
    console.log(`   ${simbolo} ${dia.padEnd(8)} obtido: ${obt.padEnd(30)}  esperado: ${esp}`)
  }
  console.log()
  return ok
}

let pass = 0
let fail = 0

function rodar(descricao: string, dias: Record<string, ItemSimples[]>, origem: string, destino: string, bloqueados: Set<string>, esperado: Record<string, ItemSimples[]>) {
  const obtido = realocarCadeia(dias, origem, destino, bloqueados)
  if (comparar(descricao, obtido, esperado)) pass++
  else fail++
}

// ─── TESTES ──────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(80))
console.log('🧪 TESTE DO DESLOCAMENTO EM CADEIA (v6.3)')
console.log('═'.repeat(80) + '\n')

// Teste 1: Cadeia simples terça→sexta (pão na terça, comida na sexta)
//   Cadeia: [terça, quarta, quinta, sexta]
//   - terça recebe conteúdo da quarta
//   - quarta recebe conteúdo da quinta
//   - quinta recebe conteúdo da sexta
//   - sexta recebe conteúdo da terça (pão) ✅
rodar(
  'Caso do usuário: pão na terça → sexta (cadeia completa)',
  {
    segunda: [],
    terca: [item('Pão com manteiga')],           // só pão
    quarta: [item('Arroz'), item('Feijão'), item('Carne')],
    quinta: [item('Arroz'), item('Feijão'), item('Frango')],
    sexta: [item('Arroz'), item('Feijão'), item('Peixe')],
  },
  'terca',
  'sexta',
  new Set(['terca', 'sexta']),
  {
    segunda: [],
    terca: [item('Arroz'), item('Feijão'), item('Carne')],      // recebeu da quarta
    quarta: [item('Arroz'), item('Feijão'), item('Frango')],    // recebeu da quinta
    quinta: [item('Arroz'), item('Feijão'), item('Peixe')],     // recebeu da sexta
    sexta: [item('Pão com manteiga')],                          // recebeu da terça ✅
  }
)

// Teste 2: Cadeia inversa sexta→terça (pão na sexta, escola quer na terça)
//   Cadeia: [sexta, quinta, quarta, terça]
rodar(
  'Cadeia inversa: pão na sexta → terça',
  {
    segunda: [],
    terca: [item('Arroz'), item('Carne')],
    quarta: [item('Arroz'), item('Frango')],
    quinta: [item('Arroz'), item('Peixe')],
    sexta: [item('Pão com manteiga')],           // só pão
  },
  'sexta',
  'terca',
  new Set(['sexta', 'terca']),
  {
    segunda: [],
    terca: [item('Pão com manteiga')],                          // recebeu da sexta ✅
    quarta: [item('Arroz'), item('Carne')],                     // recebeu da terça
    quinta: [item('Arroz'), item('Frango')],                    // recebeu da quarta
    sexta: [item('Arroz'), item('Peixe')],                      // recebeu da quinta
  }
)

// Teste 3: Cadeia curta quarta→sexta (3 dias)
//   Cadeia: [quarta, quinta, sexta]
rodar(
  'Cadeia curta: pão na quarta → sexta (3 dias)',
  {
    segunda: [],
    terca: [item('Comida terça')],
    quarta: [item('Pão com manteiga')],
    quinta: [item('Comida quinta')],
    sexta: [item('Comida sexta')],
  },
  'quarta',
  'sexta',
  new Set(['quarta', 'sexta']),
  {
    segunda: [],
    terca: [item('Comida terça')],          // não mudou (fora da cadeia)
    quarta: [item('Comida quinta')],        // recebeu da quinta
    quinta: [item('Comida sexta')],         // recebeu da sexta
    sexta: [item('Pão com manteiga')],      // recebeu da quarta ✅
  }
)

// Teste 4: Dias adjacentes (terça→quarta) — cadeia mínima
//   Cadeia: [terça, quarta] — só 2 dias = swap puro
rodar(
  'Dias adjacentes: pão na terça → quarta (cadeia mínima)',
  {
    segunda: [],
    terca: [item('Pão')],
    quarta: [item('Comida')],
    quinta: [item('Outra comida')],
    sexta: [item('Mais comida')],
  },
  'terca',
  'quarta',
  new Set(['terca', 'quarta']),
  {
    segunda: [],
    terca: [item('Comida')],     // recebeu da quarta
    quarta: [item('Pão')],        // recebeu da terça ✅
    quinta: [item('Outra comida')],
    sexta: [item('Mais comida')],
  }
)

// Teste 5: Intermediário bloqueado → swap puro
//   Pão na terça → sexta, mas lanche na quinta (quinta bloqueada)
//   Cadeia teria [terça, quarta, quinta, sexta] mas quinta está bloqueada
//   → swap puro: terça↔sexta
rodar(
  'Intermediário bloqueado → swap puro (terça↔sexta)',
  {
    segunda: [],
    terca: [item('Pão')],
    quarta: [item('Comida quarta')],
    quinta: [item('Lanche especial')],   // bloqueado
    sexta: [item('Comida sexta')],
  },
  'terca',
  'sexta',
  new Set(['terca', 'sexta', 'quinta']),  // quinta bloqueada
  {
    segunda: [],
    terca: [item('Comida sexta')],   // swap: recebeu da sexta
    quarta: [item('Comida quarta')],  // não mudou
    quinta: [item('Lanche especial')], // não mudou (bloqueado)
    sexta: [item('Pão')],              // swap: recebeu da terça ✅
  }
)

// Teste 6: Dia destino vazio (sem comida)
//   Pão na terça → sexta, mas sexta está vazia
//   Cadeia: [terça, quarta, quinta, sexta]
//   - terça recebe da quarta
//   - quarta recebe da quinta
//   - quinta recebe da sexta (vazio → fica vazia)
//   - sexta recebe da terça (pão) ✅
rodar(
  'Dia destino vazio: pão na terça → sexta vazia',
  {
    segunda: [],
    terca: [item('Pão')],
    quarta: [item('Comida quarta')],
    quinta: [item('Comida quinta')],
    sexta: [],   // vazio
  },
  'terca',
  'sexta',
  new Set(['terca', 'sexta']),
  {
    segunda: [],
    terca: [item('Comida quarta')],  // recebeu da quarta
    quarta: [item('Comida quinta')], // recebeu da quinta
    quinta: [],                       // recebeu da sexta (vazio)
    sexta: [item('Pão')],             // recebeu da terça ✅
  }
)

console.log('═'.repeat(80))
console.log(`RESULTADO: ${pass} passou(aram) · ${fail} falhou(aram)`)
console.log('═'.repeat(80) + '\n')

if (fail > 0) process.exit(1)
console.log('✅ Todos os cenários de deslocamento em cadeia funcionando!\n')
