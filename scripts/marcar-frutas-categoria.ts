// ============================================================
// scripts/marcar-frutas-categoria.ts
// ============================================================
// Marca preparações existentes com categoria FRUTA ou ACOMPANHAMENTO
// no banco, baseado em palavras-chave no nome.
//
// Isso é necessário porque v6 introduziu as categorias FRUTA e
// ACOMPANHAMENTO no enum. As preparações antigas ficaram com
// categoria='PREPARACAO' (default) — este script atualiza em massa.
//
// USO:
//   npx tsx scripts/marcar-frutas-categoria.ts            # DRY-RUN
//   npx tsx scripts/marcar-frutas-categoria.ts --apply    # APLICA
//
// O que o script faz:
//   1. Busca todas as preparações ATIVAS com categoria='PREPARACAO'
//   2. Para cada uma, checa o nome contra palavras-chave:
//      - Se parece fruta  → marca categoria='FRUTA'
//      - Se parece acompanhamento → marca categoria='ACOMPANHAMENTO'
//   3. Não toca em preparações que já têm categoria definida
//      (PAO, LANCHE, BEBIDA, SOBREMESA, FRUTA, ACOMPANHAMENTO)
//   4. Não marca proteínas, arroz, feijão (continuam PREPARACAO
//      porque a ordenação detecta por palavra-chave)
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

// Palavras-chave para detectar FRUTA (mesma lista do ordenacao-preparacoes.ts)
const KW_FRUTA = [
  'banana', 'maçã', 'mamão', 'mamao', 'laranja', 'abacaxi',
  'melancia', 'melão', 'melao', 'manga', 'uva', 'pera', 'pêssego',
  'pessego', 'goiaba', 'acerola', 'caju', 'cajá', 'caja', 'maracujá',
  'maracuja', 'fruta', 'salada de fruta', 'sorvete de frutas',
  'sorvete', 'frozen de', 'poncã', 'poncan', 'mexerica', 'caqui', 'seriguela',
  'pitaya',
]

// Palavras-chave para detectar ACOMPANHAMENTO (mesma lista do ordenacao-preparacoes.ts)
// Exclui 'arroz' e 'feijão' porque esses têm categoria própria por palavra-chave
const KW_ACOMPANHAMENTO = [
  'purê', 'pure', 'batata', 'legumes', 'legume', 'abóbora', 'abobora',
  'couve', 'repolho', 'quiabo', 'maxixe', 'chuchu',
  'farofa', 'polenta', 'mandioca', 'macarrão', 'macarrao', 'espaguete',
  'nhoque', 'lasanha', 'canjica', 'angu', 'creme de milho', 'creme de ervilha',
  'sopa de', 'caldo', 'curau', 'bolinho', 'fubá', 'fuba',
  'farinha de mandioca', 'virado', 'minestra', 'abobrinha', 'ervilha',
  'milho', 'flocos de milho', 'batata doce', 'batata-doce', 'batata sauté',
  'batata inglesa', 'legumes ao molho', 'legumes refogados',
  'abóbora refogada', 'abobora refogada', 'couve refogada',
  'repolho refogado', 'quiabo refogado',
  'arroz com feijão', 'arroz com feijao', 'arroz com cenoura',
  'arroz com abobrinha', 'arroz com lentilha', 'arroz alegria',
  'arroz colorido', 'arroz branco', 'arroz integral',
  'feijão tropeiro', 'feijao tropeiro', 'falso feijão',
  'creme de frango', 'misto quente', 'molho de tomate',
  'brócolis', 'brocolis', 'cenoura', 'vagem', 'lentilha',
  'macarrão de sopa', 'macarrao de sopa',
  // Saladas também entram como ACOMPANHAMENTO
  'salada', 'vinagrete', 'alface', 'acelga', 'rúcula', 'rucula',
]

// Palavras-chave que EXCLUEM classificação como FRUTA ou ACOMPANHAMENTO
// (porque podem ter a palavra mas são proteínas/bebidas)
const KW_EXCLUI_FRUTA = [
  'vitamina de',     // "Vitamina de banana" é bebida, não fruta
  'sopa de',         // "Sopa de mamão" não é fruta in natura
  'suco de',         // "Suco de laranja" é bebida
  'iogurte de',      // "Iogurte de morango" é bebida
  'leite com',       // "Leite com banana" é bebida
  'creme de',        // "Creme de frutas" é sobremesa
  'bolo de',         // "Bolo de banana" é sobremesa
  'pudim de',        // "Pudim de mamão" é sobremesa
  'gelatina de',     // "Gelatina de morango" é sobremesa
  'mingau de',       // "Mingau de aveia com banana" é bebida
]

