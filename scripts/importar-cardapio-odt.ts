// ============================================================
// scripts/importar-cardapio-odt.ts
// ============================================================
// Importa um cardápio de um arquivo ODT (OpenDocument) para
// o banco de dados. Cada dia da semana tem suas preparações
// inseridas no slot "Lanche" da categoria REGULAR.
//
// USO:
//   npx tsx scripts/importar-cardapio-odt.ts                    # dry-run
//   npx tsx scripts/importar-cardapio-odt.ts --apply            # aplicar
//   npx tsx scripts/importar-cardapio-odt.ts --apply --cardapio-id=XXXX
// ============================================================

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const MODO_APLICAR = args.includes('--apply')
const cardapioIdArg = args.find(a => a.startsWith('--cardapio-id='))
const CARDAPIO_ID_EXPLICIT = cardapioIdArg ? cardapioIdArg.split('=')[1] : null

// Caminho do ODT
const ODT_PATH = path.resolve(process.cwd(), 'Fundamental e infantil regular.odt')

// ── 1. EXTRAIR TEXTO DO ODT ──────────────────────────────────

function extrairTabelasDoODT(odtPath: string): any[] {
  // Extrair content.xml do ODT (que é um ZIP)
  const tmpDir = '/tmp/odt-import'
  execSync(`mkdir -p ${tmpDir} && unzip -o "${odtPath}" content.xml -d ${tmpDir} 2>/dev/null`)
  const xmlPath = path.join(tmpDir, 'content.xml')
  const xml = fs.readFileSync(xmlPath, 'utf-8')

  // Parser simples de XML para extrair tabelas
  // Procura por <table:table> ... </table:table>
  const tabelas: any[] = []
  const tableRegex = /<table:table[^>]*>([\s\S]*?)<\/table:table>/g
  let tableMatch

  while ((tableMatch = tableRegex.exec(xml)) !== null) {
    const tableContent = tableMatch[1]
    const rows: any[] = []

    // Extrair linhas
    const rowRegex = /<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g
    let rowMatch
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const rowContent = rowMatch[1]
      const cells: string[][] = []

      // Extrair células
      const cellRegex = /<table:table-cell[^>]*>([\s\S]*?)<\/table:table-cell>/g
      let cellMatch
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellContent = cellMatch[1]
        // Extrair parágrafos <text:p>
        const paragraphs: string[] = []
        const pRegex = /<text:p[^>]*>([\s\S]*?)<\/text:p>/g
        let pMatch
        while ((pMatch = pRegex.exec(cellContent)) !== null) {
          // Remover tags internas (text:span, etc) e decodificar entidades
          let text = pMatch[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .trim()
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

// ── 2. PARSER DA ESTRUTURA DO CARDÁPIO ───────────────────────

interface DiaCardapio {
  dia_semana: string  // segunda, terca, quarta, quinta, sexta
  preparacoes: string[]  // nomes das preparações
}

interface SemanaCardapio {
  numero_semana: string  // "3", "4", etc (do ODT)
  data_range: string  // "20 a 24/07"
  dias: DiaCardapio[]
  eh_ferias: boolean
}

function parseTabelas(tabelas: any[]): SemanaCardapio[] {
  const semanas: SemanaCardapio[] = []
  const diasMap = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

  for (const tabela of tabelas) {
    // Linha 0 = cabeçalho (2ª feira, 3ª feira, ...)
    // Linhas 1+ = semanas
    for (let ri = 1; ri < tabela.length; ri++) {
      const row = tabela[ri]
      if (!row || row.length < 2) continue

      // Célula 0 = número da semana + data
      const cell0 = row[0]
      const weekInfo = cell0.join(' ').trim()
      if (!weekInfo) continue

      // Extrair número da semana e data
      // Ex: "3 20 a 24/07" → semana 3, data "20 a 24/07"
      // Ex: "4 27 a 31/07" → semana 4, data "27 a 31/07"
      const weekMatch = weekInfo.match(/^(\d+)\s*(.*)$/)
      const numeroSemana = weekMatch ? weekMatch[1] : '?'
      const dataRange = weekMatch ? weekMatch[2].trim() : weekInfo

      // Verificar se é férias/feriado
      const todasPreps = row.slice(1).flat().join(' ').toLowerCase()
      const ehFerias = todasPreps.includes('férias') || todasPreps.includes('ferias') || todasPreps.includes('feriado')

      // Extrair dias
      const dias: DiaCardapio[] = []
      for (let ci = 1; ci < row.length && ci <= 5; ci++) {
        const cell = row[ci]
        const preparacoes = cell.filter(p => p.trim() && !p.match(/^(férias|ferias|feriado)$/i))
        dias.push({
          dia_semana: diasMap[ci - 1] || `dia${ci}`,
          preparacoes: preparacoes.map(p => p.trim()).filter(p => p),
        })
      }

      semanas.push({ numero_semana: numeroSemana, data_range: dataRange, dias, eh_ferias: ehFerias })
    }
  }

  return semanas
}

// ── 3. MATCHING DE PREPARAÇÕES ───────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,.\-()/]/g, ' ')
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

// ── 4. SCRIPT PRINCIPAL ──────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('📥 IMPORTAR CARDÁPIO DE ODT')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN (preview)'}\n`)

  // Verificar arquivo
  if (!fs.existsSync(ODT_PATH)) {
    console.error(`❌ Arquivo não encontrado: ${ODT_PATH}`)
    process.exit(1)
  }
  console.log(`📂 Arquivo: ${ODT_PATH}`)

  // Extrair tabelas do ODT
  console.log('\n── EXTRAINDO TABELAS DO ODT ──')
  const tabelas = extrairTabelasDoODT(ODT_PATH)
  console.log(`  ✓ ${tabelas.length} tabelas encontradas`)

  // Parse das semanas
  const semanas = parseTabelas(tabelas)
  console.log(`  ✓ ${semanas.length} semanas extraídas`)
  const semanasComDados = semanas.filter(s => !s.eh_ferias)
  console.log(`  ✓ ${semanasComDados.length} semanas com preparações (não são férias)`)

  // Carregar preparações do banco (1 query)
  console.log('\n── CARREGANDO PREPARAÇÕES DO BANCO ──')
  const preparacoesBanco = await prisma.preparacao.findMany({
    select: { id: true, nome: true },
  })
  console.log(`  ✓ ${preparacoesBanco.length} preparações no banco`)

  // Carregar cardápio Regular base
  console.log('\n── BUSCANDO CARDÁPIO REGULAR BASE ──')
  let cardapio
  if (CARDAPIO_ID_EXPLICIT) {
    cardapio = await prisma.cardapioNutricional.findUnique({
      where: { id: CARDAPIO_ID_EXPLICIT },
      include: { semanas: { select: { id: true, numero: true, dias: { select: { id: true, dia_semana: true } } } } },
    })
  } else {
    // Buscar cardápio base da Regular (sem escola)
    const candidatos = await prisma.cardapioNutricional.findMany({
      where: {
        categoria_escola: 'REGULAR',
        escola_id: null,
      },
      include: { semanas: { select: { id: true, numero: true, dias: { select: { id: true, dia_semana: true } } } } },
    })
    if (candidatos.length === 1) {
      cardapio = candidatos[0]
    } else if (candidatos.length > 1) {
      console.log(`  ⚠️  Encontrados ${candidatos.length} cardápios base Regular. Escolha um:`)
      for (const c of candidatos) {
        console.log(`    ID: ${c.id} — "${c.nome}" (${c.ano}/${c.semestre})`)
      }
      console.log('\n  Use: --cardapio-id=XXXX')
      process.exit(1)
    }
  }

  if (!cardapio) {
    console.error('❌ Cardápio Regular base não encontrado!')
    console.error('   Crie um cardápio com categoria_escola=REGULAR e escola_id=null')
    console.error('   Ou use --cardapio-id=XXXX')
    process.exit(1)
  }
  console.log(`  ✓ Cardápio: "${cardapio.nome}" (${cardapio.ano}/${cardapio.semestre})`)
  console.log(`  ✓ ${cardapio.semanas.length} semanas no cardápio`)

  // Buscar tipo_refeicao "Lanche" para Regular
  const catRefeicao = await prisma.categoriaRefeicao.findFirst({
    where: { categoria_escola: 'REGULAR' },
    include: { tipo_refeicao: true },
  })
  if (!catRefeicao) {
    console.error('❌ CategoriaRefeicao para REGULAR não encontrada!')
    process.exit(1)
  }
  console.log(`  ✓ Refeição: ${catRefeicao.tipo_refeicao.nome} (${catRefeicao.tipo_refeicao.horario})`)
  const tipoRefeicaoId = catRefeicao.tipo_refeicao.id

  // ── MAPEAR PREPARAÇÕES DO ODT → BANCO ──
  console.log('\n── MAPEANDO PREPARAÇÕES ──')

  // Coletar todos os nomes únicos do ODT
  const nomesUnicos = new Set<string>()
  for (const sem of semanasComDados) {
    for (const dia of sem.dias) {
      for (const prep of dia.preparacoes) {
        nomesUnicos.add(prep)
      }
    }
  }
  console.log(`  📝 ${nomesUnicos.size} preparações únicas no ODT`)

  // Para cada nome único, encontrar melhor match no banco
  const mapaPreparacoes = new Map<string, { id: string; nome: string; score: number } | null>()
  let matchExato = 0, matchParcial = 0, semMatch = 0

  for (const nome of nomesUnicos) {
    let melhor: { id: string; nome: string; score: number } | null = null
    for (const prep of preparacoesBanco) {
      const score = similaridade(nome, prep.nome)
      // Bônus se uma palavra principal bate
      const palavrasNome = normalize(nome).split(' ').filter(w => w.length > 2)
      const palavrasPrep = normalize(prep.nome).split(' ').filter(w => w.length > 2)
      let bonus = 0
      for (const p of palavrasNome) {
        if (palavrasPrep.includes(p)) bonus += 0.1
      }
      const scoreFinal = score + bonus
      if (!melhor || scoreFinal > melhor.score) {
        melhor = { id: prep.id, nome: prep.nome, score: scoreFinal }
      }
    }
    if (melhor && melhor.score >= 0.5) {
      mapaPreparacoes.set(nome, melhor)
      if (melhor.score >= 0.8) matchExato++
      else matchParcial++
    } else {
      mapaPreparacoes.set(nome, null)
      semMatch++
    }
  }

  console.log(`  ✓ Match exato (≥0.8): ${matchExato}`)
  console.log(`  ⚠️  Match parcial (0.5-0.8): ${matchParcial}`)
  console.log(`  ✗ Sem match: ${semMatch}`)

  // Mostrar matches parciais e sem match
  if (matchParcial > 0 || semMatch > 0) {
    console.log('\n── PREPARAÇÕES COM MATCH PARCIAL OU SEM MATCH ──')
    for (const [nome, match] of mapaPreparacoes) {
      if (!match) {
        console.log(`  ✗ "${nome}" → SEM MATCH`)
      } else if (match.score < 0.8) {
        console.log(`  ⚠️  "${nome}" → "${match.nome}" (score=${match.score.toFixed(2)})`)
      }
    }
  }

  // ── MAPEAR SEMANAS ODT → SEMANAS DO CARDÁPIO ──
  console.log('\n── MAPEANDO SEMANAS ODT → CARDÁPIO ──')

  // Filtrar semanas que NÃO são férias e ordenar por data
  const semanasParaImportar = semanas.filter(s => !s.eh_ferias)
  console.log(`  Semanas a importar: ${semanasParaImportar.length}`)
  console.log(`  Semanas no cardápio: ${cardapio.semanas.length}`)

  // Mapear: semana ODT[i] → semana cardápio[i+1] (sequencial)
  // Se houver mais semanas ODT que cardápio, truncar
  // Se houver menos, pular as últimas
  const mapeamentoSemanas: Array<{ odt: SemanaCardapio; cardapio_semana: any }> = []
  for (let i = 0; i < Math.min(semanasParaImportar.length, cardapio.semanas.length); i++) {
    const semanaOdt = semanasParaImportar[i]
    const semanaCardapio = cardapio.semanas[i]
    mapeamentoSemanas.push({ odt: semanaOdt, cardapio_semana: semanaCardapio })
    console.log(`  Semana ${semanaCardapio.numero} ← ODT "${semanaOdt.numero_semana} ${semanaOdt.data_range}"`)
  }

  if (semanasParaImportar.length > cardapio.semanas.length) {
    console.log(`  ⚠️  ${semanasParaImportar.length - cardapio.semanas.length} semanas do ODT não cabem no cardápio`)
  }

  // ── PREVIEW ──
  console.log('\n── PREVIEW: primeiras 3 semanas ──')
  for (const map of mapeamentoSemanas.slice(0, 3)) {
    console.log(`\n  Semana ${map.cardapio_semana.numero} (${map.odt.data_range}):`)
    for (const dia of map.odt.dias) {
      console.log(`    ${dia.dia_semana}:`)
      for (const prep of dia.preparacoes) {
        const match = mapaPreparacoes.get(prep)
        if (match) {
          console.log(`      ✓ ${prep} → "${match.nome}" (score=${match.score.toFixed(2)})`)
        } else {
          console.log(`      ✗ ${prep} → SEM MATCH`)
        }
      }
    }
  }

  if (!MODO_APLICAR) {
    console.log('\n' + '═'.repeat(70))
    console.log('👁️  DRY-RUN concluído — nada foi alterado')
    console.log('═'.repeat(70))
    console.log('\nPara aplicar:')
    console.log('  npx tsx scripts/importar-cardapio-odt.ts --apply')
    return
  }

  // ── APLICAR ──
  console.log('\n' + '═'.repeat(70))
  console.log('🔄 APLICANDO IMPORTAÇÃO...')
  console.log('═'.repeat(70))

  // Para cada semana mapeada
  let totalItens = 0
  let semanaNum = 0

  for (const map of mapeamentoSemanas) {
    semanaNum++
    const semanaCardapio = map.cardapio_semana

    // Carregar dias desta semana
    const dias = await prisma.cardapioDiaNutri.findMany({
      where: { semana_id: semanaCardapio.id },
    })

    for (const dia of map.odt.dias) {
      // Encontrar o dia no cardápio
      const diaCardapio = dias.find(d => d.dia_semana === dia.dia_semana)
      if (!diaCardapio) {
        console.log(`  ⚠️  Dia ${dia.dia_semana} não encontrado na semana ${semanaCardapio.numero}`)
        continue
      }

      // Remover itens existentes deste dia/refeição
      await prisma.cardapioItem.deleteMany({
        where: { dia_id: diaCardapio.id, tipo_refeicao_id: tipoRefeicaoId },
      })

      // Adicionar novas preparações
      for (const prepNome of dia.preparacoes) {
        const match = mapaPreparacoes.get(prepNome)
        if (!match) continue

        // Verificar se já existe (idempotência)
        const existente = await prisma.cardapioItem.findUnique({
          where: {
            dia_id_tipo_refeicao_id_preparacao_id: {
              dia_id: diaCardapio.id,
              tipo_refeicao_id: tipoRefeicaoId,
              preparacao_id: match.id,
            },
          },
        })
        if (existente) continue

        await prisma.cardapioItem.create({
          data: {
            dia_id: diaCardapio.id,
            tipo_refeicao_id: tipoRefeicaoId,
            preparacao_id: match.id,
            porcoes: 1,
            ordem: 0,
          },
        })
        totalItens++
      }
    }

    console.log(`  ✓ Semana ${semanaCardapio.numero} (${map.odt.data_range}) — ${map.odt.dias.reduce((a, d) => a + d.preparacoes.length, 0)} preparações`)
  }

  console.log(`\n✅ ${totalItens} itens adicionados ao cardápio`)
  console.log(`✅ ${semanaNum} semanas atualizadas`)

  // Validação
  const totalFinal = await prisma.cardapioItem.count({
    where: {
      dia: { semana: { cardapio_id: cardapio.id } },
      tipo_refeicao_id: tipoRefeicaoId,
    },
  })
  console.log(`\n📊 Total de itens no cardápio (${catRefeicao.tipo_refeicao.nome}): ${totalFinal}`)
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
