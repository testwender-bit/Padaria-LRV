import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/nutricao/preparacoes/[id]/favorita
// Body: { favorita: boolean }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (typeof body.favorita !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo obrigatório: favorita (boolean)' },
        { status: 400 }
      )
    }

    const prep = await db.preparacao.update({
      where: { id },
      data: { favorita: body.favorita },
      select: { id: true, nome: true, favorita: true, vezes_usada: true },
    })

    return NextResponse.json(prep)
  } catch (error) {
    console.error('Erro ao alternar favorita:', error)
    return NextResponse.json({ error: 'Erro ao alternar favorita' }, { status: 500 })
  }
}
