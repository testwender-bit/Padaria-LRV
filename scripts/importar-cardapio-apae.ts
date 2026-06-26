// ============================================================
// scripts/importar-cardapio-apae.ts
// ============================================================
// Importa cardápio APAE de um arquivo CSV.
//
// Estrutura do CSV:
//   - Linha 1: header (vazio, 2ª feira, 3ª feira, 4ª feira, 5ª feira, 6ª feira)
//   - Linhas seguintes: "Semana N café da manhã", "Semana N lanche", "Semana N fruta"
//   - Cada célula tem múltiplas preparações separadas por quebra de linha (\n)
//   - Strings com vírgula ou quebra de linha são aspassadas com ""
//
// CRIA/USA:
//   - Cardápio categoria APAE nomeado "Cardápio APAE" (escola_id = null)
//   - Se já existir, atualiza as preparações
//   - 5 semanas × 5 dias
//   - 3 refeições por dia: CAFE_MANHA + LANCHE + FRUTA_MANHA
//
// USO:
//   npx tsx scripts/importar-cardapio-apae.ts          # dry-run
//   npx tsx scripts/importar-cardapio-apae.ts --apply  # aplicar
// ============================================================

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const MODO_APLICAR = args.includes('--apply')

const NOME_CARDAPIO = 'Cardápio APAE'

// Procura o CSV em vários locais possíveis
const POSSIVEIS_PATHS = [
  path.resolve(process.cwd(), 'cardapio apae 5 semanas - Página1.csv'),
  path.resolve(process.cwd(), 'upload/cardapio apae 5 semanas - Página1.csv'),
  path.resolve('/home/z/my-project/upload/cardapio apae 5 semanas - Página1.csv'),
  path.resolve(process.cwd(), 'cardapio-apae.csv'),
]
const CSV_PATH = POSSIVEIS_PATHS.find(p => fs.existsSync(p)) || POSSIVEIS_PATHS[0]

// ── PARSER CSV SIMPLES (sem dependências externas) ──────────
// Suporta:
//   - Campos separados por vírgula
//   - Campos aspassados com " (podem conter vírgula e quebra de linha)
//   - Quebras de linha dentro de campos aspassados
//   - " escapado como "" dentro de campo aspassado
function parseCSV(content: string): string[][] {
  const records: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < content.length) {
    const char = content[i]

    if (inQuotes) {
      if (char === '"') {
        // Verifica se é "" (escape) ou fechamento de aspa
        if (content[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
        continue
      }
    } else {
      // Não está em aspas
      if (char === '"') {
        inQuotes = true
        i++
        continue
      } else if (char === ',') {
        currentRow.push(currentField)
        currentField = ''
        i++
        continue
      } else if (char === '\r') {
        // Ignora \r (Windows line ending)
        i++
        continue
      } else if (char === '\n') {
        // Fim da linha
        currentRow.push(currentField)
        currentField = ''
        // Só adiciona a linha se não estiver totalmente vazia
        if (currentRow.some(f => f.trim() !== '')) {
          records.push(currentRow)
        }
        currentRow = []
        i++
        continue
      } else {
        currentField += char
        i++
        continue
      }
    }
  }

  // Último campo/linha
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField)
    if (currentRow.some(f => f.trim() !== '')) {
      records.push(currentRow)
    }
  }

  return records
}

// ── PARSER ──────────────────────────────────────────────────

interface RefeicaoImport {
  semana_num: number
  tipo: 'cafe' | 'lanche' | 'fruta'
  dias: Array<{ dia_semana: string; preparacoes: string[]; vazio: boolean }>
}

