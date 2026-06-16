import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const receitas = await db.receita.findMany({
      include: { insumo: true },
      orderBy: { produto_tipo: 'asc' },
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
    const receita = await db.receita.upsert({
      where: {
        produto_tipo_insumo_id: {
          produto_tipo: body.produto_tipo,
          insumo_id: body.insumo_id,
        },
      },
      update: {
        quantidade_por_unidade: body.quantidade_por_unidade,
      },
      create: {
        produto_tipo: body.produto_tipo,
        insumo_id: body.insumo_id,
        quantidade_por_unidade: body.quantidade_por_unidade,
      },
    })
    return NextResponse.json(receita, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar receita:', error)
    return NextResponse.json({ error: 'Erro ao criar receita' }, { status: 500 })
  }
}
