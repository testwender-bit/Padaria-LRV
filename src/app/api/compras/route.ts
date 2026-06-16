import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/compras — list purchase orders with items and insumo details
export async function GET() {
  try {
    const pedidos = await db.pedidoCompra.findMany({
      include: {
        itens: {
          include: {
            insumo: {
              select: { id: true, nome: true, unidade: true, preco_unitario: true, estoque_atual: true, estoque_minimo: true }
            }
          },
          orderBy: { insumo: { nome: 'asc' } }
        }
      },
      orderBy: { data_pedido: 'desc' },
    })

    // Also fetch low-stock insumos (filter in JS since SQLite doesn't support column comparison in where)
    const todosInsumos = await db.insumo.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    })

    const lowStock = todosInsumos.filter(i => i.estoque_atual < i.estoque_minimo)

    return NextResponse.json({ pedidos, lowStock })
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error)
    return NextResponse.json({ error: 'Erro ao buscar pedidos' }, { status: 500 })
  }
}

// POST /api/compras — create a new purchase order with items
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { fornecedor, data_prevista, obs, itens } = body

    if (!fornecedor || !itens || itens.length === 0) {
      return NextResponse.json({ error: 'Fornecedor e itens são obrigatórios' }, { status: 400 })
    }

    const hoje = new Date().toISOString().split('T')[0]

    const pedido = await db.pedidoCompra.create({
      data: {
        fornecedor,
        data_pedido: hoje,
        data_prevista: data_prevista || null,
        obs: obs || null,
        status: 'PENDENTE',
        itens: {
          create: itens.map((item: { insumo_id: string; quantidade: number; preco_unitario: number }) => ({
            insumo_id: item.insumo_id,
            quantidade: item.quantidade || 0,
            preco_unitario: item.preco_unitario || 0,
            preco_total: (item.quantidade || 0) * (item.preco_unitario || 0),
            recebido: false,
          })),
        },
      },
      include: {
        itens: {
          include: {
            insumo: {
              select: { id: true, nome: true, unidade: true, preco_unitario: true }
            }
          }
        }
      }
    })

    return NextResponse.json(pedido, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pedido:', error)
    return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })
  }
}

// PUT /api/compras — update purchase order status (including "receber" action)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, status, action } = body

    if (!id) {
      return NextResponse.json({ error: 'ID do pedido é obrigatório' }, { status: 400 })
    }

    // If action is "receber", mark as RECEBIDO and create ENTRADA movimentações
    if (action === 'receber') {
      const result = await db.$transaction(async (tx) => {
        const pedido = await tx.pedidoCompra.findUnique({
          where: { id },
          include: {
            itens: {
              include: {
                insumo: true
              }
            }
          }
        })

        if (!pedido) {
          throw new Error('Pedido não encontrado')
        }

        if (pedido.status === 'RECEBIDO') {
          throw new Error('Pedido já foi recebido')
        }

        const hoje = new Date().toISOString().split('T')[0]

        for (const item of pedido.itens) {
          await tx.movimentacaoEstoque.create({
            data: {
              insumo_id: item.insumo_id,
              tipo: 'ENTRADA',
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario,
              preco_total: item.preco_total,
              data: hoje,
              obs: `Recebimento pedido ${pedido.id.slice(-8).toUpperCase()} - ${pedido.fornecedor}`,
            },
          })

          const insumo = item.insumo
          await tx.insumo.update({
            where: { id: item.insumo_id },
            data: {
              estoque_atual: Math.max(0, insumo.estoque_atual + item.quantidade),
            },
          })

          await tx.itemPedidoCompra.update({
            where: { id: item.id },
            data: { recebido: true },
          })
        }

        return tx.pedidoCompra.update({
          where: { id },
          data: { status: 'RECEBIDO' },
          include: {
            itens: {
              include: {
                insumo: {
                  select: { id: true, nome: true, unidade: true, preco_unitario: true, estoque_atual: true, estoque_minimo: true }
                }
              }
            }
          }
        })
      })

      return NextResponse.json(result)
    }

    // Simple status update
    if (!status) {
      return NextResponse.json({ error: 'Status é obrigatório' }, { status: 400 })
    }

    const updated = await db.pedidoCompra.update({
      where: { id },
      data: { status },
      include: {
        itens: {
          include: {
            insumo: {
              select: { id: true, nome: true, unidade: true, preco_unitario: true, estoque_atual: true, estoque_minimo: true }
            }
          }
        }
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error)
    return NextResponse.json({ error: 'Erro ao atualizar pedido' }, { status: 500 })
  }
}

// DELETE /api/compras — cancel a purchase order
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const pedido = await db.pedidoCompra.findUnique({ where: { id } })

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    if (pedido.status === 'RECEBIDO') {
      return NextResponse.json({ error: 'Não é possível excluir pedido recebido' }, { status: 400 })
    }

    await db.pedidoCompra.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir pedido:', error)
    return NextResponse.json({ error: 'Erro ao excluir pedido' }, { status: 500 })
  }
}
