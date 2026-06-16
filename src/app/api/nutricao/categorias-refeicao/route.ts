import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const categoriasRefeicao = await db.categoriaRefeicao.findMany({
      include: {
        tipo_refeicao: true,
      },
      orderBy: { categoria_escola: 'asc' },
    })

    return NextResponse.json(categoriasRefeicao)
  } catch (error) {
    console.error('Erro ao buscar categorias de refeição:', error)
    return NextResponse.json({ error: 'Erro ao buscar categorias de refeição' }, { status: 500 })
  }
}
