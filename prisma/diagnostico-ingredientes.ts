// ============================================================
// diagnostico-ingredientes.ts
// ============================================================
// Lista todos os ingredientes cadastrados nas Preparacoes
// que NÃO têm alimento correspondente no banco (por ID).
// Também lista alimentos cadastrados por grupo para inspeção.
//
// Rodar: npx tsx prisma/diagnostico-ingredientes.ts
// ============================================================
import { PrismaClient } from '@prisma/client'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'db', 'custom.db')
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
})

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  DIAGNÓSTICO DE INGREDIENTES — Padaria LRV')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')

  // 1. Total de alimentos
  const totalAlimentos = await prisma.alimento.count()
  console.log(`📦 Total de alimentos no banco: ${totalAlimentos}`)

  // 2. Resumo por grupo
  const grupos = await prisma.alimento.groupBy({
    by: ['grupo'],
    _count: { grupo: true },
    orderBy: { _count: { grupo: 'desc' } },
  })
  console.log('')
  console.log('=== Alimentos por grupo ===')
  for (const g of grupos) {
    console.log(`  ${g._count.grupo.toString().padStart(3)} - ${g.grupo}`)
  }

  // 3. Total de preparações
  const totalPrep = await prisma.preparacao.count()
  console.log('')
  console.log(`🍳 Total de preparações: ${totalPrep}`)

  // 4. Total de ingredientes em preparações
  const totalIng = await prisma.preparacaoIngrediente.count()
  console.log(`🥕 Total de ingredientes em preparações: ${totalIng}`)

  // 5. Ingredientes ÓRFÃOS (alimento_id que não existe mais)
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  INGREDIENTES ÓRFÃOS (alimento_id não existe mais)')
  console.log('═══════════════════════════════════════════════════════')

  const ingredientes = await prisma.preparacaoIngrediente.findMany({
    include: {
      alimento: { select: { id: true, nome: true, grupo: true } },
      preparacao: { select: { id: true, nome: true } },
    },
  })

  const orfaos = ingredientes.filter((i) => !i.alimento)
  if (orfaos.length === 0) {
    console.log('  ✅ Nenhum ingrediente órfão encontrado.')
  } else {
    console.log(`  ❌ ${orfaos.length} ingrediente(s) órfão(s):`)
    for (const o of orfaos) {
      console.log(`     - Prep "${o.preparacao.nome}" → alimento_id: ${o.alimento_id}`)
    }
  }

  // 6. Busca por nomes de alimentos que PODEM estar faltando
  // Verifica se existem alimentos com nomes comuns na culinária brasileira
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  VERIFICAÇÃO DE ITENS COMUNS (devem existir)')
  console.log('═══════════════════════════════════════════════════════')

  const checker = [
    'tomate', 'pepino', 'alho-poró', 'salsão', 'aipo',
    'batata-doce', 'moranga', 'cabotiá', 'chuchu', 'maxixe', 'quiabo', 'jiló',
    'manjericão', 'orégano', 'alecrim', 'tomilho', 'sálvia', 'louro',
    'coentro', 'salsinha', 'cebolinha',
    'azeite', 'margarina', 'banha', 'óleo de girassol', 'óleo de soja', 'óleo de milho',
    'coxão', 'patinho', 'fraldinha', 'acém', 'moela', 'fígado',
    'mamão', 'acerola', 'caju', 'cajá', 'seriguela',
    'cacau', 'café',
    'cominho', 'páprica', 'canela', 'noz-moscada', 'cravo', 'cúrcuma', 'açafrão',
  ]

  const todosAlimentos = await prisma.alimento.findMany({
    where: { ativo: true },
    select: { nome: true, grupo: true },
  })
  const nomesLower = todosAlimentos.map((a) => a.nome.toLowerCase())

  let faltando = 0
  for (const busca of checker) {
    const existe = nomesLower.some((n) => n.includes(busca))
    if (!existe) {
      console.log(`  ❌ FALTANDO: ${busca}`)
      faltando++
    }
  }
  console.log('')
  console.log(`Total faltando: ${faltando} de ${checker.length}`)

  if (faltando === 0) {
    console.log('  ✅ Todos os itens comuns estão cadastrados!')
  } else {
    console.log('  ⚠️  Rode: npx tsx prisma/seed-taco-complementar.ts')
  }
}

main()
  .catch((e) => {
    console.error('Erro no diagnóstico:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
