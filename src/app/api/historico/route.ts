import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const historico = await db.historicoSemana.findMany({
      orderBy: [{ ano: 'desc' }, { semana: 'desc' }],
    })
    return NextResponse.json(historico)
  } catch (error) {
    console.error('Erro ao buscar histórico:', error)
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const historico = await db.historicoSemana.upsert({
      where: { ano_semana: { ano: body.ano, semana: body.semana } },
      update: {
        tipo_pao: body.tipo_pao,
        nome_pao: body.nome_pao,
        lanche_regular: body.lanche_regular,
        lanche_bifasica: body.lanche_bifasica,
        total_pf: body.total_pf,
        total_pcq: body.total_pcq,
        total_lanche: body.total_lanche,
        ajustes_count: body.ajustes_count,
        gerado_por: body.gerado_por,
        gerado_em: body.gerado_em,
        snapshot_json: body.snapshot_json,
      },
      create: {
        ano: body.ano,
        semana: body.semana,
        data_inicio: body.data_inicio,
        data_fim: body.data_fim,
        tipo_pao: body.tipo_pao,
        nome_pao: body.nome_pao,
        lanche_regular: body.lanche_regular,
        lanche_bifasica: body.lanche_bifasica,
        total_pf: body.total_pf,
        total_pcq: body.total_pcq,
        total_lanche: body.total_lanche,
        ajustes_count: body.ajustes_count,
        gerado_por: body.gerado_por,
        gerado_em: body.gerado_em,
        snapshot_json: body.snapshot_json,
      },
    })
    return NextResponse.json(historico, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar histórico:', error)
    return NextResponse.json({ error: 'Erro ao criar histórico' }, { status: 500 })
  }
}
