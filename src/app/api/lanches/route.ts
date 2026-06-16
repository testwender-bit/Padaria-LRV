import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const lanches = await db.lanche.findMany({
      include: { distribuicao: { include: { escola: true } } },
      orderBy: { nome: 'asc' },
    })
    return NextResponse.json(lanches)
  } catch (error) {
    console.error('Erro ao buscar lanches:', error)
    return NextResponse.json({ error: 'Erro ao buscar lanches' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const lanche = await db.lanche.create({
      data: {
        nome: body.nome,
        unidade: body.unidade || 'un',
        ativo: body.ativo !== false,
        obs: body.obs,
      },
    })
    return NextResponse.json(lanche, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar lanche:', error)
    return NextResponse.json({ error: 'Erro ao criar lanche' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    
    const lanche = await db.lanche.update({
      where: { id: body.id },
      data: {
        nome: body.nome,
        unidade: body.unidade,
        ativo: body.ativo,
        obs: body.obs,
      },
    })
    return NextResponse.json(lanche)
  } catch (error) {
    console.error('Erro ao atualizar lanche:', error)
    return NextResponse.json({ error: 'Erro ao atualizar lanche' }, { status: 500 })
  }
}
