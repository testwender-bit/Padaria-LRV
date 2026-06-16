import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Support both single item and batch array
    const items = Array.isArray(body) ? body : [body]

    const results: any[] = []
    for (const item of items) {
      const dist = await db.lancheDistribuicao.upsert({
        where: {
          lanche_id_escola_id_dia_semana: {
            lanche_id: item.lanche_id,
            escola_id: item.escola_id,
            dia_semana: item.dia_semana,
          },
        },
        update: {
          quantidade: item.quantidade,
        },
        create: {
          lanche_id: item.lanche_id,
          escola_id: item.escola_id,
          dia_semana: item.dia_semana,
          quantidade: item.quantidade,
          obs: item.obs,
        },
      })
      results.push(dist)
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Erro ao salvar distribuição:', error)
    return NextResponse.json({ error: 'Erro ao salvar distribuição' }, { status: 500 })
  }
}
