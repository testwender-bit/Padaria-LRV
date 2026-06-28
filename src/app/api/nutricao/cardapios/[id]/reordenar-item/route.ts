import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// POST /api/nutricao/cardapios/[id]/reordenar-item
// ============================================================
// Reordena um item dentro do slot (mesma refeição, mesmo dia).
//
// Body (2 modos):
//   Modo 1 (legado): { item_id: string, direcao: 'up' | 'down' }
//   Modo 2 (v9.0):   { item_id: string, direcao, ordens_completas: [{item_id, ordem}] }
//
// v9.0: Modo 2 (ordens_completas) é preferido — o editor envia TODAS as
// ordens do slot de uma vez, garantindo consistência total.
// O modo 1 (legado) ainda funciona para compatibilidade.
//
// Lógica v9.0:
//   - Se receber ordens_completas: aplica todas as ordens diretamente (LOCK MANUAL)
//   - Senão (modo legado): aplica lógica antiga (troca 2 itens)
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

    // ── MODO 2 (v9.0): ordens_completas ──
    // Aplica TODAS as ordens do slot de uma vez. Garante consistência total.
    if (Array.isArray(body.ordens_completas) && body.ordens_completas.length > 0) {
      // Verifica que todos os itens pertencem a este cardápio
      for (const itemOrdem of body.ordens_completas) {
        const item = await db.cardapioItem.findUnique({
          where: { id: itemOrdem.item_id },
          include: { dia: { include: { semana: true } } },
        })
        if (!item) {
          return NextResponse.json({ error: `Item ${itemOrdem.item_id} não encontrado` }, { status: 404 })
        }
        if (item.dia.semana.cardapio_id !== cardapioId) {
          return NextResponse.json({ error: `Item ${itemOrdem.item_id} não pertence a este cardápio` }, { status: 400 })
        }
      }

      // Aplica todas as ordens
      for (const itemOrdem of body.ordens_completas) {
        await db.cardapioItem.update({
          where: { id: itemOrdem.item_id },
          data: { ordem: itemOrdem.ordem },
        })
      }

      return NextResponse.json({ success: true, modo: 'ordens_completas', atualizados: body.ordens_completas.length })
    }

    // ── MODO 1 (legado): troca 2 itens ──
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
      orderBy: { ordem: 'asc' },
    })

    if (itensSlot.length <= 1) {
      return NextResponse.json({ success: true, message: 'Só há um item no slot' })
    }

    // v9.0: Se todos têm ordem 0, atribui ordens sequenciais primeiro
    // (baseado na ordem do banco — que deve ser a ordem visual)
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

      const idxAtual = itensAtualizados.findIndex(i => i.id === body.item_id)
      if (idxAtual === -1) {
        return NextResponse.json({ error: 'Item não encontrado após reordenação' }, { status: 500 })
      }

      const idxTroca = body.direcao === 'up' ? idxAtual - 1 : idxAtual + 1
      if (idxTroca < 0 || idxTroca >= itensAtualizados.length) {
        return NextResponse.json({ success: true, message: 'Item já está no extremo' })
      }

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

    return NextResponse.json({ success: true, modo: 'legado' })
  } catch (error) {
    console.error('Erro ao reordenar item:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao reordenar item' },
      { status: 500 }
    )
  }
}
