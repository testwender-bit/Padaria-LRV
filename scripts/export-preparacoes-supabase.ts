// ============================================================
// scripts/export-preparacoes-supabase.ts
// ============================================================
// Exporta TODAS as preparações + ingredientes + percapitas do
// banco atual para um arquivo JSON.
//
// USO:
//   npx tsx scripts/export-preparacoes-supabase.ts
//
// Output: preparacoes-export.json
// ============================================================

import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('\n📤 Exportando preparações do Supabase...\n')

  const preparacoes = await prisma.preparacao.findMany({
    select: {
      id: true,
      nome: true,
      descricao: true,
      modo_preparo: true,
      ativo: true,
      favorita: true,
      vezes_usada: true,
      categoria: true,
      tags: true,
    },
    orderBy: { nome: 'asc' },
  })
  console.log(`  ✓ Preparações: ${preparacoes.length}`)

  const ingredientes = await prisma.preparacaoIngrediente.findMany({
    include: {
      alimento: {
        select: { id: true, nome: true, codigo_taco: true, grupo: true },
      },
      percapitas: true,
    },
    orderBy: [{ preparacao_id: 'asc' }, { alimento: { nome: 'asc' } }],
  })
  console.log(`  ✓ Ingredientes: ${ingredientes.length}`)

  const preparacoesComIngredientes = preparacoes.map(p => {
    const ings = ingredientes.filter(i => i.preparacao_id === p.id)
    return {
      ...p,
      ingredientes: ings.map(i => ({
        alimento_id: i.alimento_id,
        alimento_nome: i.alimento?.nome || '(órfão)',
        alimento_codigo_taco: i.alimento?.codigo_taco || null,
        alimento_grupo: i.alimento?.grupo || null,
        quantidade_gramas: i.quantidade_gramas,
        mesma_percapita: i.mesma_percapita,
        percapitas: i.percapitas.map(pc => ({
          fase_escolar: pc.fase_escolar,
          quantidade_gramas: pc.quantidade_gramas,
          auto_calculado: pc.auto_calculado,
        })),
      })),
    }
  })

  const comIngredientes = preparacoesComIngredientes.filter(p => p.ingredientes.length > 0)
  const semIngredientes = preparacoesComIngredientes.filter(p => p.ingredientes.length === 0)
  console.log(`  📊 COM ingredientes: ${comIngredientes.length}`)
  console.log(`  📊 SEM ingredientes: ${semIngredientes.length}`)

  const output = {
    _meta: {
      exportado_em: new Date().toISOString(),
      total_preparacoes: preparacoes.length,
      total_ingredientes: ingredientes.length,
      com_ingredientes: comIngredientes.length,
      sem_ingredientes: semIngredientes.length,
    },
    preparacoes: preparacoesComIngredientes,
    preparacoes_sem_ingredientes: semIngredientes.map(p => ({ id: p.id, nome: p.nome })),
  }

  const outputPath = 'preparacoes-export.json'
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`\n💾 Arquivo salvo: ${outputPath}`)
  console.log(`   Tamanho: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`)
}

main()
  .catch(async (err) => {
    console.error('❌ Erro:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
