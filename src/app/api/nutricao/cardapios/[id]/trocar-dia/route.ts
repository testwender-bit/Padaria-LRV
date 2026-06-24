import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// POST /api/nutricao/cardapios/[id]/trocar-dia
// ============================================================
// Troca TODOS os itens de dois dias da semana no cardápio.
// Útil para o usuário reorganizar o cardápio sem precisar mover item por item.
//
// Body:
//   {
//     semana_numero: number,        // 1..22
//     dia_a: "segunda"|"terca"|"quarta"|"quinta"|"sexta",
//     dia_b: "segunda"|"terca"|"quarta"|"quinta"|"sexta"
//   }
//
// Lógica:
//   1. Encontra a semana e os dois dias no cardápio
//   2. Carrega todos os itens de cada dia (todos os slots/refeições)
//   3. Apaga os itens de ambos os dias
//   4. Recria os itens de dia_a no dia_b, e os de dia_b no dia_a
//      (preservando tipo_refeicao_id, preparacao_id, porcoes, ordem)
//
// Como CardapioItem tem unique (dia_id, tipo_refeicao_id, preparacao_id),
// fazemos via snapshot + delete + create (não pode só atualizar dia_id
// porque poderia violar a constraint se ambos os dias têm a mesma preparação
// na mesma refeição).
//
// Retorno: { success: true, itens_trocados: N }
// ============================================================

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
        { error: 'dia_a e dia_b devem ser diferentes' },
        { status: 400 }
      )
    }

    const semanaNumero = Number(body.semana_numero)
    const diaA = body.dia_a
    const diaB = body.dia_b

    // Valida dias
    const diasValidos = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
    if (!diasValidos.includes(diaA)) {
      return NextResponse.json(
        { error: `dia_a inválido: ${diaA}. Use: ${diasValidos.join(', ')}` },
        { status: 400 }
      )
    }
    if (!diasValidos.includes(diaB)) {
      return NextResponse.json(
        { error: `dia_b inválido: ${diaB}. Use: ${diasValidos.join(', ')}` },
        { status: 400 }
      )
    }

    // Encontra a semana com os dois dias
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

    // Transação atômica: snapshot + delete + create cruzado
    const result = await db.$transaction(async (tx) => {
      // 1. Snapshot em memória dos itens de cada dia
      const itensA = await tx.cardapioItem.findMany({ where: { dia_id: diaAData.id } })
      const itensB = await tx.cardapioItem.findMany({ where: { dia_id: diaBData.id } })

      // 2. Apaga todos os itens de ambos os dias
      await tx.cardapioItem.deleteMany({ where: { dia_id: diaAData.id } })
      await tx.cardapioItem.deleteMany({ where: { dia_id: diaBData.id } })

      // 3. Recria itens de A no dia B (preservando tipo_refeicao_id, preparacao_id, porcoes, ordem)
      for (const item of itensA) {
        await tx.cardapioItem.create({
          data: {
            dia_id: diaBData.id,
            tipo_refeicao_id: item.tipo_refeicao_id,
            preparacao_id: item.preparacao_id,
            porcoes: item.porcoes,
            ordem: item.ordem || 0,
          },
        })
      }

      // 4. Recria itens de B no dia A
      for (const item of itensB) {
        await tx.cardapioItem.create({
          data: {
            dia_id: diaAData.id,
            tipo_refeicao_id: item.tipo_refeicao_id,
            preparacao_id: item.preparacao_id,
            porcoes: item.porcoes,
            ordem: item.ordem || 0,
          },
        })
      }

      return {
        itens_trocados: itensA.length + itensB.length,
        itens_a: itensA.length,
        itens_b: itensB.length,
      }
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Erro ao trocar dias:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao trocar dias' },
      { status: 500 }
    )
  }
}