function parseRefeicoes(csvPath: string): RefeicaoImport[] {
  const fileContent = fs.readFileSync(csvPath, 'utf-8')

  // Parse CSV usando parser próprio (sem dependências externas)
  const records = parseCSV(fileContent)

  const refeicoes: RefeicaoImport[] = []
  const diasMap = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

  // Pula a linha 0 (header)
  for (let ri = 1; ri < records.length; ri++) {
    const row = records[ri]
    if (!row || row.length < 2) continue

    // Célula 0: "Semana N café da manhã" / "Semana N lanche" / "Semana N fruta"
    const label = String(row[0] || '').trim()
    if (!label) continue

    // Extrair número da semana e tipo
    const match = label.match(/semana\s*(\d+)\s*(cafe|lanche|fruta)/i)
    if (!match) continue

    const semanaNum = parseInt(match[1])
    let tipo: 'cafe' | 'lanche' | 'fruta'
    if (match[2].toLowerCase().startsWith('cafe')) tipo = 'cafe'
    else if (match[2].toLowerCase().startsWith('lanche')) tipo = 'lanche'
    else tipo = 'fruta'

    // Células 1-5 = dias (segunda a sexta)
    const dias: Array<{ dia_semana: string; preparacoes: string[]; vazio: boolean }> = []
    for (let ci = 1; ci <= 5; ci++) {
      const cell = String(row[ci] || '').trim()
      const vazio = !cell || cell === '' || /^(x|ferias|feriado)$/i.test(cell)

      // Preparações separadas por quebra de linha
      // Limpa cada preparação: remove espaços extras, quebras internas
      const preparacoes: string[] = []
      if (!vazio) {
        const linhas = cell.split(/\r?\n/).map(p => p.trim()).filter(p => p && p !== 'X')
        preparacoes.push(...linhas)
      }

      dias.push({
        dia_semana: diasMap[ci - 1] || `dia${ci}`,
        preparacoes: vazio ? [] : preparacoes,
        vazio,
      })
    }

    refeicoes.push({ semana_num: semanaNum, tipo, dias })
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
  console.log('📥 IMPORTAR CARDÁPIO APAE')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN'}\n`)

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ Arquivo não encontrado: ${CSV_PATH}`)
    console.log(`   Procurei em:`)
    for (const p of POSSIVEIS_PATHS) {
      console.log(`   - ${p} ${fs.existsSync(p) ? '✓' : '✗'}`)
    }
    console.log(`\n   Copie o arquivo CSV para a raiz do projeto.`)
    process.exit(1)
  }
  console.log(`  📄 Arquivo: ${CSV_PATH}\n`)

  // Parse
  console.log('── PARSEANDO CSV ──')
  const refeicoes = parseRefeicoes(CSV_PATH)
  console.log(`  ✓ ${refeicoes.length} refeições extraídas`)

  const cafes = refeicoes.filter(r => r.tipo === 'cafe')
  const lanches = refeicoes.filter(r => r.tipo === 'lanche')
  const frutas = refeicoes.filter(r => r.tipo === 'fruta')
  console.log(`    Café da manhã: ${cafes.length} (semanas ${cafes.map(c => c.semana_num).join(', ')})`)
  console.log(`    Lanche:        ${lanches.length} (semanas ${lanches.map(l => l.semana_num).join(', ')})`)
  console.log(`    Fruta:         ${frutas.length} (semanas ${frutas.map(f => f.semana_num).join(', ')})`)

  // Carregar preparações do banco
  console.log('\n── CARREGANDO PREPARAÇÕES ──')
  const preparacoesBanco = await prisma.preparacao.findMany({ select: { id: true, nome: true } })
  console.log(`  ✓ ${preparacoesBanco.length} preparações no banco`)

  // Mapear preparações
  console.log('\n── MAPEANDO PREPARAÇÕES ──')
  const nomesUnicos = new Set<string>()
  for (const ref of refeicoes) {
    for (const dia of ref.dias) {
      for (const prep of dia.preparacoes) {
        nomesUnicos.add(prep)
      }
    }
  }
  console.log(`  📝 ${nomesUnicos.size} preparações únicas no CSV`)

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
      if (!melhor || scoreFinal > melhor.score) {
        melhor = { id: prep.id, nome: prep.nome, score: scoreFinal }
      }
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
      if (!match) {
        console.log(`  ✗ "${nome}"`)
      } else if (match.score < 0.8) {
        console.log(`  ⚠️  "${nome}" → "${match.nome}" (score=${match.score.toFixed(2)})`)
      }
    }
  }

  // Buscar/Criar cardápio APAE
  console.log(`\n── CARDÁPIO "${NOME_CARDAPIO}" ──`)
  let cardapio = await prisma.cardapioNutricional.findFirst({
    where: { nome: NOME_CARDAPIO, categoria_escola: 'APAE', escola_id: null },
    include: { semanas: { select: { id: true, numero: true, dias: { select: { id: true, dia_semana: true } } } } },
  })

  if (!cardapio) {
    console.log(`  ⚠️  Cardápio "${NOME_CARDAPIO}" não encontrado. Criando...`)
    const nutricionista = await prisma.nutricionista.findFirst({ where: { ativo: true } })
    if (!nutricionista) {
      console.error('❌ Nenhum nutricionista ativo!')
      process.exit(1)
    }
    const ano = new Date().getFullYear()
    const semestre = new Date().getMonth() >= 6 ? 2 : 1

    if (MODO_APLICAR) {
      cardapio = await prisma.cardapioNutricional.create({
        data: {
          nome: NOME_CARDAPIO,
          escola_id: null,
          nutricionista_id: nutricionista.id,
          categoria_escola: 'APAE',
          fase_escolar: 'FUND_FINAL',  // APAE não tem fase específica, usa final como base
          ano, semestre,
          status: 'RASCUNHO',
          criado_em: new Date().toISOString().replace('T', ' ').substring(0, 19),
          atualizado_em: new Date().toISOString().replace('T', ' ').substring(0, 19),
          ciclo_semanas: 5,
          repetir_ciclo: true,
          semanas: {
            create: Array.from({ length: 5 }, (_, i) => ({
              numero: i + 1, data_inicio: '', data_fim: '',
              dias: { create: ['segunda','terca','quarta','quinta','sexta'].map(d => ({ dia_semana: d })) },
            })),
          },
        },
        include: { semanas: { select: { id: true, numero: true, dias: { select: { id: true, dia_semana: true } } } } },
      })
      console.log(`  ✅ Cardápio criado: "${cardapio.nome}" — ${cardapio.semanas.length} semanas`)
    } else {
      console.log('  (dry-run — cardápio seria criado)')
      cardapio = {
        id: 'dry-run', nome: NOME_CARDAPIO, ano, semestre,
        semanas: Array.from({ length: 5 }, (_, i) => ({
          id: `dry-${i}`, numero: i + 1,
          dias: ['segunda','terca','quarta','quinta','sexta'].map(d => ({ id: `dry-${i}-${d}`, dia_semana: d })),
        })),
      } as any
    }
  } else {
    console.log(`  ✓ Cardápio encontrado: "${cardapio.nome}" — ${cardapio.semanas.length} semanas`)
  }

  // Buscar tipos de refeição para APAE
  const catsRefeicao = await prisma.categoriaRefeicao.findMany({
    where: { categoria_escola: 'APAE' },
    include: { tipo_refeicao: true },
  })
  console.log(`  ✓ ${catsRefeicao.length} refeições para APAE`)

  if (catsRefeicao.length === 0) {
    console.error('❌ Nenhuma refeição configurada para APAE! Rode o script setup-apae-v817.ts --apply primeiro.')
    process.exit(1)
  }

  for (const cr of catsRefeicao) {
    console.log(`    ${cr.tipo_refeicao.codigo} — ${cr.tipo_refeicao.nome} (${cr.tipo_refeicao.horario})`)
  }

  const refeicaoCafe = catsRefeicao.find(cr => cr.tipo_refeicao.codigo === 'CAFE_MANHA')
  const refeicaoLanche = catsRefeicao.find(cr => cr.tipo_refeicao.codigo === 'LANCHE')
  const refeicaoFruta = catsRefeicao.find(cr => cr.tipo_refeicao.codigo === 'FRUTA_MANHA')

  if (!refeicaoCafe || !refeicaoLanche || !refeicaoFruta) {
    console.error('❌ Não encontrei CAFE_MANHA, LANCHE e FRUTA_MANHA para APAE!')
    process.exit(1)
  }

  // Preview
  console.log('\n── PREVIEW: primeira semana ──')
  const semana1 = refeicoes.filter(r => r.semana_num === 1)
  for (const ref of semana1) {
    console.log(`\n  Semana ${ref.semana_num} ${ref.tipo}:`)
    for (const dia of ref.dias) {
      if (dia.vazio) {
        console.log(`    ${dia.dia_semana}: X (vazio)`)
      } else {
        const preps = dia.preparacoes.map(p => {
          const m = mapaPreps.get(p)
          return m ? `✓${p}` : `✗${p}`
        })
        console.log(`    ${dia.dia_semana}: ${preps.join(' | ')}`)
      }
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

  let totalItens = 0
  let totalDiasVazios = 0

  for (const ref of refeicoes) {
    const tipoRefeicaoId = ref.tipo === 'cafe'
      ? refeicaoCafe!.tipo_refeicao.id
      : ref.tipo === 'lanche'
        ? refeicaoLanche!.tipo_refeicao.id
        : refeicaoFruta!.tipo_refeicao.id

    const semanaCardapio = cardapio!.semanas.find(s => s.numero === ref.semana_num)
    if (!semanaCardapio) {
      console.log(`  ⚠️  Semana ${ref.semana_num} não existe no cardápio — pulando`)
      continue
    }

    for (const dia of ref.dias) {
      const diaCardapio = semanaCardapio.dias.find(d => d.dia_semana === dia.dia_semana)
      if (!diaCardapio) continue

      // Remover itens existentes do slot
      await prisma.cardapioItem.deleteMany({
        where: { dia_id: diaCardapio.id, tipo_refeicao_id: tipoRefeicaoId },
      })

      if (dia.vazio) {
        totalDiasVazios++
        continue
      }

      // v8.14: coletar TODOS os itens e fazer createMany (1 query)
      const itensParaCriar: Array<{ dia_id: string; tipo_refeicao_id: string; preparacao_id: string; porcoes: number; ordem: number }> = []
      for (const prepNome of dia.preparacoes) {
        const match = mapaPreps.get(prepNome)
        if (!match) continue
        itensParaCriar.push({
          dia_id: diaCardapio.id,
          tipo_refeicao_id: tipoRefeicaoId,
          preparacao_id: match.id,
          porcoes: 1,
          ordem: 0,
        })
      }

      if (itensParaCriar.length > 0) {
        await prisma.cardapioItem.createMany({ data: itensParaCriar })
        totalItens += itensParaCriar.length
      }
    }

    console.log(`  ✓ Semana ${ref.semana_num} ${ref.tipo} — ${ref.dias.reduce((a, d) => a + (d.vazio ? 0 : d.preparacoes.length), 0)} preparações`)
  }

  console.log(`\n✅ ${totalItens} itens adicionados`)
  console.log(`✅ ${totalDiasVazios} dias vazios`)
  console.log(`\n📋 Cardápio "${NOME_CARDAPIO}" pronto para editar/replicar.`)
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
