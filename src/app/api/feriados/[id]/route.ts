import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    // If changing the date, we need to delete and recreate due to unique constraint
    const existing = await db.feriado.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Feriado não encontrado' }, { status: 404 })
    }
    
    // Delete old and create new if date changes
    if (body.data && body.data !== existing.data) {
      const novo = await db.$transaction(async (tx) => {
        await tx.feriado.delete({ where: { id } })
        return tx.feriado.create({
          data: {
            data: body.data,
            nome: body.nome || existing.nome,
            tipo: body.tipo || existing.tipo,
            escolas_afetadas: body.escolas_afetadas || existing.escolas_afetadas,
            acao: body.acao || existing.acao,
            obs: body.obs !== undefined ? body.obs : existing.obs,
          },
        })
      })
      return NextResponse.json(novo)
    }
    
    // Just update
    const feriado = await db.feriado.update({
      where: { id },
      data: {
        nome: body.nome,
        tipo: body.tipo,
        escolas_afetadas: body.escolas_afetadas,
        acao: body.acao,
        obs: body.obs,
      },
    })
    return NextResponse.json(feriado)
  } catch (error) {
    console.error('Erro ao atualizar feriado:', error)
    return NextResponse.json({ error: 'Erro ao atualizar feriado' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.feriado.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar feriado:', error)
    return NextResponse.json({ error: 'Erro ao deletar feriado' }, { status: 500 })
  }
}
