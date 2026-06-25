// ============================================================
// scripts/importar-cardapio-integral.ts
// ============================================================
// Importa cardápio Integral (2 lanches por dia: 1º Lanche + 2º Lanche)
//
// ESTRUTURA DO ODT (diferente da Regular e Fredolino):
//   - Cada semana tem 2 linhas consecutivas:
//     Linha A: C0="Semana N" → 1º Lanche (C1-C5 = seg a sex)
//     Linha B: C0=comida     → 2º Lanche (C0-C4 = seg a sex, sem label de semana)
//   - "X" = dia vazio
//   - Preparações separadas por | (pipe) dentro de cada parágrafo
//
// USO:
//   npx tsx scripts/importar-cardapio-integral.ts          # dry-run
//   npx tsx scripts/importar-cardapio-integral.ts --apply   # aplicar
// ============================================================

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const MODO_APLICAR = args.includes('--apply')
const ODT_PATH = path.resolve(process.cwd(), 'Fundamental integral.odt')

// ── EXTRAIR TABELAS ──────────────────────────────────────────

function extrairTabelasDoODT(odtPath: string): any[][][] {
  const tmpDir = '/tmp/odt-integral-import'
  execSync(`mkdir -p ${tmpDir} && unzip -o "${odtPath}" content.xml -d ${tmpDir} 2>/dev/null`)
  const xml = fs.readFileSync(path.join(tmpDir, 'content.xml'), 'utf-8')

  const tabelas: any[][][] = []
  const tableRegex = /<table:table[^>]*>([\s\S]*?)<\/table:table>/g
  let tableMatch
  while ((tableMatch = tableRegex.exec(xml)) !== null) {
    const tableContent = tableMatch[1]
    const rows: any[][] = []
    const rowRegex = /<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g
    let rowMatch
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const rowContent = rowMatch[1]
      const cells: string[][] = []
      const cellRegex = /<table:table-cell[^>]*>([\s\S]*?)<\/table:table-cell>/g
      let cellMatch
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellContent = cellMatch[1]
        const paragraphs: string[] = []
        const pRegex = /<text:p[^>]*>([\s\S]*?)<\/text:p>/g
        let pMatch
        while ((pMatch = pRegex.exec(cellContent)) !== null) {
          let text = pMatch[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim()
          if (text) paragraphs.push(text)
        }
        cells.push(paragraphs)
      }
      rows.push(cells)
    }
    tabelas.push(rows)
  }
  return tabelas
}

// ── PARSER ──────────────────────────────────────────────────

interface RefeicaoImport {
  semana_num: number
  tipo: 'lanche1' | 'lanche2'
  dias: Array<{ dia_semana: string; preparacoes: string[]; vazio: boolean }>
}

