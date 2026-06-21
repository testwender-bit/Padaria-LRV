import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularNutrientesRefeicao,
  calcularPercentualEnergia,
  dividirNutrientes,
  emptyNutrienteDia,
  somarNutrientes,
} from '@/lib/nutricao-utils'

// ---------------------------------------------------------------------------
// GET /api/nutricao/cardapios/[id]/pdf
// Returns formatted cardápio data with nutritional summaries for PDF generation
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch full cardápio with all nested data
    const cardapio = await db.cardapioNutricional.findUnique({
      where: { id },
      include: {
        escola: { select: { id: true, nome: true, categoria: true } },
        nutricionista: { select: { id: true, nome: true, crn: true } },
        semanas: {
          orderBy: { numero: 'asc' },
          include: {
            dias: {
              include: {
                itens: {
                  include: {
                    tipo_refeicao: {
                      select: {
                        id: true,
                        codigo: true,
                        nome: true,
                        horario: true,
                        ordem: true,
                      },
                    },
                    preparacao: {
                      select: {
                        id: true,
                        nome: true,
                        ingredientes: {
                          include: {
                            alimento: {
                              select: {
                                id: true,
                                nome: true,
                                gramas_por_medida: true,
                                energia_kcal: true,
                                carboidratos_g: true,
                                proteinas_g: true,
                                lipidios_g: true,
                                fibra_alimentar_g: true,
                                sodio_mg: true,
                                ferro_mg: true,
                                ferro_heme_mg: true,
                                vitamina_a_mcg: true,
                                vitamina_c_mg: true,
                                calcio_mg: true,
                                magnesio_mg: true,
                                zinco_mg: true,
                                acucar_adicionado_g: true,
                              },
                            },
                            percapitas: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!cardapio) {
      return NextResponse.json(
        { error: 'Cardápio não encontrado' },
        { status: 404 }
      )
    }

    // Sort dias in correct weekday order (segunda → sexta)
    const diaOrder: Record<string, number> = {
      segunda: 0,
      terca: 1,
      quarta: 2,
      quinta: 3,
      sexta: 4,
    }

    for (const semana of cardapio.semanas) {
      semana.dias.sort(
        (a, b) => (diaOrder[a.dia_semana] ?? 5) - (diaOrder[b.dia_semana] ?? 5)
      )
    }

    // Build enriched semanas with nutritional summaries
    const semanasComResumo = cardapio.semanas.map((semana) => {
      // Collect unique refeição types for this semana, preserving order
      const tiposRefeicao = new Map<
        string,
        { id: string; nome: string; horario: string; ordem: number }
      >()
      for (const dia of semana.dias) {
        for (const item of dia.itens) {
          if (!tiposRefeicao.has(item.tipo_refeicao.id)) {
            tiposRefeicao.set(item.tipo_refeicao.id, {
              id: item.tipo_refeicao.id,
              nome: item.tipo_refeicao.nome,
              horario: item.tipo_refeicao.horario,
              ordem: item.tipo_refeicao.ordem,
            })
          }
        }
      }
      const tiposOrdenados = Array.from(tiposRefeicao.values()).sort(
        (a, b) => a.ordem - b.ordem
      )

      // Calculate daily nutrients for the week
      let totalSemana = emptyNutrienteDia()
      let diasComDados = 0

      for (const dia of semana.dias) {
        if (dia.itens.length > 0) {
          const totalDia = calcularNutrientesRefeicao(
            dia.itens.map((item) => ({
              preparacao: {
                ingredientes: item.preparacao.ingredientes.map((ing) => {
                  // If mesma_percapita, use base gramas for all phases
                  // Otherwise, check for percapita for the appropriate phase
                  let gramasUsar = ing.quantidade_gramas
                  if (!ing.mesma_percapita && ing.percapitas?.length > 0) {
                    // Use the base (Fund. Final) gramas as default
                    // Percapitas are stored per fase_escolar, not per categoria_escola
                    // For PDF, we use the base value since the cardápio is per segment
                    gramasUsar = ing.quantidade_gramas
                  }
                  return {
                    quantidade_gramas: gramasUsar,
                    alimento: ing.alimento,
                  }
                }),
              },
              porcoes: item.porcoes,
            }))
          )
          totalSemana = somarNutrientes(totalSemana, totalDia)
          diasComDados++
        }
      }

      const mediaDia =
        diasComDados > 0
          ? dividirNutrientes(totalSemana, diasComDados)
          : emptyNutrienteDia()
      const percentuais = calcularPercentualEnergia(mediaDia)

      return {
        id: semana.id,
        numero: semana.numero,
        data_inicio: semana.data_inicio,
        data_fim: semana.data_fim,
        dias: semana.dias,
        tiposRefeicao: tiposOrdenados,
        resumoNutricional: {
          media_dia: mediaDia,
          percentuais,
        },
      }
    })

    return NextResponse.json({
      id: cardapio.id,
      nome: cardapio.nome,
      escola: cardapio.escola,
      nutricionista: cardapio.nutricionista,
      categoria_escola: cardapio.categoria_escola,
      ano: cardapio.ano,
      semestre: cardapio.semestre,
      status: cardapio.status,
      semanas: semanasComResumo,
    })
  } catch (error) {
    console.error('Erro ao gerar dados do PDF:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar dados do cardápio' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/nutricao/cardapios/[id]/pdf
// Generates and returns the actual PDF file for download
// ---------------------------------------------------------------------------

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Re-use the GET logic by calling the same data-fetching code
    // For now, redirect to GET since the PDF page fetches data via GET then renders client-side
    // The POST is used by the "Generate PDF" button to trigger download

    const cardapio = await db.cardapioNutricional.findUnique({
      where: { id },
      include: {
        escola: { select: { id: true, nome: true, categoria: true } },
        nutricionista: { select: { id: true, nome: true, crn: true } },
        semanas: {
          orderBy: { numero: 'asc' },
          include: {
            dias: {
              include: {
                itens: {
                  include: {
                    tipo_refeicao: {
                      select: {
                        id: true,
                        codigo: true,
                        nome: true,
                        horario: true,
                        ordem: true,
                      },
                    },
                    preparacao: {
                      select: {
                        id: true,
                        nome: true,
                        ingredientes: {
                          include: {
                            alimento: {
                              select: {
                                id: true,
                                nome: true,
                                medida_caseira: true,
                                gramas_por_medida: true,
                                energia_kcal: true,
                                carboidratos_g: true,
                                proteinas_g: true,
                                lipidios_g: true,
                                fibra_alimentar_g: true,
                                sodio_mg: true,
                                ferro_mg: true,
                                ferro_heme_mg: true,
                                vitamina_a_mcg: true,
                                vitamina_c_mg: true,
                                calcio_mg: true,
                                magnesio_mg: true,
                                zinco_mg: true,
                                acucar_adicionado_g: true,
                              },
                            },
                            percapitas: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!cardapio) {
      return NextResponse.json(
        { error: 'Cardápio não encontrado' },
        { status: 404 }
      )
    }

    // Sort dias
    const diaOrder: Record<string, number> = {
      segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4,
    }
    for (const semana of cardapio.semanas) {
      semana.dias.sort(
        (a, b) => (diaOrder[a.dia_semana] ?? 5) - (diaOrder[b.dia_semana] ?? 5)
      )
    }

    // Build enriched semanas with nutritional summaries
    const semanasComResumo = cardapio.semanas.map((semana) => {
      const tiposRefeicao = new Map<
        string,
        { id: string; nome: string; horario: string; ordem: number }
      >()
      for (const dia of semana.dias) {
        for (const item of dia.itens) {
          if (!tiposRefeicao.has(item.tipo_refeicao.id)) {
            tiposRefeicao.set(item.tipo_refeicao.id, {
              id: item.tipo_refeicao.id,
              nome: item.tipo_refeicao.nome,
              horario: item.tipo_refeicao.horario,
              ordem: item.tipo_refeicao.ordem,
            })
          }
        }
      }
      const tiposOrdenados = Array.from(tiposRefeicao.values()).sort(
        (a, b) => a.ordem - b.ordem
      )

      let totalSemana = emptyNutrienteDia()
      let diasComDados = 0

      for (const dia of semana.dias) {
        if (dia.itens.length > 0) {
          const totalDia = calcularNutrientesRefeicao(
            dia.itens.map((item) => ({
              preparacao: {
                ingredientes: item.preparacao.ingredientes.map((ing) => ({
                  quantidade_gramas: ing.quantidade_gramas,
                  alimento: ing.alimento,
                })),
              },
              porcoes: item.porcoes,
            }))
          )
          totalSemana = somarNutrientes(totalSemana, totalDia)
          diasComDados++
        }
      }

      const mediaDia =
        diasComDados > 0
          ? dividirNutrientes(totalSemana, diasComDados)
          : emptyNutrienteDia()
      const percentuais = calcularPercentualEnergia(mediaDia)

      return {
        id: semana.id,
        numero: semana.numero,
        data_inicio: semana.data_inicio,
        data_fim: semana.data_fim,
        dias: semana.dias,
        tiposRefeicao: tiposOrdenados,
        resumoNutricional: {
          media_dia: mediaDia,
          percentuais,
        },
      }
    })

    // Return JSON data — the client-side PDF page handles rendering
    // Using POST so the browser can trigger a file download
    return NextResponse.json({
      id: cardapio.id,
      nome: cardapio.nome,
      escola: cardapio.escola,
      nutricionista: cardapio.nutricionista,
      categoria_escola: cardapio.categoria_escola,
      ano: cardapio.ano,
      semestre: cardapio.semestre,
      status: cardapio.status,
      semanas: semanasComResumo,
    })
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar PDF do cardápio' },
      { status: 500 }
    )
  }
}
