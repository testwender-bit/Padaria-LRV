import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// GET /api/movimentacoes
// Query params (todos opcionais):
//   ?data_inicio=YYYY-MM-DD — filtrar a partir desta data
//   ?data_fim=YYYY-MM-DD     — filtrar até esta data
//   ?insumo_id=xxx           — filtrar por insumo específico
//   ?tipo=ENTRADA|SAIDA      — filtrar por tipo
//   ?limite=100              — número máx de resultados (default 100, máx 500)
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('data_inicio')
    const dataFim = searchParams.get('data_fim')
    const insumoId = searchParams.get('insumo_id')
    const tipo = searchParams.get('tipo')
    const limite = Math.min(Number(searchParams.get('limite') || 100), 500)

    const where: Record<string, unknown> = {}
    if (dataInicio || dataFim) {
      where.data = {}
      if (dataInicio) (where.data as any).gte = dataInicio
      if (dataFim) (where.data as any).lte = dataFim
    }
    if (insumoId) where.insumo_id = insumoId
    if (tipo && ['ENTRADA', 'SAIDA'].includes(tipo.toUpperCase())) {
      where.tipo = tipo.toUpperCase()
    }

    const movimentacoes = await db.movimentacaoEstoque.findMany({
      where,
      include: { insumo: true },
      orderBy: { data: 'desc' },
      take: limite,
    })
    return NextResponse.json(movimentacoes)
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error)
    return NextResponse.json({ error: 'Erro ao buscar movimentações' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const mov = await db.$transaction(async (tx) => {
      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          insumo_id: body.insumo_id,
          tipo: body.tipo,
          quantidade: body.quantidade,
          preco_unitario: body.preco_unitario || 0,
          preco_total: body.preco_total || 0,
          data: body.data || new Date().toISOString().split('T')[0],
          obs: body.obs,
        },
      })

      const insumo = await tx.insumo.findUnique({ where: { id: body.insumo_id } })
      if (insumo) {
        const delta = body.tipo === 'ENTRADA' ? body.quantidade : -body.quantidade
        await tx.insumo.update({
          where: { id: body.insumo_id },
          data: { estoque_atual: Math.max(0, insumo.estoque_atual + delta) },
        })
      }

      return movimentacao
    })

    return NextResponse.json(mov, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar movimentação:', error)
    return NextResponse.json({ error: 'Erro ao criar movimentação' }, { status: 500 })
  }
}
