import { NextResponse } from 'next/server'
import { calcularTotaisSemana, calcularInsumosSemana, getPedidosPendentesPorInsumo, getUltimaContagemPorInsumo } from '@/lib/custo-utils'
import { dataISO } from '@/lib/date-utils'

// GET /api/custos/insumos-semana?data=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dataParam = searchParams.get('data')

    if (dataParam && !/^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
      return NextResponse.json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' }, { status: 400 })
    }

    const dataRef = dataParam || dataISO(new Date())

    // Calculate week production totals
    const totais = await calcularTotaisSemana(dataRef)

    // Calculate insumo requirements from production totals
    const insumosCalc = await calcularInsumosSemana(totais)

    // Get pending purchase orders per insumo
    const pedidosPendentesMap = await getPedidosPendentesPorInsumo()

    // Get latest physical count per insumo
    const contagemMap = await getUltimaContagemPorInsumo()

    // Calculate total pending value
    let totalPedidosPendentesValor = 0

    // Build response
    const insumos = insumosCalc.map((ic) => {
      const pedidosPendentes = pedidosPendentesMap.get(ic.insumo_id) || 0
      const contagemFisica = contagemMap.get(ic.insumo_id) || null
      const deficit = ic.estoque_atual + pedidosPendentes - ic.quantidade_estimada

      // Accumulate pending value
      totalPedidosPendentesValor += pedidosPendentes * ic.preco_unitario

      return {
        insumo_id: ic.insumo_id,
        nome: ic.nome,
        unidade: ic.unidade,
        preco_unitario: ic.preco_unitario,
        estoque_atual: ic.estoque_atual,
        estoque_minimo: ic.estoque_minimo,
        detalhe: ic.detalhe,
        quantidade_estimada: ic.quantidade_estimada,
        custo_estimado: ic.custo_estimado,
        pedidos_pendentes: Math.round(pedidosPendentes * 1000) / 1000,
        contagem_fisica: contagemFisica
          ? {
              quantidade: contagemFisica.quantidade,
              data: contagemFisica.data,
              diferenca: contagemFisica.diferenca,
            }
          : null,
        deficit: Math.round(deficit * 1000) / 1000,
      }
    })

    // Summary
    const totalEstimado = insumosCalc.reduce((s, i) => s + i.quantidade_estimada, 0)
    const totalCustoEstimado = insumosCalc.reduce((s, i) => s + i.custo_estimado, 0)
    const totalEmEstoqueValor = insumosCalc.reduce((s, i) => s + i.estoque_atual * i.preco_unitario, 0)
    const insumosDeficit = insumos.filter((i) => i.deficit < 0).length

    return NextResponse.json({
      semana: totais.semana,
      ano: totais.ano,
      periodo: totais.periodo,
      tipoPao: totais.tipoPao,
      nomePao: totais.nomePao,
      lancheRegular: totais.lancheRegular,
      lancheBifasica: totais.lancheBifasica,
      totais_semana: {
        total_pf: totais.total_pf,
        total_pcq: totais.total_pcq,
        total_lanche: totais.total_lanche,
      },
      insumos,
      resumo: {
        total_estimado: Math.round(totalEstimado * 1000) / 1000,
        total_custo_estimado: Math.round(totalCustoEstimado * 100) / 100,
        total_em_estoque_valor: Math.round(totalEmEstoqueValor * 100) / 100,
        total_pedidos_pendentes_valor: Math.round(totalPedidosPendentesValor * 100) / 100,
        insumos_deficit: insumosDeficit,
      },
    })
  } catch (error) {
    console.error('Erro ao calcular insumos da semana:', error)
    return NextResponse.json({ error: 'Erro ao calcular insumos da semana' }, { status: 500 })
  }
}