function parseTabelas(tabelas: any[][][]): RefeicaoImport[] {
  const refeicoes: RefeicaoImport[] = []
  const diasMap = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
  let ultimaSemanaNum = 0
  let ultimaSemanaDiasL1: Array<{ dia_semana: string; preparacoes: string[]; vazio: boolean }> | null = null

  for (const tabela of tabelas) {
    for (let ri = 1; ri < tabela.length; ri++) {
      const row = tabela[ri]
      if (!row || row.length < 2) continue

      // Célula 0
      const cell0 = row[0]
      const cell0Text = cell0.join(' ').trim()

      // Verificar se começa com "Semana"
      const semanaMatch = cell0Text.match(/semana\s*(\d+)/i)

      if (semanaMatch) {
        // ── LINHA A: 1º Lanche ──
        ultimaSemanaNum = parseInt(semanaMatch[1])
        const diasL1: Array<{ dia_semana: string; preparacoes: string[]; vazio: boolean }> = []

        // Para Lanche 1: C1-C5 = seg a sex
        for (let ci = 1; ci < row.length && ci <= 5; ci++) {
          const cell = row[ci]
          const cellText = cell.join(' ').trim()
          const vazio = cellText === 'X' || cellText === '' || /^(x|ferias|feriado)$/i.test(cellText)
          const preparacoes: string[] = []
          for (const para of cell) {
            const parts = para.split('|').map(p => p.trim()).filter(p => p && p !== 'X')
            preparacoes.push(...parts)
          }
          diasL1.push({
            dia_semana: diasMap[ci - 1] || `dia${ci}`,
            preparacoes: vazio ? [] : preparacoes,
            vazio,
          })
        }

        refeicoes.push({ semana_num: ultimaSemanaNum, tipo: 'lanche1', dias: diasL1 })
        // Guardar referência para alinhar L2
        ultimaSemanaDiasL1 = diasL1

      } else if (cell0Text && !cell0Text.startsWith('2ª')) {
        // ── LINHA B: 2º Lanche (não tem "Semana N" no C0) ──
        // v8.8: ALINHAMENTO CORRETO — L2 pode ter 4 ou 5 células:
        //   - Se L1 segunda (C1) estava vazia → L2 tem 4 cells: C0=ter, C1=qua, C2=qui, C3=sex
        //   - Se L1 segunda (C1) tinha comida → L2 tem 5 cells: C0=seg, C1=ter, C2=qua, C3=qui, C4=sex
        const dias: Array<{ dia_semana: string; preparacoes: string[]; vazio: boolean }> = []

        // Determinar offset: se L1[0] (segunda) estava vazia, começar de terça (offset=1)
        const segundaVazia = ultimaSemanaDiasL1 && ultimaSemanaDiasL1[0] && ultimaSemanaDiasL1[0].vazio
        const offset = segundaVazia ? 1 : 0

        for (let ci = 0; ci < row.length && (ci + offset) < 5; ci++) {
          const diaIdx = ci + offset
          const cell = row[ci]
          const cellText = cell.join(' ').trim()
          const vazio = cellText === 'X' || cellText === '' || /^(x|ferias|feriado)$/i.test(cellText)
          const preparacoes: string[] = []
          for (const para of cell) {
            const parts = para.split('|').map(p => p.trim()).filter(p => p && p !== 'X')
            preparacoes.push(...parts)
          }
          dias.push({
            dia_semana: diasMap[diaIdx] || `dia${diaIdx + 1}`,
            preparacoes: vazio ? [] : preparacoes,
            vazio,
          })
        }

        // Se não houve semana anterior, pular
        if (ultimaSemanaNum > 0) {
          refeicoes.push({ semana_num: ultimaSemanaNum, tipo: 'lanche2', dias })
        }
      }
    }
  }

  return refeicoes
}

// ── MATCHING ────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[,.\-()/]/g, ' ').replace(/\s+/g, ' ').trim()
}

function similaridade(a: string, b: string): number {
  const na = new Set(normalize(a).split(' ').filter(w => w.length > 2))
  const nb = new Set(normalize(b).split(' ').filter(w => w.length > 2))
  if (na.size === 0 || nb.size === 0) return 0
  let intersecao = 0
  for (const w of na) if (nb.has(w)) intersecao++
  return intersecao / (na.size + nb.size - intersecao)
}

