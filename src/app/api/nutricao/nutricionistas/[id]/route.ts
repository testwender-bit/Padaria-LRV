import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// PUT /api/nutricao/nutricionistas/[id]
// Atualiza um nutricionista. user_id é opcional.
// ---------------------------------------------------------------------------
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!body.nome || !body.crn) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome, crn' },
        { status: 400 }
      )
    }

    const userId = body.user_id || null

    const nutricionista = await db.nutricionista.update({
      where: { id },
      data: {
        nome: body.nome,
        crn: body.crn,
        user_id: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(nutricionista)
  } catch (error) {
    console.error('Erro ao atualizar nutricionista:', error)
    return NextResponse.json({ error: 'Erro ao atualizar nutricionista' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/nutricao/nutricionistas/[id]
// Soft delete: marca ativo = false (preserva integridade referencial de cardápios)
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Soft delete — preserva cardápios vinculados
    await db.nutricionista.update({
      where: { id },
      data: { ativo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir nutricionista:', error)
    return NextResponse.json({ error: 'Erro ao excluir nutricionista' }, { status: 500 })
  }
}
