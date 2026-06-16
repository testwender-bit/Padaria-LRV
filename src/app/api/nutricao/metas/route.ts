import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoria_escola = searchParams.get('categoria_escola')

    const where: Record<string, unknown> = {}

    if (categoria_escola) {
      where.categoria_escola = categoria_escola
    }

    const metas = await db.metaNutricional.findMany({
      where,
      include: {
        tipo_refeicao: {
          select: {
            id: true,
            codigo: true,
            nome: true,
          },
        },
      },
      orderBy: { categoria_escola: 'asc' },
    })

    return NextResponse.json(metas)
  } catch (error) {
    console.error('Erro ao buscar metas nutricionais:', error)
    return NextResponse.json({ error: 'Erro ao buscar metas nutricionais' }, { status: 500 })
  }
}
