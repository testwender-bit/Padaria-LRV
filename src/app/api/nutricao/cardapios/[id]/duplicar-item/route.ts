import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// POST /api/nutricao/cardapios/[id]/duplicar-item
// ============================================================
// Duplica um item para outro slot (dia/refeição) SEM remover a origem.
// Se já existe a mesma preparação no destino, soma porções (upsert).
//
// Body: { item_id: string, destino: { semana_numero: number, dia_semana: string, tipo_refeicao_id: string } }
// ============================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await request.json()

    if (!body.item_id || !body.destino) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: item_id, destino { semana_numero, dia_semana, tipo_refeicao_id }' },
        { status: 400 }
      )
    }

    const { semana_numero, dia_semana, tipo_refeicao_id } = body.destino
    if (!semana_numero || !dia_semana || !tipo_refeicao_id) {
      return NextResponse.json(
        { error: 'destino precisa de: semana_numero, dia_semana, tipo_refeicao_id' },
        { status: 400 }
      )
    }

    // Carrega o item de origem
    const itemOrigem = await db.cardapioItem.findUnique({
      where: { id: body.item_id },
      include: { dia: { include: { semana: true } } },
    })

    if (!itemOrigem) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    }

    if (itemOrigem.dia.semana.cardapio_id !== cardapioId) {
      return NextResponse.json(
        { error: 'Item não pertence a este cardápio' },
        { status: 400 }
      )
    }

    // Resolve o dia de destino
    const semanaDestino = await db.cardapioSemanaNutri.findUnique({
      where: {
        cardapio_id_numero: {
          cardapio_id: cardapioId,
          numero: semana_numero,
        },
      },
    })

    if (!semanaDestino) {
      return NextResponse.json(
        { error: `Semana ${semana_numero} não encontrada neste cardápio` },
        { status: 404 }
      )
    }

    const diaDestino = await db.cardapioDiaNutri.findUnique({
      where: {
        semana_id_dia_semana: {
          semana_id: semanaDestino.id,
          dia_semana,
        },
      },
    })

    if (!diaDestino) {
      return NextResponse.json(
        { error: `Dia ${dia_semana} não encontrado na semana ${semana_numero}` },
        { status: 404 }
      )
    }

    // Upsert no destino (se já existe, soma porções)
    const existente = await db.cardapioItem.findUnique({
      where: {
        dia_id_tipo_refeicao_id_preparacao_id: {
          dia_id: diaDestino.id,
          tipo_refeicao_id,
          preparacao_id: itemOrigem.preparacao_id,
        },
      },
    })

    if (existente) {
      // Soma porções
      const updated = await db.cardapioItem.update({
        where: { id: existente.id },
        data: { porcoes: existente.porcoes + itemOrigem.porcoes },
        include: {
          tipo_refeicao: true,
          preparacao: {
            include: {
              ingredientes: { include: { alimento: true } },
            },
          },
        },
      })
      return NextResponse.json({ item: updated, action: 'merged' })
    }

    // Cria novo item no destino
    const novoItem = await db.cardapioItem.create({
      data: {
        dia_id: diaDestino.id,
        tipo_refeicao_id,
        preparacao_id: itemOrigem.preparacao_id,
        porcoes: itemOrigem.porcoes,
        ordem: 0,  // auto-sort
      },
      include: {
        tipo_refeicao: true,
        preparacao: {
          include: {
            ingredientes: { include: { alimento: true } },
          },
        },
      },
    })

    return NextResponse.json({ item: novoItem, action: 'duplicated' })
  } catch (error) {
    console.error('Erro ao duplicar item:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao duplicar item' },
      { status: 500 }
    )
  }
}
