import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const cardapio = await db.cardapioSemestral.findMany({
      include: { lanche_regular: true, lanche_bifasica: true },
      orderBy: [{ ano: 'asc' }, { semana: 'asc' }],
    })
    return NextResponse.json(cardapio)
  } catch (error) {
    console.error('Erro ao buscar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao buscar cardápio' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const cardapio = await db.cardapioSemestral.upsert({
      where: { ano_semana: { ano: body.ano, semana: body.semana } },
      update: {
        numero_semana_iso: body.numero_semana_iso,
        data_inicio: body.data_inicio,
        data_fim: body.data_fim,
        tipo_pao: body.tipo_pao || 'PADRAO',
        nome_pao: body.nome_pao || 'Pão Francês',
        lanche_regular_id: body.lanche_regular_id,
        lanche_bifasica_id: body.lanche_bifasica_id,
        obs: body.obs,
      },
      create: {
        ano: body.ano,
        semana: body.semana,
        numero_semana_iso: body.numero_semana_iso,
        data_inicio: body.data_inicio,
        data_fim: body.data_fim,
        tipo_pao: body.tipo_pao || 'PADRAO',
        nome_pao: body.nome_pao || 'Pão Francês',
        lanche_regular_id: body.lanche_regular_id,
        lanche_bifasica_id: body.lanche_bifasica_id,
        obs: body.obs,
      },
    })
    return NextResponse.json(cardapio)
  } catch (error) {
    console.error('Erro ao criar/atualizar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao criar cardápio' }, { status: 500 })
  }
}
