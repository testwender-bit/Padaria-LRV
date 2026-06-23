// ============================================================
// scripts/export-taco-sistema.ts
// ============================================================
// Exporta TODOS os alimentos (TACO + custom) do banco atual
// para um arquivo JSON. Útil para análise e mapeamento.
//
// USO:
//   npx tsx scripts/export-taco-sistema.ts
//
// Output: taco-sistema-export.json
// ============================================================

import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('\n📤 Exportando alimentos do Supabase...\n')

  const alimentos = await prisma.alimento.findMany({
    orderBy: [{ codigo_taco: 'asc' }, { nome: 'asc' }],
  })
  console.log(`  ✓ Alimentos: ${alimentos.length}`)

  // Estatísticas
  const comTaco = alimentos.filter(a => a.codigo_taco !== null).length
  const semTaco = alimentos.filter(a => a.codigo_taco === null).length
  const cozidos = alimentos.filter(a => /cozid[oa]/i.test(a.nome)).length
  const crus = alimentos.filter(a => /\bcru[ao]?\b/i.test(a.nome)).length

  console.log(`  📊 Com codigo_taco: ${comTaco}`)
  console.log(`  📊 Sem codigo_taco (custom): ${semTaco}`)
  console.log(`  📊 Cozidos: ${cozidos}`)
  console.log(`  📊 Crus: ${crus}`)

  // Agrupar por grupo
  const porGrupo: Record<string, number> = {}
  for (const a of alimentos) porGrupo[a.grupo] = (porGrupo[a.grupo] || 0) + 1
  console.log(`\n  📊 Por grupo:`)
  for (const [g, c] of Object.entries(porGrupo).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${g.padEnd(40)} ${c}`)
  }

  const output = {
    _meta: {
      exportado_em: new Date().toISOString(),
      total_alimentos: alimentos.length,
      com_taco: comTaco,
      sem_taco: semTaco,
      cozidos: cozidos,
      crus: crus,
    },
    alimentos: alimentos.map(a => ({
      id: a.id,
      codigo_taco: a.codigo_taco,
      nome: a.nome,
      grupo: a.grupo,
      medida_caseira: a.medida_caseira,
      gramas_por_medida: a.gramas_por_medida,
      energia_kcal: a.energia_kcal,
      carboidratos_g: a.carboidratos_g,
      proteinas_g: a.proteinas_g,
      lipidios_g: a.lipidios_g,
      fibra_alimentar_g: a.fibra_alimentar_g,
      sodio_mg: a.sodio_mg,
      ferro_mg: a.ferro_mg,
      ferro_heme_mg: a.ferro_heme_mg,
      vitamina_a_mcg: a.vitamina_a_mcg,
      vitamina_c_mg: a.vitamina_c_mg,
      calcio_mg: a.calcio_mg,
      magnesio_mg: a.magnesio_mg,
      zinco_mg: a.zinco_mg,
      acucar_adicionado_g: a.acucar_adicionado_g,
      ativo: a.ativo,
    })),
  }

  const outputPath = 'taco-sistema-export.json'
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
