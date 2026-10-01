import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// POST /api/nutricao/cardapios/[id]/trocar-dia             v9.10.3
// ============================================================
// Troca o DIA INTEIRO de lugar: todas as preparações do dia A
// vão para o dia B e as do dia B vão para o dia A (mesma semana).
// Usado pelo "Modo trocar dia" do editor (botão 📅⇄ no cabeçalho
// de cada dia, ao lado do ⇄ de preparações e do Copiar).
//
// Body:
//   {
//     semana_numero: number,        // 1..22
//     dia_a: "segunda"|"terca"|"quarta"|"quinta"|"sexta",
//     dia_b: "segunda"|"terca"|"quarta"|"quinta"|"sexta"
//   }
//
// Lógica (snapshot + delete + create cruzado):
//   1. Encontra a semana e os dois dias no cardápio
//   2. Snapshot em memória dos itens de cada dia (todos os slots)
//   3. Apaga TODOS os itens de ambos os dias
//   4. Recria os itens de A no dia B e os de B no dia A
//      (preservando tipo_refeicao_id, preparacao_id, porcoes, ordem)
//
// Por que delete+create (e não mover/reaproveitar linhas):
//   - Os dois dias podem ter QUANTIDADES DIFERENTES de itens por
//     slot (ex: Terça tem 1 item no Desjejum, Quarta tem 2) — não há
//     correspondência 1:1 para trocar conteúdo como na trocar-itens.
//   - CardapioItem tem unique (dia_id, tipo_refeicao_id, preparacao_id):
//     como ZERAMOS os dois dias antes de recriar, cada dia recebe um
//     único lote vindo de um dia válido — impossível violar a unique.
//
// PGBOUNCER (lição v9.10.1/v8.14): SEM $transaction. São no máximo
// 2 deleteMany + 2 createMany (1 query por lote). Transação com
// loop de creates quebrava com P2028 no pooler transaction mode.
// Reexecutável: se algo falhar no meio, rodar a troca de novo
// completa o movimento (dias vazios simplesmente não recriam nada).
//
// Retorno: { success: true, itens_trocados: N, itens_a, itens_b }
// ============================================================

const DIAS_VALIDOS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await request.json()

    if (!body.semana_numero || !body.dia_a || !body.dia_b) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: semana_numero, dia_a, dia_b' },
        { status: 400 }
      )
    }

    if (body.dia_a === body.dia_b) {
      return NextResponse.json(
        { error: 'Selecione dois dias diferentes para trocar' },
        { status: 400 }
      )
    }

    const semanaNumero = Number(body.semana_numero)
    const diaA = body.dia_a
    const diaB = body.dia_b

    if (!DIAS_VALIDOS.includes(diaA)) {
      return NextResponse.json(
        { error: `dia_a inválido: ${diaA}. Use: ${DIAS_VALIDOS.join(', ')}` },
        { status: 400 }
      )
    }
    if (!DIAS_VALIDOS.includes(diaB)) {
      return NextResponse.json(
        { error: `dia_b inválido: ${diaB}. Use: ${DIAS_VALIDOS.join(', ')}` },
        { status: 400 }
      )
    }

    // Encontra a semana com os dois dias (a busca já é escopada pelo
    // cardapio_id — dias de outro cardápio nunca são alcançados aqui)
    const semana = await db.cardapioSemanaNutri.findUnique({
      where: {
        cardapio_id_numero: {
          cardapio_id: cardapioId,
          numero: semanaNumero,
        },
      },
      include: {
        dias: {
          where: {
            dia_semana: { in: [diaA, diaB] },
          },
          include: { itens: true },
        },
      },
    })

    if (!semana) {
      return NextResponse.json(
        { error: `Semana ${semanaNumero} não encontrada neste cardápio` },
        { status: 404 }
      )
    }

    if (semana.dias.length < 2) {
      return NextResponse.json(
        { error: `Precisa de 2 dias na semana (${diaA} e ${diaB}). Encontrados: ${semana.dias.map(d => d.dia_semana).join(', ') || 'nenhum'}` },
        { status: 404 }
      )
    }

    const diaAData = semana.dias.find(d => d.dia_semana === diaA)!
    const diaBData = semana.dias.find(d => d.dia_semana === diaB)!

    // Snapshot em memória ANTES de apagar (padrão copiar/gerar-ciclo v9.10.1)
    const itensA = diaAData.itens
    const itensB = diaBData.itens

    // Dias ambos vazios: nada a trocar (evita writes inúteis)
    if (itensA.length === 0 && itensB.length === 0) {
      return NextResponse.json({
        success: true,
        noop: true,
        message: 'Os dois dias estão vazios — nada para trocar',
        itens_trocados: 0,
        itens_a: 0,
        itens_b: 0,
      })
    }

    // 1. Zera os dois dias (sempre os DOIS antes de recriar — garante
    //    que nenhum dia receba lote com conflito de unique)
    await db.cardapioItem.deleteMany({ where: { dia_id: diaAData.id } })
    await db.cardapioItem.deleteMany({ where: { dia_id: diaBData.id } })

    // 2. Recria cruzado com createMany (1 query por lote — pgbouncer-safe)
    if (itensA.length > 0) {
      await db.cardapioItem.createMany({
        data: itensA.map(item => ({
          dia_id: diaBData.id,
          tipo_refeicao_id: item.tipo_refeicao_id,
          preparacao_id: item.preparacao_id,
          porcoes: item.porcoes,
          ordem: item.ordem || 0,
        })),
      })
    }
    if (itensB.length > 0) {
      await db.cardapioItem.createMany({
        data: itensB.map(item => ({
          dia_id: diaAData.id,
          tipo_refeicao_id: item.tipo_refeicao_id,
          preparacao_id: item.preparacao_id,
          porcoes: item.porcoes,
          ordem: item.ordem || 0,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      itens_trocados: itensA.length + itensB.length,
      itens_a: itensA.length,
      itens_b: itensB.length,
    })
  } catch (error) {
    console.error('Erro ao trocar dias:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao trocar dias' },
      { status: 500 }
    )
  }
}
