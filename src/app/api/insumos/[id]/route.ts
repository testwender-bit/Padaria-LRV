import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// PUT /api/insumos/[id] — atualizar insumo
// Body: { nome?, unidade?, preco_unitario?, estoque_atual?,
//         estoque_minimo?, fornecedor?, ativo? }
// ============================================================
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.insumo.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    const insumo = await db.insumo.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? body.nome : undefined,
        unidade: body.unidade !== undefined ? body.unidade : undefined,
        preco_unitario: body.preco_unitario !== undefined ? body.preco_unitario : undefined,
        estoque_atual: body.estoque_atual !== undefined ? body.estoque_atual : undefined,
        estoque_minimo: body.estoque_minimo !== undefined ? body.estoque_minimo : undefined,
        fornecedor: body.fornecedor !== undefined ? body.fornecedor : undefined,
        ativo: body.ativo !== undefined ? body.ativo : undefined,
      },
    })

    return NextResponse.json(insumo)
  } catch (error) {
    console.error('Erro ao atualizar insumo:', error)
    return NextResponse.json({ error: 'Erro ao atualizar insumo' }, { status: 500 })
  }
}

// ============================================================
// DELETE /api/insumos/[id] — soft delete (marca ativo=false)
// Não exclui fisicamente para preservar histórico de movimentações
// e contagens. Se quiser excluir de verdade, usar force=true.
// ============================================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    const existing = await db.insumo.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    if (force) {
      // Exclusão física — remove permanentemente (cascata remove movimentações/contagens)
      await db.insumo.delete({ where: { id } })
      return NextResponse.json({ success: true, message: 'Insumo excluído permanentemente' })
    }

    // Soft delete — marca como inativo
    const insumo = await db.insumo.update({
      where: { id },
      data: { ativo: false },
    })

    return NextResponse.json({ success: true, insumo })
  } catch (error) {
    console.error('Erro ao excluir insumo:', error)
    return NextResponse.json({ error: 'Erro ao excluir insumo' }, { status: 500 })
  }
}
