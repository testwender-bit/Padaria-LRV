import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST — Add/update item(s). Supports single item or batch via { items: [...] }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Support single item or batch
    const items = Array.isArray(body.items) ? body.items : [body]

    // Validate all items
    for (const item of items) {
      if (!item.tipo_refeicao_id || !item.preparacao_id) {
        return NextResponse.json(
          { error: 'Campos obrigatórios por item: tipo_refeicao_id, preparacao_id (e dia_id OU semana_numero+dia_semana)' },
          { status: 400 }
        )
      }
      if (!item.dia_id && (item.semana_numero === undefined || !item.dia_semana)) {
        return NextResponse.json(
          { error: 'Informe dia_id OU (semana_numero + dia_semana) para cada item' },
          { status: 400 }
        )
      }
    }

    // Verificar se o cardápio existe
    const cardapio = await db.cardapioNutricional.findUnique({ where: { id } })
    if (!cardapio) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    // Process all items in an interactive transaction
    const results = await db.$transaction(async (tx) => {
      const created: unknown[] = []

      for (const itemData of items) {
        let diaId = itemData.dia_id as string | undefined

        // Resolve dia_id if not provided directly
        if (!diaId) {
          const semana = await tx.cardapioSemanaNutri.findUnique({
            where: {
              cardapio_id_numero: {
                cardapio_id: id,
                numero: itemData.semana_numero,
              },
            },
          })
          if (!semana) {
            throw new Error(`Semana ${itemData.semana_numero} não encontrada neste cardápio`)
          }

          const dia = await tx.cardapioDiaNutri.findUnique({
            where: {
              semana_id_dia_semana: {
                semana_id: semana.id,
                dia_semana: itemData.dia_semana,
              },
            },
          })
          if (!dia) {
            throw new Error(`Dia ${itemData.dia_semana} não encontrado na semana ${itemData.semana_numero}`)
          }
          diaId = dia.id
        } else {
          // Verify dia_id belongs to this cardápio
          const dia = await tx.cardapioDiaNutri.findUnique({
            where: { id: diaId },
            include: { semana: true },
          })
          if (!dia || dia.semana.cardapio_id !== id) {
            throw new Error('Dia não pertence a este cardápio')
          }
        }

        // Upsert the item
        const result = await tx.cardapioItem.upsert({
          where: {
            dia_id_tipo_refeicao_id_preparacao_id: {
              dia_id: diaId,
              tipo_refeicao_id: itemData.tipo_refeicao_id,
              preparacao_id: itemData.preparacao_id,
            },
          },
          update: {
            porcoes: itemData.porcoes ?? 1,
          },
          create: {
            dia_id: diaId,
            tipo_refeicao_id: itemData.tipo_refeicao_id,
            preparacao_id: itemData.preparacao_id,
            porcoes: itemData.porcoes ?? 1,
          },
          include: {
            tipo_refeicao: true,
            preparacao: {
              include: {
                ingredientes: {
                  include: {
                    alimento: true,
                  },
                },
              },
            },
          },
        })
        // Incrementar contador "vezes_usada" na preparação (biblioteca inteligente)
        await tx.preparacao.update({
          where: { id: itemData.preparacao_id },
          data: { vezes_usada: { increment: 1 } },
        })
        created.push(result)
      }

      return created
    })

    // Return single item or array based on input
    return NextResponse.json(
      Array.isArray(body.items) ? results : results[0],
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao adicionar/atualizar item do cardápio:', error)
    const message = error instanceof Error ? error.message : 'Erro ao adicionar/atualizar item do cardápio'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH — Update item (e.g., porções)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!body.item_id) {
      return NextResponse.json(
        { error: 'Campo obrigatório: item_id' },
        { status: 400 }
      )
    }

    // Verify item belongs to this cardápio
    const item = await db.cardapioItem.findUnique({
      where: { id: body.item_id },
      include: {
        dia: {
          include: {
            semana: true,
          },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    }

    if (item.dia.semana.cardapio_id !== id) {
      return NextResponse.json(
        { error: 'Item não pertence a este cardápio' },
        { status: 400 }
      )
    }

    // Update only provided fields
    const updateData: { porcoes?: number } = {}
    if (body.porcoes !== undefined) {
      updateData.porcoes = body.porcoes
    }

    const updated = await db.cardapioItem.update({
      where: { id: body.item_id },
      data: updateData,
      include: {
        tipo_refeicao: true,
        preparacao: {
          include: {
            ingredientes: {
              include: {
                alimento: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao atualizar item do cardápio:', error)
    return NextResponse.json({ error: 'Erro ao atualizar item do cardápio' }, { status: 500 })
  }
}

// DELETE — Remove item
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!body.item_id) {
      return NextResponse.json(
        { error: 'Campo obrigatório: item_id' },
        { status: 400 }
      )
    }

    // Verificar se o item pertence a este cardápio
    const item = await db.cardapioItem.findUnique({
      where: { id: body.item_id },
      include: {
        dia: {
          include: {
            semana: true,
          },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    }

    if (item.dia.semana.cardapio_id !== id) {
      return NextResponse.json(
        { error: 'Item não pertence a este cardápio' },
        { status: 400 }
      )
    }

    await db.cardapioItem.delete({
      where: { id: body.item_id },
    })

    // Decrementar contador "vezes_usada" (mínimo 0)
    await db.preparacao.update({
      where: { id: item.preparacao_id },
      data: { vezes_usada: { decrement: 1 } },
    }).catch(() => {
      // ignore if already 0 / not found
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao remover item do cardápio:', error)
    return NextResponse.json({ error: 'Erro ao remover item do cardápio' }, { status: 500 })
  }
}
