import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// POST /api/nutricao/cardapios/[id]/diferenciar-semana
// ============================================================
// Marca ou desmarca uma semana como "diferenciada" — indicando que
// foi manualmente ajustada após a replicação e não é mais uma cópia
// fiel do cardápio base.
//
// Body:
//   { semana_numero: number, diferenciada?: boolean }
//   - diferenciada=true  → marca como modificada (badge "Modificada")
//   - diferenciada=false → desmarca (volta a ser "Cópia do base")
//   - se omitido, alterna (toggle)
// ============================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await request.json()

    if (body.semana_numero === undefined || typeof body.semana_numero !== 'number') {
      return NextResponse.json(
        { error: 'Campo obrigatório: semana_numero (number)' },
        { status: 400 }
      )
    }

    // Busca a semana
    const semana = await db.cardapioSemanaNutri.findUnique({
      where: {
        cardapio_id_numero: {
          cardapio_id: cardapioId,
          numero: body.semana_numero,
        },
      },
    })

    if (!semana) {
      return NextResponse.json(
        { error: `Semana ${body.semana_numero} não encontrada neste cardápio` },
        { status: 404 }
      )
    }

    // Define o novo estado: toggle se não informado
    const novoEstado = body.diferenciada !== undefined
      ? Boolean(body.diferenciada)
      : !semana.diferenciada

    const atualizada = await db.cardapioSemanaNutri.update({
      where: { id: semana.id },
      data: { diferenciada: novoEstado },
    })

    return NextResponse.json({
      semana_id: atualizada.id,
      numero: atualizada.numero,
      diferenciada: atualizada.diferenciada,
      message: novoEstado
        ? `Semana ${atualizada.numero} marcada como modificada`
        : `Semana ${atualizada.numero} restaurada como cópia do base`,
    })
  } catch (error) {
    console.error('Erro ao diferenciar semana:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao diferenciar semana' },
      { status: 500 }
    )
  }
}
