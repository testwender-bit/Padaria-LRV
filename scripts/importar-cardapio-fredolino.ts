// ============================================================
// scripts/importar-cardapio-fredolino.ts
// ============================================================
// Importa cardápio do Fredolino (escola INTERIOR — Lanche + Almoço)
// 
// ESTRUTURA DO ODT (diferente da Regular):
//   - Cada linha = 1 refeição de 1 semana (lanche OU almoço)
//   - Célula 0: "Semana N lanche" ou "Semana N almocõ"
//   - Células 1-5: dias segunda a sexta (cada célula tem várias preparações separadas por |)
//   - "X" = dia sem refeição (feriado/ferias)
//
// CRIA:
//   - Cardápio categoria INTERIOR (escola_id = null)
//   - 22 semanas × 5 dias
//   - 2 refeições por dia: Lanche + Almoço
//
// USO:
//   npx tsx scripts/importar-cardapio-fredolino.ts          # dry-run
//   npx tsx scripts/importar-cardapio-fredolino.ts --apply   # aplicar
// ============================================================

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const MODO_APLICAR = args.includes('--apply')

const ODT_PATH = path.resolve(process.cwd(), 'Fredolino.odt')

// ── EXTRAIR TABELAS DO ODT ──────────────────────────────────

function extrairTabelasDoODT(odtPath: string): any[][][] {
  const tmpDir = '/tmp/odt-fredolino-import'
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

// ── PARSER ──────────────────────────────────────────────────

interface RefeicaoImport {
  semana_num: number
  tipo: 'lanche' | 'almoco'
  dias: Array<{ dia_semana: string; preparacoes: string[]; vazio: boolean }>
}

function parseTabelas(tabelas: any[][][]): RefeicaoImport[] {
  const refeicoes: RefeicaoImport[] = []
  const diasMap = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

  for (const tabela of tabelas) {
    for (let ri = 1; ri < tabela.length; ri++) {
      const row = tabela[ri]
      if (!row || row.length < 2) continue

      // Célula 0: "Semana N lanche" ou "Semana N almocõ"
      const cell0 = row[0]
      const label = cell0.join(' ').trim()
      if (!label) continue

      // Extrair número da semana e tipo
      const match = label.match(/semana\s*(\d+)\s*(lanche|almoc)/i)
      if (!match) continue

      const semanaNum = parseInt(match[1])
      const tipo = match[2].toLowerCase().startsWith('lanche') ? 'lanche' : 'almoco'

      // Células 1-5 = dias
      const dias: Array<{ dia_semana: string; preparacoes: string[]; vazio: boolean }> = []
      for (let ci = 1; ci < row.length && ci <= 5; ci++) {
        const cell = row[ci]
        // Verificar se é "X" (dia vazio)
        const cellText = cell.join(' ').trim()
        const vazio = cellText === 'X' || cellText === '' || /^(x|ferias|feriado)$/i.test(cellText)

        // Preparações separadas por | (pipe) dentro de cada parágrafo
        // ou separadas por parágrafos diferentes
        const preparacoes: string[] = []
        for (const para of cell) {
          // Cada parágrafo pode ter múltiplas preparações separadas por |
          const parts = para.split('|').map(p => p.trim()).filter(p => p && p !== 'X')
          preparacoes.push(...parts)
        }

        dias.push({
          dia_semana: diasMap[ci - 1] || `dia${ci}`,
          preparacoes: vazio ? [] : preparacoes,
          vazio,
        })
      }

      refeicoes.push({ semana_num: semanaNum, tipo, dias })
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
  console.log('📥 IMPORTAR CARDÁPIO FREDOLINO (Interior — Lanche + Almoço)')
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
  console.log(`  ✓ ${refeicoes.length} refeições extraídas (lanche + almoço)`)

  // Estatísticas
  const lanches = refeicoes.filter(r => r.tipo === 'lanche')
  const almocos = refeicoes.filter(r => r.tipo === 'almoco')
  console.log(`    Lanches: ${lanches.length} (semanas ${lanches.map(l => l.semana_num).join(', ')})`)
  console.log(`    Almoços: ${almocos.length} (semanas ${almocos.map(a => a.semana_num).join(', ')})`)

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

  // Buscar/Criar cardápio INTERIOR
  console.log('\n── CARDÁPIO INTERIOR BASE ──')
  let cardapio = await prisma.cardapioNutricional.findFirst({
    where: { categoria_escola: 'INTERIOR', escola_id: null },
    include: { semanas: { select: { id: true, numero: true, dias: { select: { id: true, dia_semana: true } } } } },
  })

  if (!cardapio) {
    console.log('  ⚠️  Cardápio Interior base não encontrado. Criando...')
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
          nome: `Cardápio Interior ${ano}/${semestre}`,
          escola_id: null,
          nutricionista_id: nutricionista.id,
          categoria_escola: 'INTERIOR',
          fase_escolar: 'FUND_FINAL',
          ano, semestre,
          status: 'RASCUNHO',
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
          ciclo_semanas: 5,
          repetir_ciclo: true,
          semanas: {
            create: Array.from({ length: 22 }, (_, i) => ({
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
        id: 'dry-run', nome: `Cardápio Interior ${ano}/${semestre}`, ano, semestre,
        semanas: Array.from({ length: 22 }, (_, i) => ({
          id: `dry-${i}`, numero: i + 1,
          dias: ['segunda','terca','quarta','quinta','sexta'].map(d => ({ id: `dry-${i}-${d}`, dia_semana: d })),
        })),
      } as any
    }
  } else {
    console.log(`  ✓ Cardápio encontrado: "${cardapio.nome}" — ${cardapio.semanas.length} semanas`)
  }

  // Buscar tipos de refeição para INTERIOR (Lanche + Almoço)
  const catsRefeicao = await prisma.categoriaRefeicao.findMany({
    where: { categoria_escola: 'INTERIOR' },
    include: { tipo_refeicao: true },
  })
  console.log(`  ✓ ${catsRefeicao.length} refeições para INTERIOR`)
  for (const cr of catsRefeicao) {
    console.log(`    ${cr.tipo_refeicao.codigo} — ${cr.tipo_refeicao.nome} (${cr.tipo_refeicao.horario})`)
  }

  // Mapear códigos TACO para IDs de refeição
  // INTERIOR tem: ALMOCO + LANCHE
  const refeicaoLanche = catsRefeicao.find(cr => cr.tipo_refeicao.codigo === 'LANCHE')
  const refeicaoAlmoco = catsRefeicao.find(cr => cr.tipo_refeicao.codigo === 'ALMOCO')

  if (!refeicaoLanche || !refeicaoAlmoco) {
    console.error('❌ Não encontrei LANCHE e ALMOCO para INTERIOR!')
    console.log('Refeições disponíveis:', catsRefeicao.map(cr => cr.tipo_refeicao.codigo))
    process.exit(1)
  }

  console.log(`  ✓ Lanche → ${refeicaoLanche.tipo_refeicao.id}`)
  console.log(`  ✓ Almoço → ${refeicaoAlmoco.tipo_refeicao.id}`)

  // Preview
  console.log('\n── PREVIEW: 3 primeiras refeições ──')
  for (const ref of refeicoes.slice(0, 3)) {
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
    const tipoRefeicaoId = ref.tipo === 'lanche' ? refeicaoLanche!.tipo_refeicao.id : refeicaoAlmoco!.tipo_refeicao.id
    const semanaCardapio = cardapio!.semanas.find(s => s.numero === ref.semana_num)
    if (!semanaCardapio) {
      console.log(`  ⚠️  Semana ${ref.semana_num} não existe no cardápio — pulando`)
      continue
    }

    for (const dia of ref.dias) {
      const diaCardapio = semanaCardapio.dias.find(d => d.dia_semana === dia.dia_semana)
      if (!diaCardapio) continue

      // Remover itens existentes
      await prisma.cardapioItem.deleteMany({
        where: { dia_id: diaCardapio.id, tipo_refeicao_id: tipoRefeicaoId },
      })

      if (dia.vazio) {
        totalDiasVazios++
        continue
      }

      // Adicionar preparações
      for (const prepNome of dia.preparacoes) {
        const match = mapaPreps.get(prepNome)
        if (!match) continue

        const existente = await prisma.cardapioItem.findUnique({
          where: {
            dia_id_tipo_refeicao_id_preparacao_id: {
              dia_id: diaCardapio.id, tipo_refeicao_id: tipoRefeicaoId, preparacao_id: match.id,
            },
          },
        })
        if (existente) continue

        await prisma.cardapioItem.create({
          data: { dia_id: diaCardapio.id, tipo_refeicao_id: tipoRefeicaoId, preparacao_id: match.id, porcoes: 1, ordem: 0 },
        })
        totalItens++
      }
    }

    console.log(`  ✓ Semana ${ref.semana_num} ${ref.tipo} — ${ref.dias.reduce((a, d) => a + (d.vazio ? 0 : d.preparacoes.length), 0)} preparações`)
  }

  console.log(`\n✅ ${totalItens} itens adicionados`)
  console.log(`✅ ${totalDiasVazios} dias vazios (X)`)
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
