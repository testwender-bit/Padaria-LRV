import { NextResponse } from 'next/server'
import { addWeeks } from 'date-fns'
import { calcularTotaisSemana, calcularInsumosSemana } from '@/lib/custo-utils'
import { dataISO, inicioSemana } from '@/lib/date-utils'
import { db } from '@/lib/db'

// GET /api/custos/previsao?data=YYYY-MM-DD&semanas=4
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dataParam = searchParams.get('data')
    const semanasParam = searchParams.get('semanas')

    if (dataParam && !/^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
      return NextResponse.json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' }, { status: 400 })
    }

    const semanas = Math.min(Math.max(parseInt(semanasParam || '4', 10), 1), 8)
    const dataRef = dataParam || dataISO(new Date())
    const refDate = new Date(dataRef + 'T12:00:00')

    // Get insumos for stock info
    const insumos = await db.insumo.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    })

    // Get receitas
    const receitas = await db.receita.findMany({ include: { insumo: true } })

    // Build receita lookup: Map<produto_tipo, Map<insumo_id, quantidade_por_unidade>>
    const receitaMap = new Map<string, Map<string, number>>()
    for (const r of receitas) {
      if (!receitaMap.has(r.produto_tipo)) {
        receitaMap.set(r.produto_tipo, new Map())
      }
      receitaMap.get(r.produto_tipo)!.set(r.insumo_id, r.quantidade_por_unidade)
    }

    // Calculate for each week
    const semanasData: {
      semana: number
      ano: number
      periodo: string
      tipoPao: string
      nomePao: string
      lancheRegular: string | null
      lancheBifasica: string | null
      total_pf: number
      total_pcq: number
      total_lanche: number
    }[] = []
    // insumo_id → array of weekly quantities
    const insumoSemanalMap = new Map<string, number[]>()

    for (let w = 0; w < semanas; w++) {
      const weekDate = addWeeks(refDate, w)
      const weekDataStr = dataISO(inicioSemana(weekDate))

      const totais = await calcularTotaisSemana(weekDataStr)
      const insumosCalc = await calcularInsumosSemana(totais)

      semanasData.push({
        semana: totais.semana,
        ano: totais.ano,
        periodo: `${totais.periodo.split(' a ')[0].split('/').slice(0, 2).join('/')} a ${totais.periodo.split(' a ')[1]?.split('/').slice(0, 2).join('/') || totais.periodo}`,
        tipoPao: totais.tipoPao,
        nomePao: totais.nomePao,
        lancheRegular: totais.lancheRegular,
        lancheBifasica: totais.lancheBifasica,
        total_pf: totais.total_pf,
        total_pcq: totais.total_pcq,
        total_lanche: totais.total_lanche,
      })

      // Accumulate weekly quantities per insumo
      for (const ic of insumosCalc) {
        if (!insumoSemanalMap.has(ic.insumo_id)) {
          insumoSemanalMap.set(ic.insumo_id, [])
        }
        insumoSemanalMap.get(ic.insumo_id)!.push(ic.quantidade_estimada)
      }
    }

    // Build insumo forecast data
    const insumosPrevisao = insumos.map((insumo) => {
      const semanalQuantidades = insumoSemanalMap.get(insumo.id) || new Array(semanas).fill(0)

      // Pad if needed (insumo might not be in any recipe)
      while (semanalQuantidades.length < semanas) {
        semanalQuantidades.push(0)
      }

      const quantidadeTotal = semanalQuantidades.reduce((s, q) => s + q, 0)
      const custoTotal = quantidadeTotal * insumo.preco_unitario
      const deficit = insumo.estoque_atual - quantidadeTotal
      const semanasCobertas = quantidadeTotal > 0
        ? Math.floor(insumo.estoque_atual / (quantidadeTotal / semanas))
        : 999
      const sugeridoPedir = Math.max(0, -deficit)

      return {
        insumo_id: insumo.id,
        nome: insumo.nome,
        unidade: insumo.unidade,
        preco_unitario: insumo.preco_unitario,
        estoque_atual: insumo.estoque_atual,
        quantidade_semanal: semanalQuantidades.map((q) => Math.round(q * 1000) / 1000),
        quantidade_total: Math.round(quantidadeTotal * 1000) / 1000,
        custo_total: Math.round(custoTotal * 100) / 100,
        deficit: Math.round(deficit * 1000) / 1000,
        semanas_cobertas: Math.min(semanasCobertas, semanas),
        sugerido_pedir: Math.round(sugeridoPedir * 1000) / 1000,
      }
    })

    // Summary
    const custoTotalPeriodo = insumosPrevisao.reduce((s, i) => s + i.custo_total, 0)
    const totalDeficit = insumosPrevisao.reduce((s, i) => s + Math.max(0, -i.deficit) * i.preco_unitario, 0)
    const insumosComDeficit = insumosPrevisao.filter((i) => i.deficit < 0).length

    // Date range
    const dataInicio = dataISO(inicioSemana(refDate))
    const dataFim = dataISO(inicioSemana(addWeeks(refDate, semanas - 1)))
    const dataFimFormat = `${dataFim.split('-').reverse().join('/')}`

    return NextResponse.json({
      semanas_cobertas: semanas,
      data_inicio: dataInicio.split('-').reverse().join('/'),
      data_fim: dataFimFormat,
      semanas: semanasData,
      insumos: insumosPrevisao,
      resumo: {
        custo_total_periodo: Math.round(custoTotalPeriodo * 100) / 100,
        total_deficit: Math.round(totalDeficit * 100) / 100,
        insumos_com_deficit: insumosComDeficit,
      },
    })
  } catch (error) {
    console.error('Erro ao calcular previsão:', error)
    return NextResponse.json({ error: 'Erro ao calcular previsão de demanda' }, { status: 500 })
  }
}