function normalizarNome(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,\-.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectarFruta(nome: string): boolean {
  const n = normalizarNome(nome)
  if (KW_EXCLUI_FRUTA.some(kw => n.includes(kw))) return false
  return KW_FRUTA.some(kw => n.includes(kw))
}

function detectarAcompanhamento(nome: string): boolean {
  const n = normalizarNome(nome)
  return KW_ACOMPANHAMENTO.some(kw => n.includes(kw))
}

async function main() {
  console.log('\n' + '═'.repeat(80))
  console.log('🍎🥗 MARCAR FRUTAS E ACOMPANHAMENTOS')
  console.log(`   MODO: ${APLICAR ? '⛔ APLICANDO (write)' : '👀 DRY-RUN (somente leitura)'}`)
  console.log('═'.repeat(80) + '\n')

  // Buscar preparações ativas com categoria='PREPARACAO' (default)
  const preparacoes = await prisma.preparacao.findMany({
    where: {
      ativo: true,
      categoria: 'PREPARACAO',
    },
    select: {
      id: true,
      nome: true,
      categoria: true,
      _count: { select: { cardapio_itens: true } },
    },
    orderBy: { nome: 'asc' },
  })

  console.log(`📊 Total de preparações ativas com categoria='PREPARACAO': ${preparacoes.length}\n`)

  const paraFruta: typeof preparacoes = []
  const paraAcompanhamento: typeof preparacoes = []
  const semClassificacao: typeof preparacoes = []

  for (const p of preparacoes) {
    if (detectarFruta(p.nome)) {
      paraFruta.push(p)
    } else if (detectarAcompanhamento(p.nome)) {
      paraAcompanhamento.push(p)
    } else {
      semClassificacao.push(p)
    }
  }

  // Mostrar frutas que serão marcadas
  console.log('─'.repeat(80))
  console.log(`🍎 FRUTAS (serão marcadas): ${paraFruta.length}`)
  console.log('─'.repeat(80))
  for (const p of paraFruta) {
    console.log(`   • ${p.nome}  (usos: ${p._count.cardapio_itens})`)
  }
  console.log()

  // Mostrar acompanhamentos que serão marcados
  console.log('─'.repeat(80))
  console.log(`🥗 ACOMPANHAMENTOS (serão marcados): ${paraAcompanhamento.length}`)
  console.log('─'.repeat(80))
  for (const p of paraAcompanhamento) {
    console.log(`   • ${p.nome}  (usos: ${p._count.cardapio_itens})`)
  }
  console.log()

  // Mostrar preparações que NÃO serão classificadas (continuam PREPARACAO)
  console.log('─'.repeat(80))
  console.log(`🍽️ PREPARAÇÕES (continuam como PREPARACAO): ${semClassificacao.length}`)
  console.log('─'.repeat(80))
  if (semClassificacao.length <= 30) {
    for (const p of semClassificacao) {
      console.log(`   • ${p.nome}  (usos: ${p._count.cardapio_itens})`)
    }
  } else {
    for (const p of semClassificacao.slice(0, 15)) {
      console.log(`   • ${p.nome}  (usos: ${p._count.cardapio_itens})`)
    }
    console.log(`   ... e mais ${semClassificacao.length - 15}`)
  }
  console.log()

  if (!APLICAR) {
    console.log('═'.repeat(80))
    console.log('👀 DRY-RUN concluído — nada foi modificado.')
    console.log('   Para aplicar: npx tsx scripts/marcar-frutas-categoria.ts --apply')
    console.log('═'.repeat(80) + '\n')
    return
  }

  // APLICAR
  console.log('═'.repeat(80))
  console.log('⛔ APLICANDO...')
  console.log('═'.repeat(80) + '\n')

  let frutasOk = 0
  let acompOk = 0

  for (const p of paraFruta) {
    await prisma.preparacao.update({
      where: { id: p.id },
      data: { categoria: 'FRUTA' },
    })
    frutasOk++
  }
  console.log(`   ✓ ${frutasOk} preparações marcadas como FRUTA`)

  for (const p of paraAcompanhamento) {
    await prisma.preparacao.update({
      where: { id: p.id },
      data: { categoria: 'ACOMPANHAMENTO' },
    })
    acompOk++
  }
  console.log(`   ✓ ${acompOk} preparações marcadas como ACOMPANHAMENTO`)

  console.log('\n' + '═'.repeat(80))
  console.log('✅ CORREÇÃO APLICADA COM SUCESSO!')
  console.log('═'.repeat(80))
  console.log(`   Frutas marcadas: ${frutasOk}`)
  console.log(`   Acompanhamentos marcados: ${acompOk}`)
  console.log(`   Preparações que continuam como PREPARACAO: ${semClassificacao.length}`)
  console.log()
  console.log('🎉 PRÓXIMOS PASSOS:')
  console.log('   1. Abra /nutricao/preparacoes no navegador')
  console.log('   2. Verifique se as frutas estão marcadas como FRUTA')
  console.log('   3. Verifique se os acompanhamentos estão marcados como ACOMPANHAMENTO')
  console.log('   4. Abra um cardápio e clique em "Reordenar" no header da semana')
  console.log('   5. Confirme que a ordem ficou: bebida → pão → fruta /')
  console.log('      salada → arroz → feijão → proteína → acompanhamento → fruta')
  console.log('═'.repeat(80) + '\n')
}

main()
  .catch((e) => {
    console.error('\n❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
