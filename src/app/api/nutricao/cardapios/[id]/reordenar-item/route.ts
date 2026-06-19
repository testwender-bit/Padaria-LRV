import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// POST /api/nutricao/cardapios/[id]/reordenar-item
// ============================================================
// Reordena um item dentro do slot (mesma refeição, mesmo dia).
// Body: { item_id: string, direcao: 'up' | 'down' }
//
// Lógica:
//   1. Encontra o item atual
//   2. Encontra o item acima/abaixo no mesmo slot
//   3. Se ambos têm ordem 0 (auto-sort), atribui ordem 1 e 2
//   4. Se já têm ordem, troca os valores
// ============================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await request.json()

    if (!body.item_id || !body.direcao) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: item_id, direcao (up|down)' },
        { status: 400 }
      )
    }

    // Carrega o item atual
    const itemAtual = await db.cardapioItem.findUnique({
      where: { id: body.item_id },
      include: { dia: { include: { semana: true } } },
    })

    if (!itemAtual) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    }

    if (itemAtual.dia.semana.cardapio_id !== cardapioId) {
      return NextResponse.json(
        { error: 'Item não pertence a este cardápio' },
        { status: 400 }
      )
    }

    // Busca todos os itens do mesmo slot (mesmo dia + mesma refeição)
    const itensSlot = await db.cardapioItem.findMany({
      where: {
        dia_id: itemAtual.dia_id,
        tipo_refeicao_id: itemAtual.tipo_refeicao_id,
      },
      include: { preparacao: { select: { nome: true } } },
      orderBy: { ordem: 'asc' },
    })

    if (itensSlot.length <= 1) {
      return NextResponse.json({ success: true, message: 'Só há um item no slot' })
    }

    // Se todos têm ordem 0, atribui ordens sequenciais primeiro
    const todosZero = itensSlot.every(i => i.ordem === 0)
    if (todosZero) {
      for (let i = 0; i < itensSlot.length; i++) {
        await db.cardapioItem.update({
          where: { id: itensSlot[i].id },
          data: { ordem: i + 1 },
        })
      }
      // Recarrega com as novas ordens
      const itensAtualizados = await db.cardapioItem.findMany({
        where: {
          dia_id: itemAtual.dia_id,
          tipo_refeicao_id: itemAtual.tipo_refeicao_id,
        },
        orderBy: { ordem: 'asc' },
      })

      // Encontra o índice do item atual
      const idxAtual = itensAtualizados.findIndex(i => i.id === body.item_id)
      if (idxAtual === -1) {
        return NextResponse.json({ error: 'Item não encontrado após reordenação' }, { status: 500 })
      }

      // Determina o índice do item a trocar
      const idxTroca = body.direcao === 'up' ? idxAtual - 1 : idxAtual + 1
      if (idxTroca < 0 || idxTroca >= itensAtualizados.length) {
        return NextResponse.json({ success: true, message: 'Item já está no extremo' })
      }

      // Troca as ordens
      const ordemAtual = itensAtualizados[idxAtual].ordem
      const ordemTroca = itensAtualizados[idxTroca].ordem

      await db.cardapioItem.update({
        where: { id: itensAtualizados[idxAtual].id },
        data: { ordem: ordemTroca },
      })
      await db.cardapioItem.update({
        where: { id: itensAtualizados[idxTroca].id },
        data: { ordem: ordemAtual },
      })
    } else {
      // Já têm ordens definidas — encontra o item acima/abaixo
      const idxAtual = itensSlot.findIndex(i => i.id === body.item_id)
      if (idxAtual === -1) {
        return NextResponse.json({ error: 'Item não encontrado' }, { status: 500 })
      }

      const idxTroca = body.direcao === 'up' ? idxAtual - 1 : idxAtual + 1
      if (idxTroca < 0 || idxTroca >= itensSlot.length) {
        return NextResponse.json({ success: true, message: 'Item já está no extremo' })
      }

      // Troca as ordens
      const ordemAtual = itensSlot[idxAtual].ordem
      const ordemTroca = itensSlot[idxTroca].ordem

      await db.cardapioItem.update({
        where: { id: itensSlot[idxAtual].id },
        data: { ordem: ordemTroca },
      })
      await db.cardapioItem.update({
        where: { id: itensSlot[idxTroca].id },
        data: { ordem: ordemAtual },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao reordenar item:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao reordenar item' },
      { status: 500 }
    )
  }
}
