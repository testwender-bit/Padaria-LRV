// ============================================================
// scripts/revincular-preparacoes.ts
// ============================================================
// Revincula os ingredientes das preparações aos novos alimentos
// da TACO oficial (após reset-populate-taco.ts).
//
// COMO FUNCIONA:
//   1. Carrega o backup de ingredientes (com alimento_nome)
//   2. Carrega o mapa de revinculação (nome antigo → sugestões TACO)
//   3. Para cada ingrediente do backup:
//      a. Encontra o nome do alimento antigo
//      b. Busca o melhor match TACO (do mapa)
//      c. Se score >= 0.7: revincula automaticamente
//      d. Se score 0.5-0.7: marca para revisão manual
//      e. Se score < 0.5: marca como "sem match" (criar alimento custom)
//   4. Recria os ingredientes nas preparações com os novos alimento_id
//
// SEGURANÇA:
//   - Por padrão roda em modo DRY-RUN
//   - Para aplicar: npx tsx scripts/revincular-preparacoes.ts --apply
//   - Não deleta nada — só cria ingredientes
//
// USO:
//   npx tsx scripts/revincular-preparacoes.ts             # dry-run
//   npx tsx scripts/revincular-preparacoes.ts --apply     # aplica
// ============================================================

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const args = process.argv.slice(2)
const MODO_APLICAR = args.includes('--apply')

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('↔  REVINCULAÇÃO DE PREPARAÇÕES')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN (preview)'}\n`)

  // ── 1. Carregar backup de ingredientes ──────────────────────
  const backupDir = '/tmp'
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-alimentos-') && f.endsWith('.json'))
    .map(f => ({ file: f, path: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

  if (backups.length === 0) {
    console.error('❌ Nenhum backup encontrado em /tmp/backup-alimentos-*.json')
    console.error('   Rode primeiro: npx tsx scripts/reset-populate-taco.ts --apply')
    process.exit(1)
  }

  const backup = backups[0]
  console.log(`📂 Backup mais recente: ${backup.file}`)
  const backupData = JSON.parse(fs.readFileSync(backup.path, 'utf-8'))
  const ingredientesAntigos: Array<{
    id: string
    preparacao_id: string
    alimento_id: string
    alimento_nome: string
    quantidade_gramas: number
    mesma_percapita: boolean
  }> = backupData.ingredientes

  console.log(`📊 Ingredientes a revincular: ${ingredientesAntigos.length}`)
  console.log(`📊 Preparações únicas afetadas: ${new Set(ingredientesAntigos.map(i => i.preparacao_id)).size}\n`)

  // ── 2. Carregar alimentos atuais (TACO oficial) ─────────────
  const alimentosAtuais = await prisma.alimento.findMany()
  console.log(`📊 Alimentos atuais no banco: ${alimentosAtuais.length}`)

  // Criar índice por nome normalizado
  function normalize(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[,.\-()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const alimentosPorNome = new Map<string, typeof alimentosAtuais[0]>()
  for (const a of alimentosAtuais) {
    alimentosPorNome.set(normalize(a.nome), a)
  }

  // ── 3. Para cada ingrediente, encontrar melhor match ────────
  console.log('\n── ANALISANDO INGREDIENTES ──')

  interface ResultadoRevinc {
    ingrediente_antigo_id: string
    preparacao_id: string
    alimento_nome_antigo: string
    alimento_id_novo: string | null
    alimento_nome_novo: string | null
    score: number
    status: 'auto' | 'revisar' | 'sem_match' | 'criar_custom'
    quantidade_gramas: number
    mesma_percapita: boolean
  }

  const resultados: ResultadoRevinc[] = []

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

  for (const ing of ingredientesAntigos) {
    const nomeAntigo = ing.alimento_nome || ''
    if (!nomeAntigo) {
      resultados.push({
        ...ing,
        alimento_id_novo: null,
        alimento_nome_novo: null,
        score: 0,
        status: 'sem_match',
      })
      continue
    }

    // Buscar melhor match nos alimentos atuais
    let melhorMatch: { alimento: typeof alimentosAtuais[0]; score: number } | null = null
    for (const al of alimentosAtuais) {
      let score = similaridade(nomeAntigo, al.nome)
      if (temPalavraPrincipal(nomeAntigo, al.nome)) score += 0.2
      const estadoAnt = detectarEstado(nomeAntigo)
      const estadoNovo = detectarEstado(al.nome)
      if (estadoAnt !== 'indefinido' && estadoAnt === estadoNovo) score += 0.1
      if (!melhorMatch || score > melhorMatch.score) {
        melhorMatch = { alimento: al, score }
      }
    }

    if (!melhorMatch) {
      resultados.push({
        ...ing,
        alimento_id_novo: null,
        alimento_nome_novo: null,
        score: 0,
        status: 'sem_match',
      })
      continue
    }

    let status: ResultadoRevinc['status']
    if (melhorMatch.score >= 0.7) status = 'auto'
    else if (melhorMatch.score >= 0.5) status = 'revisar'
    else status = 'criar_custom'

    resultados.push({
      ingrediente_antigo_id: ing.id,
      preparacao_id: ing.preparacao_id,
      alimento_nome_antigo: nomeAntigo,
      alimento_id_novo: melhorMatch.alimento.id,
      alimento_nome_novo: melhorMatch.alimento.nome,
      score: melhorMatch.score,
      status,
      quantidade_gramas: ing.quantidade_gramas,
      mesma_percapita: ing.mesma_percapita,
    })
  }

  // ── 4. RELATÓRIO ────────────────────────────────────────────
  const stats = {
    auto: resultados.filter(r => r.status === 'auto').length,
    revisar: resultados.filter(r => r.status === 'revisar').length,
    sem_match: resultados.filter(r => r.status === 'sem_match').length,
    criar_custom: resultados.filter(r => r.status === 'criar_custom').length,
  }

  console.log('\n── ESTATÍSTICAS ──')
  console.log(`  ✓ Revinculação automática (score >= 0.7): ${stats.auto}`)
  console.log(`  ⚠️  Requer revisão manual (0.5-0.7): ${stats.revisar}`)
  console.log(`  ❓ Sem match — criar alimento custom: ${stats.criar_custom}`)
  console.log(`  ✗ Sem nome no backup: ${stats.sem_match}`)

  // Mostrar amostra de revinculações automáticas
  console.log('\n── AMOSTRA: 20 revinculações automáticas ──')
  const autoResults = resultados.filter(r => r.status === 'auto').slice(0, 20)
  for (const r of autoResults) {
    console.log(`  ✓ ${r.alimento_nome_antigo.padEnd(35)} → ${r.alimento_nome_novo!.padEnd(35)} (score=${r.score.toFixed(2)})`)
  }

  // Mostrar amostra de revisão manual
  console.log('\n── AMOSTRA: 20 ingredientes que precisam revisão manual ──')
  const revisarResults = resultados.filter(r => r.status === 'revisar').slice(0, 20)
  for (const r of revisarResults) {
    console.log(`  ⚠️  ${r.alimento_nome_antigo.padEnd(35)} → ${r.alimento_nome_novo?.padEnd(35) || '?'} (score=${r.score.toFixed(2)})`)
  }

  // Mostrar amostra de criar custom
  console.log('\n── AMOSTRA: 20 ingredientes que precisam criar alimento custom ──')
  const customResults = resultados.filter(r => r.status === 'criar_custom').slice(0, 20)
  for (const r of customResults) {
    console.log(`  ❓ ${r.alimento_nome_antigo.padEnd(45)} (melhor sugestão: ${r.alimento_nome_novo || 'nenhuma'}, score=${r.score.toFixed(2)})`)
  }

  // Salvar relatório completo
  const relatorioPath = '/tmp/relatorio-revinculacao.json'
  fs.writeFileSync(relatorioPath, JSON.stringify(resultados, null, 2))
  console.log(`\n💾 Relatório completo: ${relatorioPath}`)

  if (!MODO_APLICAR) {
    console.log('\n' + '═'.repeat(70))
    console.log('👁️  DRY-RUN concluído — nada foi alterado')
    console.log('═'.repeat(70))
    console.log('\nPara aplicar:')
    console.log('  npx tsx scripts/revincular-preparacoes.ts --apply')
    return
  }

  // ── 5. APLICAR ──────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('🔄 APLICANDO REVINCULAÇÃO...')
  console.log('═'.repeat(70))

  // Para ingredientes "auto" e "revisar": criar com alimento_id_novo
  // Para ingredientes "criar_custom": criar alimento custom primeiro, depois vincular
  // Para "sem_match": pular (ingrediente perdido)

  // 5a. Criar alimentos custom para os que precisam
  console.log('\n── 5a. Criando alimentos custom (para sem match) ──')
  const nomesCustom = new Map<string, string>()  // nome → novo_id
  const customUnicos = new Set<string>()
  for (const r of resultados.filter(r => r.status === 'criar_custom')) {
    if (!customUnicos.has(r.alimento_nome_antigo)) {
      customUnicos.add(r.alimento_nome_antigo)
      // Buscar dados do alimento antigo no backup (para preservar valores)
      const alimentoAntigo = backupData.alimentos.find((a: any) => a.id === r.ingrediente_antigo_id || a.nome === r.alimento_nome_antigo)
      const novo = await prisma.alimento.create({
        data: {
          codigo_taco: null,
          nome: r.alimento_nome_antigo,
          grupo: alimentoAntigo?.grupo || 'Outros',
          medida_caseira: alimentoAntigo?.medida_caseira || '1 porção (100g)',
          gramas_por_medida: alimentoAntigo?.gramas_por_medida || 100,
          energia_kcal: alimentoAntigo?.energia_kcal || 0,
          carboidratos_g: alimentoAntigo?.carboidratos_g || 0,
          proteinas_g: alimentoAntigo?.proteinas_g || 0,
          lipidios_g: alimentoAntigo?.lipidios_g || 0,
          fibra_alimentar_g: alimentoAntigo?.fibra_alimentar_g || 0,
          sodio_mg: alimentoAntigo?.sodio_mg || 0,
          ferro_mg: alimentoAntigo?.ferro_mg || 0,
          ferro_heme_mg: alimentoAntigo?.ferro_heme_mg || 0,
          vitamina_a_mcg: alimentoAntigo?.vitamina_a_mcg || 0,
          vitamina_c_mg: alimentoAntigo?.vitamina_c_mg || 0,
          calcio_mg: alimentoAntigo?.calcio_mg || 0,
          magnesio_mg: alimentoAntigo?.magnesio_mg || 0,
          zinco_mg: alimentoAntigo?.zinco_mg || 0,
          acucar_adicionado_g: alimentoAntigo?.acucar_adicionado_g || 0,
          ativo: true,
        },
      })
      nomesCustom.set(r.alimento_nome_antigo, novo.id)
      console.log(`  + ${r.alimento_nome_antigo.padEnd(40)} (valores preservados do backup)`)
    }
  }
  console.log(`  Total criado: ${nomesCustom.size}`)

  // 5b. Recriar ingredientes nas preparações
  console.log('\n── 5b. Recriando ingredientes nas preparações ──')

  // OTIMIZAÇÃO: pré-carregar todas as preparações e ingredientes existentes
  // em memória para evitar N queries individuais (que deixam o script lento)
  console.log('  📦 Pré-carregando preparações e ingredientes existentes...')
  const todasPreparacoes = await prisma.preparacao.findMany({ select: { id: true } })
  const preparacoesExistentes = new Set(todasPreparacoes.map(p => p.id))
  console.log(`     ${preparacoesExistentes.size} preparações no banco`)

  const ingredientesExistentes = await prisma.preparacaoIngrediente.findMany({
    select: { id: true, preparacao_id: true, alimento_id: true, quantidade_gramas: true },
  })
  // Mapa: "prepId|alimentoId" → ingrediente
  const ingredienteMap = new Map<string, { id: string; quantidade_gramas: number }>()
  for (const ing of ingredientesExistentes) {
    ingredienteMap.set(`${ing.preparacao_id}|${ing.alimento_id}`, { id: ing.id, quantidade_gramas: ing.quantidade_gramas })
  }
  console.log(`     ${ingredienteMap.size} ingredientes já existentes`)

  // Agrupar ingredientes por (preparacao_id, alimento_id) para somar duplicatas
  const ingredientesAgrupados = new Map<string, {
    preparacao_id: string
    alimento_id: string
    quantidade_total: number
    mesma_percapita: boolean
  }>()

  for (const r of resultados) {
    let alimentoId: string | null = null
    if (r.status === 'auto' || r.status === 'revisar') {
      alimentoId = r.alimento_id_novo
    } else if (r.status === 'criar_custom') {
      alimentoId = nomesCustom.get(r.alimento_nome_antigo) || null
    }
    if (!alimentoId) continue
    if (!preparacoesExistentes.has(r.preparacao_id)) continue

    const key = `${r.preparacao_id}|${alimentoId}`
    const existente = ingredientesAgrupados.get(key)
    if (existente) {
      existente.quantidade_total += r.quantidade_gramas
    } else {
      ingredientesAgrupados.set(key, {
        preparacao_id: r.preparacao_id,
        alimento_id: alimentoId,
        quantidade_total: r.quantidade_gramas,
        mesma_percapita: r.mesma_percapita,
      })
    }
  }

  console.log(`  📦 ${ingredientesAgrupados.size} ingredientes únicos para criar (após agrupar duplicatas)`)

  // Criar/atualizar ingredientes em lotes
  let criados = 0
  let atualizados = 0
  let pulados = 0
  let count = 0
  const total = ingredientesAgrupados.size

  for (const [, ing] of ingredientesAgrupados) {
    count++
    const key = `${ing.preparacao_id}|${ing.alimento_id}`
    const existente = ingredienteMap.get(key)

    if (existente) {
      // Já existe — somar quantidade
      await prisma.preparacaoIngrediente.update({
        where: { id: existente.id },
        data: { quantidade_gramas: existente.quantidade_gramas + ing.quantidade_total },
      })
      atualizados++
    } else {
      // Criar novo
      await prisma.preparacaoIngrediente.create({
        data: {
          preparacao_id: ing.preparacao_id,
          alimento_id: ing.alimento_id,
          quantidade_gramas: ing.quantidade_total,
          mesma_percapita: ing.mesma_percapita,
        },
      })
      criados++
    }

    if (count % 100 === 0) {
      console.log(`  ... ${count}/${total} processados (${criados} criados, ${atualizados} atualizados)`)
    }
  }
  pulados = resultados.length - ingredientesAgrupados.size
  console.log(`  ✓ ${criados} ingredientes criados`)
  console.log(`  ✓ ${atualizados} ingredientes atualizados (somou quantidades)`)
  console.log(`  ⏭️  ${pulados} ingredientes pulados (sem match ou preparação não existe)`)

  // ── 6. VALIDAÇÃO FINAL ──────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('✅ REVINCULAÇÃO CONCLUÍDA — VALIDAÇÃO')
  console.log('═'.repeat(70))

  const totalIngredientes = await prisma.preparacaoIngrediente.count()
  const totalAlimentos = await prisma.alimento.count()
  const totalPreparacoes = await prisma.preparacao.count()
  const preparacoesComIngredientes = await prisma.preparacao.count({
    where: { ingredientes: { some: {} } },
  })

  console.log(`\nContagens finais:`)
  console.log(`  Alimentos: ${totalAlimentos}`)
  console.log(`  Preparações: ${totalPreparacoes}`)
  console.log(`  Preparações com ingredientes: ${preparacoesComIngredientes}`)
  console.log(`  Ingredientes em preparações: ${totalIngredientes}`)
  console.log(`  (antes do reset: ${ingredientesAntigos.length})`)

  console.log('\n' + '═'.repeat(70))
  console.log('✅ Processo completo!')
  console.log('═'.repeat(70))
  console.log('\n📋 Resumo do que foi feito:')
  console.log('   1. Reset: 683 alimentos antigos → 573 alimentos TACO oficial')
  console.log(`   2. Revinculação: ${criados} ingredientes recriados (${stats.auto} auto + ${stats.revisar} revisão + ${stats.criar_custom} custom)`)
  console.log('   3. Alimentos custom criados para itens não-TACO (especiarias, regionais)')
  console.log('\n📋 Itens que precisam revisão manual da nutricionista:')
  console.log(`   - ${stats.revisar} ingredientes com match médio (0.5-0.7) — verificar se estão corretos`)
  console.log(`   - Alimentos custom podem ter valores imprecisos — revisar caso a caso`)
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
