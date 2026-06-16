import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/nutricao/lista-compras/[id] — recupera 1 snapshot por ID
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const lista = await db.listaCompras.findUnique({ where: { id } })
    if (!lista) {
      return NextResponse.json({ error: 'Lista não encontrada' }, { status: 404 })
    }
    return NextResponse.json({
      ...lista,
      escolas_snapshot: JSON.parse(lista.escolas_snapshot || '[]'),
      itens_json: JSON.parse(lista.itens_json || '[]'),
    })
  } catch (error) {
    console.error('Erro ao buscar lista de compras:', error)
    return NextResponse.json({ error: 'Erro ao buscar lista de compras' }, { status: 500 })
  }
}

// PATCH /api/nutricao/lista-compras/[id] — atualiza status (GERADA/ENVIADA/RECEBIDA)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const lista = await db.listaCompras.update({
      where: { id },
      data: {
        nome: body.nome,
        status: body.status,
      },
    })
    return NextResponse.json(lista)
  } catch (error) {
    console.error('Erro ao atualizar lista de compras:', error)
    return NextResponse.json({ error: 'Erro ao atualizar lista de compras' }, { status: 500 })
  }
}

// DELETE /api/nutricao/lista-compras/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.listaCompras.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar lista de compras:', error)
    return NextResponse.json({ error: 'Erro ao deletar lista de compras' }, { status: 500 })
  }
}
