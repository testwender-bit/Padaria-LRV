import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { numeroSemana, anoSemana } from '@/lib/date-utils'

// ============================================================
// GET /api/producao/extra?ano=2026&semana=30
// Lista produções extras de uma semana
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ano = Number(searchParams.get('ano')) || anoSemana(new Date())
    const semana = Number(searchParams.get('semana')) || numeroSemana(new Date())

    const extras = await db.producaoExtra.findMany({
      where: { ano, semana },
      orderBy: [{ produto: 'asc' }, { dia_semana: 'asc' }],
    })
    return NextResponse.json(extras)
  } catch (error) {
    console.error('Erro ao buscar produção extra:', error)
    return NextResponse.json({ error: 'Erro ao buscar produção extra' }, { status: 500 })
  }
}

// ============================================================
// POST /api/producao/extra
// Cria uma ou várias produções extras
// Body: { items: [{ nome_instituicao, produto, dia_semana, quantidade, observacao }] }
//   ou item único: { nome_instituicao, produto, dia_semana, quantidade, observacao }
// ============================================================
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const ano = body.ano || anoSemana(new Date())
    const semana = body.semana || numeroSemana(new Date())

    const items = Array.isArray(body.items) ? body.items : [body]

    const created = await db.producaoExtra.createMany({
      data: items.map((item: any) => ({
        ano,
        semana,
        nome_instituicao: item.nome_instituicao,
        produto: item.produto,
        dia_semana: item.dia_semana,
        quantidade: item.quantidade || 0,
        observacao: item.observacao || null,
      })),
    })

    return NextResponse.json({ success: true, created: created.count }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar produção extra:', error)
    return NextResponse.json({ error: 'Erro ao criar produção extra' }, { status: 500 })
  }
}

// ============================================================
// DELETE /api/producao/extra?id=xxx
// ============================================================
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await db.producaoExtra.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar produção extra:', error)
    return NextResponse.json({ error: 'Erro ao deletar' }, { status: 500 })
  }
}
