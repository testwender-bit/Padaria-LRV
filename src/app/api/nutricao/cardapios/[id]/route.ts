import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const cardapio = await db.cardapioNutricional.findUnique({
      where: { id },
      include: {
        escola: true,
        nutricionista: true,
        semanas: {
          include: {
            dias: {
              include: {
                itens: {
                  include: {
                    tipo_refeicao: true,
                    preparacao: {
                      include: {
                        ingredientes: {
                          include: {
                            alimento: true,
                            percapitas: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
              orderBy: {
                dia_semana: 'asc',
              },
            },
          },
          orderBy: { numero: 'asc' },
        },
      },
    })

    if (!cardapio) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    return NextResponse.json(cardapio)
  } catch (error) {
    console.error('Erro ao buscar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao buscar cardápio' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.cardapioNutricional.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    const atualizadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)

    const cardapio = await db.cardapioNutricional.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? body.nome : undefined,
        status: body.status !== undefined ? body.status : undefined,
        atualizado_em: atualizadoEm,
      },
    })

    return NextResponse.json(cardapio)
  } catch (error) {
    console.error('Erro ao atualizar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao atualizar cardápio' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.cardapioNutricional.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    const atualizadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)

    const cardapio = await db.cardapioNutricional.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? body.nome : undefined,
        status: body.status !== undefined ? body.status : undefined,
        fase_escolar: body.fase_escolar !== undefined ? body.fase_escolar : undefined,
        atualizado_em: atualizadoEm,
      },
    })

    return NextResponse.json(cardapio)
  } catch (error) {
    console.error('Erro ao atualizar cardápio (PATCH):', error)
    return NextResponse.json({ error: 'Erro ao atualizar cardápio' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.cardapioNutricional.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    // Deleção em cascata - o Prisma vai deletar semanas → dias → itens automaticamente
    // graças ao onDelete: Cascade nas relações
    await db.cardapioNutricional.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao deletar cardápio' }, { status: 500 })
  }
}
