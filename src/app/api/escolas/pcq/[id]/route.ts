import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const pcq = await db.pcqQuantidade.update({
      where: { id },
      data: {
        prod_segunda: body.prod_segunda,
        prod_quarta: body.prod_quarta,
        prod_sexta: body.prod_sexta,
        pf_comp_segunda: body.pf_comp_segunda,
        pf_comp_quarta: body.pf_comp_quarta,
        pf_comp_sexta: body.pf_comp_sexta,
      },
    })
    return NextResponse.json(pcq)
  } catch (error) {
    console.error('Erro ao atualizar PCQ:', error)
    return NextResponse.json({ error: 'Erro ao atualizar PCQ' }, { status: 500 })
  }
}
