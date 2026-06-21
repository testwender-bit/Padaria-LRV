import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST — Move um item de cardápio para outro slot (dia/refeição) ou outra semana.
// Suporta também mudança de porções no mesmo movimento.
//
// Body:
//   { item_id: string,
//     destino: { semana_numero: number, dia_semana: string, tipo_refeicao_id: string },
//     porcoes?: number }
//
// Como CardapioItem tem unique constraint (dia_id, tipo_refeicao_id, preparacao_id),
// fazemos: deletar origem → upsert destino (preserva porções se não informado).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // 1. Carrega o item de origem
    const itemOrigem = await db.cardapioItem.findUnique({
      where: { id: body.item_id },
      include: {
        dia: { include: { semana: true } },
      },
    })

    if (!itemOrigem) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    }

    if (itemOrigem.dia.semana.cardapio_id !== id) {
      return NextResponse.json(
        { error: 'Item não pertence a este cardápio' },
        { status: 400 }
      )
    }

    // 2. Resolve o dia de destino
    const semanaDestino = await db.cardapioSemanaNutri.findUnique({
      where: {
        cardapio_id_numero: {
          cardapio_id: id,
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

    // Verifica se destino == origem (sem mudança real)
    const mesmaSemana = itemOrigem.dia.semana.numero === semana_numero
    const mesmoDia = itemOrigem.dia.dia_semana === dia_semana
    const mesmaRefeicao = itemOrigem.tipo_refeicao_id === tipo_refeicao_id

    if (mesmaSemana && mesmoDia && mesmaRefeicao) {
      // Só atualiza porções se informado
      if (body.porcoes !== undefined) {
        const updated = await db.cardapioItem.update({
          where: { id: body.item_id },
          data: { porcoes: body.porcoes },
          include: {
            tipo_refeicao: true,
            preparacao: {
              include: {
                ingredientes: { include: { alimento: true } },
              },
            },
          },
        })
        return NextResponse.json({ item: updated, action: 'updated' })
      }
      return NextResponse.json({ item: itemOrigem, action: 'noop' })
    }

    // 3. Transação: deleta origem → upsert destino
    const resultado = await db.$transaction(async (tx) => {
      // Salva dados antes de deletar
      const preparacao_id = itemOrigem.preparacao_id
      const porcoes = body.porcoes ?? itemOrigem.porcoes

      // Se já existe o mesmo item no destino, apenas atualiza porções e remove origem
      const existeDestino = await tx.cardapioItem.findUnique({
        where: {
          dia_id_tipo_refeicao_id_preparacao_id: {
            dia_id: diaDestino.id,
            tipo_refeicao_id,
            preparacao_id,
          },
        },
      })

      if (existeDestino) {
        // Soma porções no destino, remove origem
        await tx.cardapioItem.update({
          where: { id: existeDestino.id },
          data: { porcoes: existeDestino.porcoes + porcoes },
        })
        await tx.cardapioItem.delete({ where: { id: body.item_id } })
        // Decrementar vezes_usada porque o item original foi removido (mas o destino continua contando)
        await tx.preparacao.update({
          where: { id: preparacao_id },
          data: { vezes_usada: { decrement: 1 } },
        }).catch(() => {})
        return { item: existeDestino, action: 'merged' as const }
      }

      // Cria novo item no destino
      const novoItem = await tx.cardapioItem.create({
        data: {
          dia_id: diaDestino.id,
          tipo_refeicao_id,
          preparacao_id,
          porcoes,
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

      // Deleta origem
      await tx.cardapioItem.delete({ where: { id: body.item_id } })

      return { item: novoItem, action: 'moved' as const }
    })

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Erro ao mover item:', error)
    const message = error instanceof Error ? error.message : 'Erro ao mover item'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
