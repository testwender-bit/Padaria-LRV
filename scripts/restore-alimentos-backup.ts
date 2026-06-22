// ============================================================
// scripts/restore-alimentos-backup.ts
// ============================================================
// Restaura o backup mais recente de alimentos + ingredientes.
// Usar em caso de problema após reset-populate-taco.ts.
//
// USO:
//   npx tsx scripts/restore-alimentos-backup.ts
// ============================================================

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('\n🔄 RESTORE — Restaurando backup mais recente\n')

  const backupDir = '/tmp'
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-alimentos-') && f.endsWith('.json'))
    .map(f => ({ file: f, path: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

  if (backups.length === 0) {
    console.error('❌ Nenhum backup encontrado em /tmp/backup-alimentos-*.json')
    process.exit(1)
  }

  const backup = backups[0]
  console.log(`📂 Backup: ${backup.file}`)
  const data = JSON.parse(fs.readFileSync(backup.path, 'utf-8'))

  console.log(`📊 Alimentos no backup: ${data.alimentos.length}`)
  console.log(`📊 Ingredientes no backup: ${data.ingredientes?.length || 0}`)

  // 1. Deletar ingredientes atuais (podem ter alimento_id órfãos)
  console.log('\n── Limpando ingredientes atuais ──')
  const delIng = await prisma.preparacaoIngrediente.deleteMany({})
  console.log(`  ✓ ${delIng.count} ingredientes removidos`)

  // 2. Deletar alimentos atuais
  console.log('\n── Limpando alimentos atuais ──')
  const delAl = await prisma.alimento.deleteMany({})
  console.log(`  ✓ ${delAl.count} alimentos removidos`)

  // 3. Recriar alimentos do backup
  console.log('\n── Recriando alimentos do backup ──')
  let count = 0
  for (const al of data.alimentos) {
    await prisma.alimento.create({
      data: {
        id: al.id,
        codigo_taco: al.codigo_taco,
        nome: al.nome,
        grupo: al.grupo,
        medida_caseira: al.medida_caseira,
        gramas_por_medida: al.gramas_por_medida,
        energia_kcal: al.energia_kcal,
        carboidratos_g: al.carboidratos_g,
        proteinas_g: al.proteinas_g,
        lipidios_g: al.lipidios_g,
        fibra_alimentar_g: al.fibra_alimentar_g,
        sodio_mg: al.sodio_mg,
        ferro_mg: al.ferro_mg,
        ferro_heme_mg: al.ferro_heme_mg,
        vitamina_a_mcg: al.vitamina_a_mcg,
        vitamina_c_mg: al.vitamina_c_mg,
        calcio_mg: al.calcio_mg,
        magnesio_mg: al.magnesio_mg,
        zinco_mg: al.zinco_mg,
        acucar_adicionado_g: al.acucar_adicionado_g,
        ativo: al.ativo,
      },
    })
    count++
    if (count % 50 === 0) console.log(`  ... ${count}/${data.alimentos.length}`)
  }
  console.log(`  ✓ ${count} alimentos recriados`)

  // 4. Recriar ingredientes do backup (se existirem)
  if (data.ingredientes && data.ingredientes.length > 0) {
    console.log('\n── Recriando ingredientes do backup ──')
    let ingCount = 0
    for (const ing of data.ingredientes) {
      // Verificar se a preparação ainda existe
      const prepExiste = await prisma.preparacao.findUnique({
        where: { id: ing.preparacao_id },
        select: { id: true },
      })
      if (!prepExiste) continue

      // Verificar se o alimento existe
      const alExiste = await prisma.alimento.findUnique({
        where: { id: ing.alimento_id },
        select: { id: true },
      })
      if (!alExiste) continue

      await prisma.preparacaoIngrediente.create({
        data: {
          preparacao_id: ing.preparacao_id,
          alimento_id: ing.alimento_id,
          quantidade_gramas: ing.quantidade_gramas,
          mesma_percapita: ing.mesma_percapita,
        },
      })
      ingCount++
    }
    console.log(`  ✓ ${ingCount} ingredientes recriados`)
  }

  // 5. Validação
  const totalAl = await prisma.alimento.count()
  const totalIng = await prisma.preparacaoIngrediente.count()
  console.log('\n' + '═'.repeat(70))
  console.log('✅ RESTORE CONCLUÍDO')
  console.log('═'.repeat(70))
  console.log(`  Alimentos: ${totalAl}`)
  console.log(`  Ingredientes: ${totalIng}`)
}

main()
  .catch(async (err) => {
    console.error('❌ Erro fatal:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
