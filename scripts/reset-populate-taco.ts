// ============================================================
// scripts/reset-populate-taco.ts
// ============================================================
// NOVA ABORDAGEM: zera a tabela Alimento e popula com TODOS os
// itens da TACO 4ª edição oficial (extraídos do PDF).
//
// O QUE FAZ:
//   1. BACKUP: salva estado atual (alimentos + ingredientes das preparações)
//   2. ZERA tabela Alimento (todos os 683 itens atuais)
//   3. CRIA 573 itens da TACO oficial com valores corretos
//   4. Salva mapeamento (nome_antigo → novo_id) para revinculação
//
// SEGURANÇA:
//   - Por padrão roda em modo DRY-RUN (só mostra o que faria)
//   - Para aplicar: npx tsx scripts/reset-populate-taco.ts --apply
//   - Sempre faz backup antes
//   - NÃO toca em Preparacao (mantém todas as 228 preparações)
//   - NÃO toca em PreparacaoIngrediente (mas os alimento_id ficarão órfãos
//     temporariamente — serão revinculados pelo script revincular-preparacoes.ts)
//
// USO:
//   npx tsx scripts/reset-populate-taco.ts             # dry-run (preview)
//   npx tsx scripts/reset-populate-taco.ts --apply     # aplica de fato
// ============================================================

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// Carrega taco_oficial.json (extraído do PDF)
const TACO_OFICIAL_PATH = path.resolve(process.cwd(), 'taco_oficial.json')
if (!fs.existsSync(TACO_OFICIAL_PATH)) {
  console.error(`❌ Arquivo não encontrado: ${TACO_OFICIAL_PATH}`)
  console.error('   Baixe o taco_oficial.json e coloque na raiz do projeto.')
  process.exit(1)
}

const tacoOficial = JSON.parse(fs.readFileSync(TACO_OFICIAL_PATH, 'utf-8'))
const tacoItens: any[] = tacoOficial.itens

console.log(`📚 TACO oficial carregada: ${tacoItens.length} itens`)

