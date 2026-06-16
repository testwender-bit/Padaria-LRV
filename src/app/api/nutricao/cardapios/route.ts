import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria')
    const escola_id = searchParams.get('escola_id')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}

    if (categoria) {
      where.categoria_escola = categoria
    }
    if (escola_id) {
      where.escola_id = escola_id
    }
    if (status) {
      where.status = status
    }

    const cardapios = await db.cardapioNutricional.findMany({
      where,
      include: {
        escola: {
          select: { id: true, nome: true },
        },
        nutricionista: {
          select: { id: true, nome: true, crn: true },
        },
        semanas: {
          select: { id: true },
        },
      },
      orderBy: { criado_em: 'desc' },
    })

    // Adicionar contagem de semanas
    const result = cardapios.map((cardapio) => ({
      id: cardapio.id,
      nome: cardapio.nome,
      escola_id: cardapio.escola_id,
      nutricionista_id: cardapio.nutricionista_id,
      categoria_escola: cardapio.categoria_escola,
      fase_escolar: cardapio.fase_escolar,
      ano: cardapio.ano,
      semestre: cardapio.semestre,
      status: cardapio.status,
      origem_id: cardapio.origem_id,
      criado_em: cardapio.criado_em,
      atualizado_em: cardapio.atualizado_em,
      escola: cardapio.escola,
      nutricionista: cardapio.nutricionista,
      semanas: cardapio.semanas,
      semanas_count: cardapio.semanas.length,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao buscar cardápios:', error)
    return NextResponse.json({ error: 'Erro ao buscar cardápios' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.nome || !body.nutricionista_id || !body.categoria_escola || !body.ano || !body.semestre) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome, nutricionista_id, categoria_escola, ano, semestre' },
        { status: 400 }
      )
    }

    // Calcular a próxima segunda-feira a partir de hoje
    const hoje = new Date()
    const diaSemana = hoje.getDay() // 0=dom, 1=seg, ...
    const diasAteSegunda = diaSemana === 0 ? 1 : diaSemana === 1 ? 7 : 8 - diaSemana
    const proximaSegunda = new Date(hoje)
    proximaSegunda.setDate(hoje.getDate() + diasAteSegunda)

    const diasDaSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

    const cardapio = await db.$transaction(async (tx) => {
      const criadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)

      const card = await tx.cardapioNutricional.create({
        data: {
          nome: body.nome,
          escola_id: body.escola_id || null,
          nutricionista_id: body.nutricionista_id,
          categoria_escola: body.categoria_escola,
          fase_escolar: body.fase_escolar || 'FUND_FINAL',
          ano: body.ano,
          semestre: body.semestre,
          status: 'RASCUNHO',
          origem_id: null,
          criado_em: criadoEm,
          atualizado_em: criadoEm,
        },
      })

      // Gerar 22 semanas com 5 dias cada (segunda a sexta)
      for (let semanaNum = 1; semanaNum <= 22; semanaNum++) {
        const dataInicio = new Date(proximaSegunda)
        dataInicio.setDate(proximaSegunda.getDate() + (semanaNum - 1) * 7)

        const dataFim = new Date(dataInicio)
        dataFim.setDate(dataInicio.getDate() + 4) // sexta-feira

        const dataInicioStr = dataInicio.toISOString().split('T')[0]
        const dataFimStr = dataFim.toISOString().split('T')[0]

        const semana = await tx.cardapioSemanaNutri.create({
          data: {
            cardapio_id: card.id,
            numero: semanaNum,
            data_inicio: dataInicioStr,
            data_fim: dataFimStr,
          },
        })

        // Criar 5 dias por semana
        for (let diaIdx = 0; diaIdx < 5; diaIdx++) {
          await tx.cardapioDiaNutri.create({
            data: {
              semana_id: semana.id,
              dia_semana: diasDaSemana[diaIdx],
            },
          })
        }
      }

      // Retornar cardápio completo com semanas e dias
      return tx.cardapioNutricional.findUnique({
        where: { id: card.id },
        include: {
          escola: true,
          nutricionista: true,
          semanas: {
            include: {
              dias: true,
            },
            orderBy: { numero: 'asc' },
          },
        },
      })
    })

    return NextResponse.json(cardapio, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao criar cardápio' }, { status: 500 })
  }
}
