import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { escola_id, tipo_pao } = body

    if (!escola_id || !tipo_pao) {
      return NextResponse.json({ error: 'escola_id e tipo_pao obrigatórios' }, { status: 400 })
    }

    // Check if this tipo_pao already exists for this school
    const existing = await db.pfQuantidade.findUnique({
      where: { escola_id_tipo_pao: { escola_id, tipo_pao } },
    })

    if (existing) {
      return NextResponse.json({ error: 'Tipo de pão já existe para esta escola' }, { status: 409 })
    }

    const pf = await db.pfQuantidade.create({
      data: {
        escola_id,
        tipo_pao,
        segunda: 0,
        terca: 0,
        quarta: 0,
        quinta: 0,
        sexta: 0,
      },
    })

    return NextResponse.json(pf, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar PF:', error)
    return NextResponse.json({ error: 'Erro ao criar PF' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await db.pfQuantidade.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar PF:', error)
    return NextResponse.json({ error: 'Erro ao deletar PF' }, { status: 500 })
  }
}