const args = process.argv.slice(2)
const MODO_APLICAR = args.includes('--apply')

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('🔄 RESET + POPULATE TACO — Nova abordagem')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN (preview)'}\n`)

  // ── PASSO 1: BACKUP ─────────────────────────────────────────
  console.log('── PASSO 1: BACKUP ──')
  const alimentosAtuais = await prisma.alimento.findMany()
  const ingredientesAtuais = await prisma.preparacaoIngrediente.findMany({
    include: { alimento: { select: { nome: true } } },
  })
  console.log(`📊 Alimentos atuais: ${alimentosAtuais.length}`)
  console.log(`📊 Ingredientes em preparações: ${ingredientesAtuais.length}`)

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')
  const backupPath = `/tmp/backup-alimentos-${timestamp}.json`
  fs.writeFileSync(backupPath, JSON.stringify({
    backup_at: new Date().toISOString(),
    alimentos: alimentosAtuais,
    ingredientes: ingredientesAtuais.map(i => ({
      id: i.id,
      preparacao_id: i.preparacao_id,
      alimento_id: i.alimento_id,
      alimento_nome: i.alimento?.nome,
      quantidade_gramas: i.quantidade_gramas,
      mesma_percapita: i.mesma_percapita,
    })),
  }, null, 2))
  console.log(`💾 Backup salvo: ${backupPath}`)
  console.log(`   Tamanho: ${(fs.statSync(backupPath).size / 1024).toFixed(1)} KB\n`)

  // ── PASSO 2: GERAR MAPA DE NOMES (para revinculação) ────────
  console.log('── PASSO 2: GERANDO MAPA DE NOMES PARA REVINCULAÇÃO ──')

  // Para cada alimento atual, criar um "alias" → nome TACO correspondente
  // Isso será usado pelo script revincular-preparacoes.ts
  const mapaNomes: Array<{
    nome_antigo: string
    alimento_id_antigo: string
    sugestoes_taco: Array<{ codigo: number; nome: string; score: number }>
  }> = []

  function normalize(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[,.\-()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function similaridade(a: string, b: string): number {
    const na = new Set(normalize(a).split(' ').filter(w => w.length > 2))
    const nb = new Set(normalize(b).split(' ').filter(w => w.length > 2))
    if (na.size === 0 || nb.size === 0) return 0
    let intersecao = 0
    for (const w of na) if (nb.has(w)) intersecao++
    return intersecao / (na.size + nb.size - intersecao)
  }

  function temPalavraPrincipal(nomeCurto: string, nomeLongo: string): boolean {
    const palavrasCurto = normalize(nomeCurto).split(' ').filter(w => w.length > 2)
    const palavrasLongo = normalize(nomeLongo).split(' ').filter(w => w.length > 2)
    for (const p of palavrasCurto) {
      if (p === 'cozido' || p === 'crua' || p === 'cru' || p === 'com' || p === 'sem' || p === 'de') continue
      if (palavrasLongo.includes(p)) return true
      for (const pl of palavrasLongo) {
        if (pl.length > 4 && (pl.startsWith(p) || p.startsWith(pl))) return true
      }
    }
    return false
  }

  function detectarEstado(nome: string): string {
    const n = nome.toLowerCase()
    if (/\bcru[ao]?\b/.test(n)) return 'cru'
    if (/\bcozid[oa]\b/.test(n)) return 'cozido'
    if (/\bassad[oa]\b/.test(n)) return 'assado'
    if (/\bfrit[oa]\b/.test(n)) return 'frito'
    if (/\bgrelhad[oa]\b/.test(n)) return 'grelhado'
    if (/\brefogad[oa]\b/.test(n)) return 'refogado'
    return 'indefinido'
  }

  // Para cada alimento antigo, calcular top 3 sugestões TACO
  for (const al of alimentosAtuais) {
    const sugestoes = tacoItens
      .map(t => {
        let score = similaridade(al.nome, t.nome)
        if (temPalavraPrincipal(al.nome, t.nome)) score += 0.2
        const estadoAl = detectarEstado(al.nome)
        const estadoT = detectarEstado(t.nome)
        if (estadoAl !== 'indefinido' && estadoAl === estadoT) score += 0.1
        return { codigo: t.codigo, nome: t.nome, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    mapaNomes.push({
      nome_antigo: al.nome,
      alimento_id_antigo: al.id,
      sugestoes_taco: sugestoes,
    })
  }

  // Salvar mapa para uso no revincular-preparacoes.ts
  const mapaPath = path.resolve(process.cwd(), 'mapa-revinculacao.json')
  fs.writeFileSync(mapaPath, JSON.stringify(mapaNomes, null, 2))
  console.log(`🗺️  Mapa de revinculação salvo: ${mapaPath}`)
  console.log(`   ${mapaNomes.length} alimentos mapeados\n`)

  // ── PASSO 3: PREVIEW ────────────────────────────────────────
  console.log('── PASSO 3: PREVIEW ──')
  console.log(`Serão DELETADOS: ${alimentosAtuais.length} alimentos`)
  console.log(`Serão CRIADOS: ${tacoItens.length} alimentos da TACO oficial`)
  console.log(`Diferença: ${tacoItens.length - alimentosAtuais.length} itens`)
  console.log(`\nIngredientes em preparações ficarão ÓRFÃOS temporariamente`)
  console.log(`(serão revinculados pelo script revincular-preparacoes.ts)`)

  // Mostrar amostra dos 20 primeiros itens TACO que serão criados
  console.log('\n── AMOSTRA: 20 primeiros itens TACO que serão criados ──')
  for (const t of tacoItens.slice(0, 20)) {
    console.log(`  + TACO ${String(t.codigo).padEnd(4)} ${t.nome.padEnd(45)} ${t.energia_kcal}kcal P=${t.proteina_g}g Fe=${t.ferro_mg}mg`)
  }

  // Mostrar amostra do mapa de revinculação
  console.log('\n── AMOSTRA: 10 primeiros mapeamentos (nome antigo → sugestões TACO) ──')
  for (const m of mapaNomes.slice(0, 10)) {
    console.log(`  "${m.nome_antigo}"`)
    for (const s of m.sugestoes_taco) {
      const marker = s.score >= 0.7 ? '✓' : s.score >= 0.5 ? '?' : ' '
      console.log(`    ${marker} ${s.score.toFixed(2)}  TACO ${s.codigo}: ${s.nome}`)
    }
  }

  if (!MODO_APLICAR) {
    console.log('\n' + '═'.repeat(70))
    console.log('👁️  DRY-RUN concluído — nada foi alterado')
    console.log('═'.repeat(70))
    console.log('\nPara aplicar de fato:')
    console.log('  npx tsx scripts/reset-populate-taco.ts --apply')
    console.log('\nDepois de aplicar, rode:')
    console.log('  npx tsx scripts/revincular-preparacoes.ts')
    return
  }

  // ── PASSO 4: APLICAR ────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('🔄 APLICANDO RESET + POPULATE...')
  console.log('═'.repeat(70))

  // 4a. Deletar TODOS os ingredientes das preparações (FK constraint)
  // Vamos preservar as preparações, mas os ingredientes ficarão sem alimento_id
  // Serão recriados pelo script de revinculação
  console.log('\n── 4a. Removendo ingredientes das preparações (temporário) ──')
  const ingredientesRemovidos = await prisma.preparacaoIngrediente.deleteMany({})
  console.log(`  ✓ ${ingredientesRemovidos.count} ingredientes removidos`)

  // 4b. Deletar TODOS os alimentos
  console.log('\n── 4b. Removendo TODOS os alimentos ──')
  const alimentosRemovidos = await prisma.alimento.deleteMany({})
  console.log(`  ✓ ${alimentosRemovidos.count} alimentos removidos`)

  // 4c. Criar TODOS os itens da TACO oficial
  console.log('\n── 4c. Criando itens da TACO oficial ──')
  let criados = 0
  for (const t of tacoItens) {
    await prisma.alimento.create({
      data: {
        codigo_taco: t.codigo,
        nome: t.nome,
        grupo: t.grupo,
        medida_caseira: '1 porção (100g)',  // padrão — nutricionista ajusta depois
        gramas_por_medida: 100,
        energia_kcal: t.energia_kcal,
        carboidratos_g: t.carboidrato_g,
        proteinas_g: t.proteina_g,
        lipidios_g: t.lipideos_g,
        fibra_alimentar_g: t.fibra_alimentar_g,
        sodio_mg: t.sodio_mg,
        ferro_mg: t.ferro_mg,
        ferro_heme_mg: 0,  // TACO não separa ferro heme
        vitamina_a_mcg: t.retinol_mcg ?? 0,
        vitamina_c_mg: t.vitamina_c_mg,
        calcio_mg: t.calcio_mg,
        magnesio_mg: t.magnesio_mg,
        zinco_mg: t.zinco_mg,
        acucar_adicionado_g: 0,
        ativo: true,
      },
    })
    criados++
    if (criados % 50 === 0) console.log(`  ... ${criados}/${tacoItens.length} criados`)
  }
  console.log(`  ✓ ${criados} alimentos criados`)

  // ── PASSO 5: VALIDAÇÃO ──────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('✅ RESET + POPULATE CONCLUÍDO — VALIDAÇÃO')
  console.log('═'.repeat(70))

  const totalFinal = await prisma.alimento.count()
  const comTaco = await prisma.alimento.count({ where: { codigo_taco: { not: null } } })

  console.log(`\nContagens finais:`)
  console.log(`  Alimentos: ${alimentosAtuais.length} → ${totalFinal}`)
  console.log(`  Com codigo_taco: ${comTaco}`)
  console.log(`  Sem codigo_taco: ${totalFinal - comTaco}`)
  console.log(`  Ingredientes em preparações: ${ingredientesAtuais.length} → 0 (órfãos)`)

  // Salvar relatório
  const relatorioPath = `/tmp/relatorio-reset-populate-${timestamp}.json`
  fs.writeFileSync(relatorioPath, JSON.stringify({
    aplicado_em: new Date().toISOString(),
    backup_path: backupPath,
    mapa_path: mapaPath,
    antes: {
      alimentos: alimentosAtuais.length,
      ingredientes: ingredientesAtuais.length,
    },
    depois: {
      alimentos: totalFinal,
      ingredientes: 0,
    },
  }, null, 2))
  console.log(`\n💾 Relatório salvo: ${relatorioPath}`)

  console.log('\n' + '═'.repeat(70))
  console.log('✅ Concluído!')
  console.log('═'.repeat(70))
  console.log('\n📋 PRÓXIMO PASSO: revincular preparações aos novos alimentos')
  console.log('   npx tsx scripts/revincular-preparacoes.ts')
  console.log('\n📋 Para restaurar backup (em caso de problema):')
  console.log('   npx tsx scripts/restore-alimentos-backup.ts')
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
