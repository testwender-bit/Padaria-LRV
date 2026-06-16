import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularNutrientesRefeicao,
  calcularPercentualEnergia,
  dividirNutrientes,
  emptyNutrienteDia,
  somarNutrientes,
  type NutrienteDia,
} from '@/lib/nutricao-utils'
import { calcularPercapitaPorFase, type FaseEscolar } from '@/lib/nutricao-utils'

// GET /api/nutricao/cardapios/[id]/comparativo?outro_id=YYY&semana=1&semana_outro=1
// Compara o resumo nutricional da semana X deste cardápio com a semana Y de outro.
// Retorna: { atual: ResumoSemana, anterior: ResumoSemana, delta: NutrienteDia }
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const { searchParams } = new URL(request.url)
    const outroId = searchParams.get('outro_id')
    const semanaNum = Number(searchParams.get('semana') || 1)
    const semanaOutroNum = Number(searchParams.get('semana_outro') || semanaNum)

    if (!outroId) {
      return NextResponse.json(
        { error: 'Query param obrigatório: outro_id' },
        { status: 400 }
      )
    }

    const [cardapioAtual, cardapioOutro] = await Promise.all([
      db.cardapioNutricional.findUnique({
        where: { id: cardapioId },
        include: {
          semanas: {
            where: { numero: semanaNum },
            include: {
              dias: {
                include: {
                  itens: {
                    include: {
                      preparacao: {
                        include: {
                          ingredientes: { include: { alimento: true, percapitas: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      db.cardapioNutricional.findUnique({
        where: { id: outroId },
        include: {
          semanas: {
            where: { numero: semanaOutroNum },
            include: {
              dias: {
                include: {
                  itens: {
                    include: {
                      preparacao: {
                        include: {
                          ingredientes: { include: { alimento: true, percapitas: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ])

    if (!cardapioAtual || !cardapioOutro) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    function getGramasForFase(
      ing: { quantidade_gramas: number; mesma_percapita: boolean; percapitas: { fase_escolar: string; quantidade_gramas: number }[] },
      faseEscolar: string
    ): number {
      if (ing.mesma_percapita) return ing.quantidade_gramas
      const pc = ing.percapitas?.find((p) => p.fase_escolar === faseEscolar)
      if (pc) return pc.quantidade_gramas
      return calcularPercapitaPorFase(ing.quantidade_gramas, faseEscolar as FaseEscolar)
    }

    function calc(semana: { dias: { itens: { preparacao: { ingredientes: { quantidade_gramas: number; mesma_percapita: boolean; alimento: any; percapitas: any[] }[] }; porcoes: number }[] }[] } | undefined, fase: string) {
      if (!semana || !semana.dias?.length) {
        return { media_dia: emptyNutrienteDia(), percentuais: { carboidratos_pct: 0, proteinas_pct: 0, lipidios_pct: 0, acucar_pct: 0 } }
      }
      let total = emptyNutrienteDia()
      let diasComDados = 0
      for (const dia of semana.dias) {
        if (dia.itens.length === 0) continue
        const diaNutri = dia.itens.reduce<NutrienteDia>((acc, item) => {
          const refeicaoNutri = calcularNutrientesRefeicao([{
            preparacao: {
              ingredientes: item.preparacao.ingredientes.map((ing) => ({
                quantidade_gramas: getGramasForFase(ing, fase),
                alimento: ing.alimento,
              })),
            },
            porcoes: item.porcoes,
          }])
          return somarNutrientes(acc, refeicaoNutri)
        }, emptyNutrienteDia())
        total = somarNutrientes(total, diaNutri)
        diasComDados++
      }
      const media = diasComDados > 0 ? dividirNutrientes(total, diasComDados) : emptyNutrienteDia()
      return { media_dia: media, percentuais: calcularPercentualEnergia(media) }
    }

    const semanaAtual = cardapioAtual.semanas[0]
    const semanaOutro = cardapioOutro.semanas[0]

    const resAtual = calc(semanaAtual as any, cardapioAtual.fase_escolar)
    const resAnterior = calc(semanaOutro as any, cardapioOutro.fase_escolar)

    // Delta = atual - anterior
    const delta: NutrienteDia = {
      energia_kcal: resAtual.media_dia.energia_kcal - resAnterior.media_dia.energia_kcal,
      carboidratos_g: resAtual.media_dia.carboidratos_g - resAnterior.media_dia.carboidratos_g,
      proteinas_g: resAtual.media_dia.proteinas_g - resAnterior.media_dia.proteinas_g,
      lipidios_g: resAtual.media_dia.lipidios_g - resAnterior.media_dia.lipidios_g,
      fibra_alimentar_g: resAtual.media_dia.fibra_alimentar_g - resAnterior.media_dia.fibra_alimentar_g,
      sodio_mg: resAtual.media_dia.sodio_mg - resAnterior.media_dia.sodio_mg,
      ferro_mg: resAtual.media_dia.ferro_mg - resAnterior.media_dia.ferro_mg,
      ferro_heme_mg: resAtual.media_dia.ferro_heme_mg - resAnterior.media_dia.ferro_heme_mg,
      vitamina_a_mcg: resAtual.media_dia.vitamina_a_mcg - resAnterior.media_dia.vitamina_a_mcg,
      vitamina_c_mg: resAtual.media_dia.vitamina_c_mg - resAnterior.media_dia.vitamina_c_mg,
      calcio_mg: resAtual.media_dia.calcio_mg - resAnterior.media_dia.calcio_mg,
      magnesio_mg: resAtual.media_dia.magnesio_mg - resAnterior.media_dia.magnesio_mg,
      zinco_mg: resAtual.media_dia.zinco_mg - resAnterior.media_dia.zinco_mg,
      acucar_adicionado_g: resAtual.media_dia.acucar_adicionado_g - resAnterior.media_dia.acucar_adicionado_g,
    }

    return NextResponse.json({
      atual: {
        cardapio_id: cardapioAtual.id,
        cardapio_nome: cardapioAtual.nome,
        semana: semanaNum,
        fase_escolar: cardapioAtual.fase_escolar,
        ...resAtual,
      },
      anterior: {
        cardapio_id: cardapioOutro.id,
        cardapio_nome: cardapioOutro.nome,
        semana: semanaOutroNum,
        fase_escolar: cardapioOutro.fase_escolar,
        ...resAnterior,
      },
      delta,
      variacoes_pct: {
        energia_kcal: resAnterior.media_dia.energia_kcal > 0
          ? ((resAtual.media_dia.energia_kcal - resAnterior.media_dia.energia_kcal) / resAnterior.media_dia.energia_kcal) * 100
          : 0,
        proteinas_g: resAnterior.media_dia.proteinas_g > 0
          ? ((resAtual.media_dia.proteinas_g - resAnterior.media_dia.proteinas_g) / resAnterior.media_dia.proteinas_g) * 100
          : 0,
        ferro_mg: resAnterior.media_dia.ferro_mg > 0
          ? ((resAtual.media_dia.ferro_mg - resAnterior.media_dia.ferro_mg) / resAnterior.media_dia.ferro_mg) * 100
          : 0,
      },
    })
  } catch (error) {
    console.error('Erro ao comparar cardápios:', error)
    return NextResponse.json({ error: 'Erro ao comparar cardápios' }, { status: 500 })
  }
}
