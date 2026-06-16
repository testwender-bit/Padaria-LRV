import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { FASES_ESCOLARES, calcularPercapitaPorFase, type FaseEscolar } from '@/lib/nutricao-utils'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.preparacao.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Preparação não encontrada' }, { status: 404 })
    }

    // Se ingredientes foram fornecidos, substituir todos
    if (body.ingredientes && Array.isArray(body.ingredientes)) {
      const alimentoIds = body.ingredientes.map(
        (ing: { alimento_id: string }) => ing.alimento_id
      )
      const alimentos = await db.alimento.findMany({
        where: { id: { in: alimentoIds } },
      })
      const alimentoMap = new Map(alimentos.map((a) => [a.id, a]))

      for (const ing of body.ingredientes) {
        if (!alimentoMap.has(ing.alimento_id)) {
          return NextResponse.json(
            { error: `Alimento não encontrado: ${ing.alimento_id}` },
            { status: 400 }
          )
        }
      }

      const preparacao = await db.$transaction(async (tx) => {
        await tx.preparacao.update({
          where: { id },
          data: {
            nome: body.nome !== undefined ? body.nome : undefined,
            descricao: body.descricao !== undefined ? body.descricao : undefined,
            modo_preparo: body.modo_preparo !== undefined ? body.modo_preparo : undefined,
            // v8: categoria (default PREPARACAO)
            categoria: body.categoria !== undefined ? body.categoria : undefined,
          },
        })

        // Deletar ingredientes antigos (percapitas cascade-delete)
        await tx.preparacaoIngrediente.deleteMany({
          where: { preparacao_id: id },
        })

        // Criar novos ingredientes
        for (const ing of body.ingredientes) {
          const quantidade_gramas = Number(ing.quantidade_gramas) || 0
          const mesma_percapita = Boolean(ing.mesma_percapita)

          const ingredienteCreated = await tx.preparacaoIngrediente.create({
            data: {
              preparacao_id: id,
              alimento_id: ing.alimento_id,
              quantidade_gramas,
              mesma_percapita,
            },
          })

          // Criar percapitas por fase escolar
          if (!mesma_percapita) {
            if (ing.percapitas && Array.isArray(ing.percapitas) && ing.percapitas.length > 0) {
              for (const pc of ing.percapitas) {
                if (pc.fase_escolar && pc.quantidade_gramas >= 0) {
                  await tx.preparacaoPercapita.create({
                    data: {
                      ingrediente_id: ingredienteCreated.id,
                      fase_escolar: pc.fase_escolar,
                      quantidade_gramas: Number(pc.quantidade_gramas),
                      auto_calculado: Boolean(pc.auto_calculado),
                    },
                  })
                }
              }
            } else {
              for (const fase of FASES_ESCOLARES) {
                const gramasFase = calcularPercapitaPorFase(quantidade_gramas, fase.value as FaseEscolar)
                await tx.preparacaoPercapita.create({
                  data: {
                    ingrediente_id: ingredienteCreated.id,
                    fase_escolar: fase.value,
                    quantidade_gramas: gramasFase,
                    auto_calculado: true,
                  },
                })
              }
            }
          }
        }

        return tx.preparacao.findUnique({
          where: { id },
          include: {
            ingredientes: {
              include: {
                alimento: true,
                percapitas: true,
              },
            },
          },
        })
      })

      return NextResponse.json(preparacao)
    }

    // Se não há ingredientes, apenas atualizar dados básicos
    const preparacao = await db.preparacao.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? body.nome : undefined,
        descricao: body.descricao !== undefined ? body.descricao : undefined,
        modo_preparo: body.modo_preparo !== undefined ? body.modo_preparo : undefined,
        // v8: categoria (default PREPARACAO)
        categoria: body.categoria !== undefined ? body.categoria : undefined,
      },
      include: {
        ingredientes: {
          include: {
            alimento: true,
            percapitas: true,
          },
        },
      },
    })

    return NextResponse.json(preparacao)
  } catch (error) {
    console.error('Erro ao atualizar preparação:', error)
    return NextResponse.json({ error: 'Erro ao atualizar preparação' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.preparacao.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Preparação não encontrada' }, { status: 404 })
    }

    await db.preparacao.update({
      where: { id },
      data: { ativo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar preparação:', error)
    return NextResponse.json({ error: 'Erro ao deletar preparação' }, { status: 500 })
  }
}
