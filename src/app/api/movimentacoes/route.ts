import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const movimentacoes = await db.movimentacaoEstoque.findMany({
      include: { insumo: true },
      orderBy: { data: 'desc' },
      take: 100,
    })
    return NextResponse.json(movimentacoes)
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error)
    return NextResponse.json({ error: 'Erro ao buscar movimentações' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const mov = await db.$transaction(async (tx) => {
      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          insumo_id: body.insumo_id,
          tipo: body.tipo,
          quantidade: body.quantidade,
          preco_unitario: body.preco_unitario || 0,
          preco_total: body.preco_total || 0,
          data: body.data || new Date().toISOString().split('T')[0],
          obs: body.obs,
        },
      })

      const insumo = await tx.insumo.findUnique({ where: { id: body.insumo_id } })
      if (insumo) {
        const delta = body.tipo === 'ENTRADA' ? body.quantidade : -body.quantidade
        await tx.insumo.update({
          where: { id: body.insumo_id },
          data: { estoque_atual: Math.max(0, insumo.estoque_atual + delta) },
        })
      }

      return movimentacao
    })

    return NextResponse.json(mov, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar movimentação:', error)
    return NextResponse.json({ error: 'Erro ao criar movimentação' }, { status: 500 })
  }
}
