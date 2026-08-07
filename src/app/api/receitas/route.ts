import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const receitas = await db.receita.findMany({
      include: { insumo: true, lanche: true },
      orderBy: [{ produto_tipo: 'asc' }, { lanche: { nome: 'asc' } }],
    })
    return NextResponse.json(receitas)
  } catch (error) {
    console.error('Erro ao buscar receitas:', error)
    return NextResponse.json({ error: 'Erro ao buscar receitas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // v9.7: lanche_id é opcional (apenas para produto_tipo = "LANCHE")
    const lancheId = body.lanche_id || null

    // Upsert com composite key (produto_tipo + insumo_id + lanche_id)
    // Como lanche_id pode ser null, usamos findFirst + create/update
    const existing = await db.receita.findFirst({
      where: {
        produto_tipo: body.produto_tipo,
        insumo_id: body.insumo_id,
        lanche_id: lancheId,
      },
    })

    let receita
    if (existing) {
      receita = await db.receita.update({
        where: { id: existing.id },
        data: {
          quantidade_por_unidade: body.quantidade_por_unidade,
          lanche_id: lancheId,
        },
      })
    } else {
      receita = await db.receita.create({
        data: {
          produto_tipo: body.produto_tipo,
          insumo_id: body.insumo_id,
          quantidade_por_unidade: body.quantidade_por_unidade,
          lanche_id: lancheId,
        },
      })
    }

    return NextResponse.json(receita, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar receita:', error)
    return NextResponse.json({ error: 'Erro ao criar receita' }, { status: 500 })
  }
}

// DELETE /api/receitas?id=xxx
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    }
    await db.receita.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar receita:', error)
    return NextResponse.json({ error: 'Erro ao deletar receita' }, { status: 500 })
  }
}