// ── MAIN ────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('📥 IMPORTAR CARDÁPIO INTEGRAL (1º Lanche + 2º Lanche)')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN'}\n`)

  if (!fs.existsSync(ODT_PATH)) {
    console.error(`❌ Arquivo não encontrado: ${ODT_PATH}`)
    process.exit(1)
  }

  // Extrair e parse
  console.log('── EXTRAINDO TABELAS ──')
  const tabelas = extrairTabelasDoODT(ODT_PATH)
  console.log(`  ✓ ${tabelas.length} tabelas`)

  const refeicoes = parseTabelas(tabelas)
  console.log(`  ✓ ${refeicoes.length} refeições extraídas`)

  const lanche1 = refeicoes.filter(r => r.tipo === 'lanche1')
  const lanche2 = refeicoes.filter(r => r.tipo === 'lanche2')
  console.log(`    1º Lanche: ${lanche1.length} (semanas ${lanche1.map(l => l.semana_num).join(', ')})`)
  console.log(`    2º Lanche: ${lanche2.length} (semanas ${lanche2.map(l => l.semana_num).join(', ')})`)

  // Carregar preparações
  console.log('\n── CARREGANDO PREPARAÇÕES ──')
  const preparacoesBanco = await prisma.preparacao.findMany({ select: { id: true, nome: true } })
  console.log(`  ✓ ${preparacoesBanco.length} preparações no banco`)

  // Mapear preparações
  console.log('\n── MAPEANDO PREPARAÇÕES ──')
  const nomesUnicos = new Set<string>()
  for (const ref of refeicoes) {
    for (const dia of ref.dias) {
      for (const prep of dia.preparacoes) nomesUnicos.add(prep)
    }
  }
  console.log(`  📝 ${nomesUnicos.size} preparações únicas no ODT`)

  const mapaPreps = new Map<string, { id: string; nome: string; score: number } | null>()
  let matchExato = 0, matchParcial = 0, semMatch = 0

  for (const nome of nomesUnicos) {
    let melhor: { id: string; nome: string; score: number } | null = null
    for (const prep of preparacoesBanco) {
      const score = similaridade(nome, prep.nome)
      let bonus = 0
      const palavrasNome = normalize(nome).split(' ').filter(w => w.length > 2)
      const palavrasPrep = normalize(prep.nome).split(' ').filter(w => w.length > 2)
      for (const p of palavrasNome) if (palavrasPrep.includes(p)) bonus += 0.1
      const scoreFinal = score + bonus
      if (!melhor || scoreFinal > melhor.score) melhor = { id: prep.id, nome: prep.nome, score: scoreFinal }
    }
    if (melhor && melhor.score >= 0.5) {
      mapaPreps.set(nome, melhor)
      if (melhor.score >= 0.8) matchExato++
      else matchParcial++
    } else {
      mapaPreps.set(nome, null)
      semMatch++
    }
  }

  console.log(`  ✓ Match exato (≥0.8): ${matchExato}`)
  console.log(`  ⚠️  Match parcial (0.5-0.8): ${matchParcial}`)
  console.log(`  ✗ Sem match: ${semMatch}`)

  if (semMatch > 0 || matchParcial > 0) {
    console.log('\n── SEM MATCH / PARCIAL ──')
    for (const [nome, match] of mapaPreps) {
      if (!match) console.log(`  ✗ "${nome}"`)
      else if (match.score < 0.8) console.log(`  ⚠️  "${nome}" → "${match.nome}" (score=${match.score.toFixed(2)})`)
    }
  }

  // Buscar/Criar cardápio INTEGRAL
  console.log('\n── CARDÁPIO INTEGRAL BASE ──')
  let cardapio = await prisma.cardapioNutricional.findFirst({
    where: { categoria_escola: 'INTEGRAL', escola_id: null },
    include: { semanas: { select: { id: true, numero: true, dias: { select: { id: true, dia_semana: true } } } } },
  })

  if (!cardapio) {
    console.log('  ⚠️  Criando cardápio INTEGRAL base...')
    const nutricionista = await prisma.nutricionista.findFirst({ where: { ativo: true } })
    if (!nutricionista) { console.error('❌ Sem nutricionista ativo!'); process.exit(1) }
    const ano = new Date().getFullYear()
    const semestre = 2  // v8.8: segundo semestre conforme solicitado

    if (MODO_APLICAR) {
      cardapio = await prisma.cardapioNutricional.create({
        data: {
          nome: `Cardápio Integral ${ano}/${semestre}`, escola_id: null,
          nutricionista_id: nutricionista.id, categoria_escola: 'INTEGRAL', fase_escolar: 'FUND_FINAL',
          ano, semestre, status: 'RASCUNHO', criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
          ciclo_semanas: 5, repetir_ciclo: true,
          semanas: { create: Array.from({ length: 22 }, (_, i) => ({
            numero: i + 1, data_inicio: '', data_fim: '',
            dias: { create: ['segunda','terca','quarta','quinta','sexta'].map(d => ({ dia_semana: d })) },
          })) },
        },
        include: { semanas: { select: { id: true, numero: true, dias: { select: { id: true, dia_semana: true } } } } },
      })
      console.log(`  ✅ Criado: "${cardapio.nome}" — ${cardapio.semanas.length} semanas`)
    } else {
      console.log('  (dry-run — seria criado)')
      cardapio = { id: 'dry', nome: `Integral ${ano}/${semestre}`, ano, semestre,
        semanas: Array.from({ length: 22 }, (_, i) => ({ id: `d${i}`, numero: i+1, dias: ['seg','ter','qua','qui','sex'].map(d => ({id:`d${i}-${d}`,dia_semana:d})) }))
      } as any
    }
  } else {
    console.log(`  ✓ Encontrado: "${cardapio.nome}" — ${cardapio.semanas.length} semanas`)
  }

  // Buscar refeições INTEGRAL
  const catsRefeicao = await prisma.categoriaRefeicao.findMany({
    where: { categoria_escola: 'INTEGRAL' }, include: { tipo_refeicao: true },
  })
  const refeicaoLanche1 = catsRefeicao.find(cr => cr.tipo_refeicao.codigo === 'LANCHE_1')
  const refeicaoLanche2 = catsRefeicao.find(cr => cr.tipo_refeicao.codigo === 'LANCHE_2')

  if (!refeicaoLanche1 || !refeicaoLanche2) {
    console.error('❌ Não encontrei LANCHE_1 e LANCHE_2 para INTEGRAL!')
    console.log('Disponíveis:', catsRefeicao.map(cr => cr.tipo_refeicao.codigo))
    process.exit(1)
  }
  console.log(`  ✓ ${refeicaoLanche1.tipo_refeicao.nome} (${refeicaoLanche1.tipo_refeicao.horario})`)
  console.log(`  ✓ ${refeicaoLanche2.tipo_refeicao.nome} (${refeicaoLanche2.tipo_refeicao.horario})`)

  // Preview
  console.log('\n── PREVIEW: 4 primeiras refeições ──')
  for (const ref of refeicoes.slice(0, 4)) {
    console.log(`\n  Semana ${ref.semana_num} ${ref.tipo}:`)
    for (const dia of ref.dias) {
      if (dia.vazio) { console.log(`    ${dia.dia_semana}: X`); continue }
      const preps = dia.preparacoes.map(p => mapaPreps.get(p) ? '✓' : '✗')
      console.log(`    ${dia.dia_semana}: ${dia.preparacoes.map((p,i) => `${preps[i]}${p}`).join(' | ')}`)
    }
  }

  if (!MODO_APLICAR) {
    console.log('\n' + '═'.repeat(70))
    console.log('👁️  DRY-RUN — para aplicar: --apply')
    return
  }

  // ── APLICAR ──
  console.log('\n' + '═'.repeat(70))
  console.log('🔄 APLICANDO...')
  console.log('═'.repeat(70))

  let totalItens = 0, totalVazios = 0

  for (const ref of refeicoes) {
    const tipoId = ref.tipo === 'lanche1' ? refeicaoLanche1!.tipo_refeicao.id : refeicaoLanche2!.tipo_refeicao.id
    const semana = cardapio!.semanas.find(s => s.numero === ref.semana_num)
    if (!semana) continue

    for (const dia of ref.dias) {
      const diaCardapio = semana.dias.find(d => d.dia_semana === dia.dia_semana)
      if (!diaCardapio) continue

      await prisma.cardapioItem.deleteMany({ where: { dia_id: diaCardapio.id, tipo_refeicao_id: tipoId } })

      if (dia.vazio) { totalVazios++; continue }

      for (const prepNome of dia.preparacoes) {
        const match = mapaPreps.get(prepNome)
        if (!match) continue

        const existente = await prisma.cardapioItem.findUnique({
          where: { dia_id_tipo_refeicao_id_preparacao_id: { dia_id: diaCardapio.id, tipo_refeicao_id: tipoId, preparacao_id: match.id } },
        })
        if (existente) continue

        await prisma.cardapioItem.create({
          data: { dia_id: diaCardapio.id, tipo_refeicao_id: tipoId, preparacao_id: match.id, porcoes: 1, ordem: 0 },
        })
        totalItens++
      }
    }
    console.log(`  ✓ Semana ${ref.semana_num} ${ref.tipo} — ${ref.dias.reduce((a, d) => a + (d.vazio ? 0 : d.preparacoes.length), 0)} prep`)
  }

  console.log(`\n✅ ${totalItens} itens adicionados`)
  console.log(`✅ ${totalVazios} dias vazios (X)`)
}

main().catch(async (err) => { console.error('❌', err); await prisma.$disconnect(); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
