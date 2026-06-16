import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const pf = await db.pfQuantidade.update({
      where: { id },
      data: {
        segunda: body.segunda,
        terca: body.terca,
        quarta: body.quarta,
        quinta: body.quinta,
        sexta: body.sexta,
      },
    })
    return NextResponse.json(pf)
  } catch (error) {
    console.error('Erro ao atualizar PF:', error)
    return NextResponse.json({ error: 'Erro ao atualizar PF' }, { status: 500 })
  }
}
