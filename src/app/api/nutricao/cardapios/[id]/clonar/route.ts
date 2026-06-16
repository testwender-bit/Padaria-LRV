import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!body.escola_id_destino) {
      return NextResponse.json(
        { error: 'Campo obrigatório: escola_id_destino' },
        { status: 400 }
      )
    }

    // Buscar cardápio original com todos os dados aninhados
    const original = await db.cardapioNutricional.findUnique({
      where: { id },
      include: {
        semanas: {
          include: {
            dias: {
              include: {
                itens: true,
              },
            },
          },
          orderBy: { numero: 'asc' },
        },
      },
    })

    if (!original) {
      return NextResponse.json({ error: 'Cardápio original não encontrado' }, { status: 404 })
    }

    const criadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)

    // Deep clone em transação
    const novoCardapio = await db.$transaction(async (tx) => {
      // Criar novo cardápio
      const card = await tx.cardapioNutricional.create({
        data: {
          nome: `${original.nome} (Cópia)`,
          escola_id: body.escola_id_destino,
          nutricionista_id: body.nutricionista_id || original.nutricionista_id,
          categoria_escola: original.categoria_escola,
          ano: original.ano,
          semestre: original.semestre,
          status: 'RASCUNHO',
          origem_id: original.id,
          criado_em: criadoEm,
          atualizado_em: criadoEm,
        },
      })

      // Clonar semanas, dias e itens
      for (const semana of original.semanas) {
        const novaSemana = await tx.cardapioSemanaNutri.create({
          data: {
            cardapio_id: card.id,
            numero: semana.numero,
            data_inicio: semana.data_inicio,
            data_fim: semana.data_fim,
          },
        })

        for (const dia of semana.dias) {
          const novoDia = await tx.cardapioDiaNutri.create({
            data: {
              semana_id: novaSemana.id,
              dia_semana: dia.dia_semana,
            },
          })

          for (const item of dia.itens) {
            await tx.cardapioItem.create({
              data: {
                dia_id: novoDia.id,
                tipo_refeicao_id: item.tipo_refeicao_id,
                preparacao_id: item.preparacao_id,
                porcoes: item.porcoes,
              },
            })
          }
        }
      }

      // Retornar cardápio completo
      return tx.cardapioNutricional.findUnique({
        where: { id: card.id },
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
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { numero: 'asc' },
          },
        },
      })
    })

    return NextResponse.json(novoCardapio, { status: 201 })
  } catch (error) {
    console.error('Erro ao clonar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao clonar cardápio' }, { status: 500 })
  }
}
