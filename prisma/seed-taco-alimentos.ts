// ============================================================
// SEED — Importar TODOS os 597 alimentos da TACO
// Rodar separadamente: npx tsx prisma/seed-taco-alimentos.ts
// ============================================================
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import tacoData from '../taco_complete.json'

// Resolve path do banco (relativo à raiz do projeto)
const dbPath = path.resolve(process.cwd(), 'db', 'custom.db')
const dbDir = path.dirname(dbPath)

// Cria diretório db/ se não existir
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
  console.log(`  ✓ Diretório criado: ${dbDir}`)
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
})

interface TacoItem {
  codigo_taco: number
  nome: string
  grupo: string
  medida_caseira: string
  gramas_por_medida: number
  energia_kcal: number
  carboidratos_g: number
  proteinas_g: number
  lipidios_g: number
  fibra_alimentar_g: number
  sodio_mg: number
  ferro_mg: number
  vitamina_a_mcg: number
  vitamina_c_mg: number
  calcio_mg: number
  magnesio_mg: number
  zinco_mg: number
  acucar_adicionado_g?: number
}

async function upsertAlimento(item: TacoItem) {
  const existing = await prisma.alimento.findFirst({
    where: { codigo_taco: item.codigo_taco },
  })

  const data = {
    codigo_taco: item.codigo_taco,
    nome: item.nome,
    grupo: item.grupo,
    medida_caseira: item.medida_caseira,
    gramas_por_medida: item.gramas_por_medida,
    energia_kcal: item.energia_kcal,
    carboidratos_g: item.carboidratos_g,
    proteinas_g: item.proteinas_g,
    lipidios_g: item.lipidios_g,
    fibra_alimentar_g: item.fibra_alimentar_g,
    sodio_mg: item.sodio_mg,
    ferro_mg: item.ferro_mg,
    ferro_heme_mg: 0,
    vitamina_a_mcg: item.vitamina_a_mcg,
    vitamina_c_mg: item.vitamina_c_mg,
    calcio_mg: item.calcio_mg,
    magnesio_mg: item.magnesio_mg,
    zinco_mg: item.zinco_mg,
    acucar_adicionado_g: item.acucar_adicionado_g ?? 0,
    ativo: true,
  }

  if (existing) {
    return prisma.alimento.update({
      where: { id: existing.id },
      data,
    })
  }
  return prisma.alimento.create({ data })
}

async function main() {
  console.log(`🌱 Importando ${tacoData.length} alimentos da TACO...`)

  let created = 0
  let updated = 0
  let errors = 0

  // Process in batches of 50 to avoid memory/connection issues
  const batchSize = 50
  for (let i = 0; i < tacoData.length; i += batchSize) {
    const batch = tacoData.slice(i, i + batchSize) as TacoItem[]
    for (const item of batch) {
      try {
        const existing = await prisma.alimento.findFirst({
          where: { codigo_taco: item.codigo_taco },
        })
        if (existing) {
          updated++
        } else {
          created++
        }
        await upsertAlimento(item)
      } catch (err: any) {
        errors++
        console.error(`  ✗ Erro #${item.codigo_taco} "${item.nome}": ${err.message}`)
      }
    }
    const progress = Math.min(i + batchSize, tacoData.length)
    process.stdout.write(`  → ${progress}/${tacoData.length} processados\r`)
  }

  console.log('')
  console.log(`  ✓ ${created} criados, ${updated} atualizados, ${errors} erros`)
  console.log(`  ✓ Total no banco: ${created + updated} alimentos`)

  // Verify
  const total = await prisma.alimento.count()
  console.log(`  ✓ Contagem no banco: ${total} alimentos`)
}

main()
  .catch((e) => {
    console.error('Erro no seed TACO:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
