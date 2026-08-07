import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// GET /api/insumos?inativos=true
// Lista insumos ativos por padrão. Use ?inativos=true para listar todos
// (incluindo inativos) — necessário para a página de Gerenciar Insumos.
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const incluirInativos = searchParams.get('inativos') === 'true'

    const insumos = await db.insumo.findMany({
      where: incluirInativos ? {} : { ativo: true },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    })
    return NextResponse.json(insumos)
  } catch (error) {
    console.error('Erro ao buscar insumos:', error)
    return NextResponse.json({ error: 'Erro ao buscar insumos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const insumo = await db.insumo.create({
      data: {
        nome: body.nome,
        unidade: body.unidade || 'kg',
        preco_unitario: body.preco_unitario || 0,
        estoque_atual: body.estoque_atual || 0,
        estoque_minimo: body.estoque_minimo || 0,
        fornecedor: body.fornecedor,
        ativo: body.ativo !== false,
      },
    })
    return NextResponse.json(insumo, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar insumo:', error)
    return NextResponse.json({ error: 'Erro ao criar insumo' }, { status: 500 })
  }
}
