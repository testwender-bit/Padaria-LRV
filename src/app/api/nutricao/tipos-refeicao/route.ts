import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const tiposRefeicao = await db.tipoRefeicao.findMany({
      orderBy: { ordem: 'asc' },
    })

    return NextResponse.json(tiposRefeicao)
  } catch (error) {
    console.error('Erro ao buscar tipos de refeição:', error)
    return NextResponse.json({ error: 'Erro ao buscar tipos de refeição' }, { status: 500 })
  }
}
