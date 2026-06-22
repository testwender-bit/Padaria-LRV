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
        sobrescritas: {
          include: {
            tipo_refeicao: true,
            preparacao_substituta: { select: { id: true, nome: true } },
          },
        },
        // v8.7: horários customizados por refeição (override do default)
        horarios_refeicoes: {
          include: {
            tipo_refeicao: {
              select: { id: true, codigo: true, nome: true, horario: true, ordem: true },
            },
          },
        },
      },
    })

    if (!cardapio) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    // Busca equipe completa de nutricionistas ativos para exibir no PDF
    // (até ~5 membros — o limite é apenas para dimensionamento do layout)
    const equipeNutricionistas = await db.nutricionista.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        crn: true,
      },
      orderBy: { nome: 'asc' },
      take: 5,
    })

    return NextResponse.json({ ...cardapio, equipe_nutricionistas: equipeNutricionistas })
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
        ciclo_semanas: body.ciclo_semanas !== undefined ? body.ciclo_semanas : undefined,
        repetir_ciclo: body.repetir_ciclo !== undefined ? body.repetir_ciclo : undefined,
        atualizado_em: atualizadoEm,
      },
    })

    // v8: Se data_inicio foi fornecida, recalcular datas de todas as semanas
    if (body.data_inicio) {
      const dataInicio = new Date(body.data_inicio + 'T12:00:00')
      const semanas = await db.cardapioSemanaNutri.findMany({
        where: { cardapio_id: id },
        orderBy: { numero: 'asc' },
      })

      for (const semana of semanas) {
        const numSemana = semana.numero
        // Cada semana começa 7*(numSemana-1) dias após a data de início
        const inicioSemana = new Date(dataInicio)
        inicioSemana.setDate(dataInicio.getDate() + (numSemana - 1) * 7)
        const fimSemana = new Date(inicioSemana)
        fimSemana.setDate(inicioSemana.getDate() + 4) // segunda a sexta

        const inicioStr = inicioSemana.toISOString().split('T')[0]
        const fimStr = fimSemana.toISOString().split('T')[0]

        await db.cardapioSemanaNutri.update({
          where: { id: semana.id },
          data: {
            data_inicio: inicioStr,
            data_fim: fimStr,
          },
        })
      }
    }

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
