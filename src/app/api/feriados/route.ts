import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const feriados = await db.feriado.findMany({ orderBy: { data: 'asc' } })
    return NextResponse.json(feriados)
  } catch (error) {
    console.error('Erro ao buscar feriados:', error)
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const feriado = await db.feriado.create({
      data: {
        data: body.data,
        nome: body.nome,
        tipo: body.tipo || 'NACIONAL',
        escolas_afetadas: body.escolas_afetadas || 'TODAS',
        acao: body.acao || 'zerar_dia',
        obs: body.obs,
      },
    })
    return NextResponse.json(feriado, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar feriado:', error)
    return NextResponse.json({ error: 'Erro ao criar feriado' }, { status: 500 })
  }
}
