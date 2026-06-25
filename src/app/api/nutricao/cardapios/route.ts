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
      cardapio_base_id: cardapio.cardapio_base_id,
      ciclo_semanas: cardapio.ciclo_semanas,
      repetir_ciclo: cardapio.repetir_ciclo,
      criado_em: cardapio.criado_em,
      atualizado_em: cardapio.atualizado_em,
      escola: cardapio.escola,
      nutricionista: cardapio.nutricionista,
      semanas: cardapio.semanas,
      semanas_count: cardapio.semanas.length,
      is_base: cardapio.escola_id === null,
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

    // v8.14: NÃO usa $transaction (Supabase free tier + pgbouncer mata transações longas).
    // Em vez disso, faz creates sequenciais. Em caso de erro no meio, deleta o cardápio
    // criado (cascade cuida das semanas e dias).
    const criadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)

    const card = await db.cardapioNutricional.create({
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

    try {
      // Gerar 22 semanas com 5 dias cada (segunda a sexta)
      for (let semanaNum = 1; semanaNum <= 22; semanaNum++) {
        const dataInicio = new Date(proximaSegunda)
        dataInicio.setDate(proximaSegunda.getDate() + (semanaNum - 1) * 7)

        const dataFim = new Date(dataInicio)
        dataFim.setDate(dataInicio.getDate() + 4) // sexta-feira

        const dataInicioStr = dataInicio.toISOString().split('T')[0]
        const dataFimStr = dataFim.toISOString().split('T')[0]

        const semana = await db.cardapioSemanaNutri.create({
          data: {
            cardapio_id: card.id,
            numero: semanaNum,
            data_inicio: dataInicioStr,
            data_fim: dataFimStr,
          },
        })

        // v8.14: usa createMany para os 5 dias (1 query em vez de 5)
        await db.cardapioDiaNutri.createMany({
          data: diasDaSemana.map(dia => ({
            semana_id: semana.id,
            dia_semana: dia,
          })),
        })
      }
    } catch (innerError) {
      // Erro no meio da criação — deleta o cardápio (cascade limpa semanas/dias)
      console.error('Erro ao criar semanas/dias, deletando cardápio:', innerError)
      await db.cardapioNutricional.delete({ where: { id: card.id } }).catch(() => {})
      throw innerError
    }

    // Retornar cardápio completo com semanas e dias
    const cardapio = await db.cardapioNutricional.findUnique({
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

    return NextResponse.json(cardapio, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao criar cardápio' }, { status: 500 })
  }
}
