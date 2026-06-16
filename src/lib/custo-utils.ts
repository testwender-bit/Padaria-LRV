// ============================================================
// CUSTO UTILS — shared logic for calculating insumo requirements
// from production data. Used by /api/custos/insumos-semana
// and /api/custos/previsao
// ============================================================

import { db } from '@/lib/db'
import { inicioSemana, numeroSemana, anoSemana, dataISO, DIAS_SEMANA, type DiaSemana } from '@/lib/date-utils'
import { PCQ_PRODUCAO, diaSemanaTexto } from '@/lib/producao-utils'
import { produtoZerado, type FeriadoData } from '@/lib/feriado-utils'
import { addDays, format } from 'date-fns'

// ── Types ──────────────────────────────────────────────────

export interface TotaisDia {
  data: string
  total_pf: number
  total_pcq: number
  total_lanche: number
}

export interface TotaisSemana {
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
  dias: TotaisDia[]
}

export interface InsumoCalculado {
  insumo_id: string
  nome: string
  unidade: string
  preco_unitario: number
  estoque_atual: number
  estoque_minimo: number
  detalhe: {
    PF: number
    PCQ: number
    LANCHE: number
  }
  quantidade_estimada: number
  custo_estimado: number
}

// ── Core calculation: production day totals ────────────────

export async function calcularTotaisSemana(dataRef: string): Promise<TotaisSemana> {
  const refDate = new Date(dataRef + 'T12:00:00')
  const inicio = inicioSemana(refDate)
  const semana = numeroSemana(refDate)
  const ano = anoSemana(refDate)

  // Fetch all required data in parallel
  const [escolas, feriados, ajustes, cardapio] = await Promise.all([
    db.escola.findMany({
      where: { ativo: true },
      include: { pf_quantidades: true, pcq_quantidades: true },
      orderBy: [{ rota: 'asc' }, { ordem_rota: 'asc' }],
    }),
    db.feriado.findMany(),
    db.ajuste.findMany({ where: { ano, semana } }),
    db.cardapioSemestral.findFirst({
      where: { numero_semana_iso: semana },
      include: { lanche_regular: true, lanche_bifasica: true },
    }),
  ])

  // Fallback: try to find cardápio by date range if not found by ISO week
  let cardapioFinal = cardapio
  if (!cardapioFinal) {
    const segundaStr = dataISO(inicio)
    const sextaStr = dataISO(addDays(inicio, 4))
    cardapioFinal = await db.cardapioSemestral.findFirst({
      where: {
        data_inicio: { lte: sextaStr },
        data_fim: { gte: segundaStr },
      },
      include: { lanche_regular: true, lanche_bifasica: true },
    })
  }

  // Build feriados map
  const feriadosMap = new Map<string, FeriadoData[]>()
  for (const f of feriados) {
    const arr = feriadosMap.get(f.data) || []
    arr.push(f)
    feriadosMap.set(f.data, arr)
  }

  // Build ajustes map
  const ajustesMap = new Map<string, number>()
  for (const a of ajustes) {
    ajustesMap.set(`${a.escola_id}_${a.dia_semana}_${a.produto}`, a.qtd_final)
  }

  // Cardápio info
  const tipoPao = cardapioFinal?.tipo_pao || 'PADRAO'
  const nomePao = cardapioFinal?.nome_pao || 'Pão Francês'
  const lancheRegular = cardapioFinal?.lanche_regular
  const lancheBifasica = cardapioFinal?.lanche_bifasica

  // Fetch lanche distribution
  const lancheDistribuicao = lancheRegular || lancheBifasica
    ? await db.lancheDistribuicao.findMany({
        where: {
          lanche_id: { in: [lancheRegular?.id || '', lancheBifasica?.id || ''].filter(Boolean) },
        },
      })
    : []

  const lancheDistMap = new Map<string, number>()
  for (const ld of lancheDistribuicao) {
    lancheDistMap.set(`${ld.lanche_id}_${ld.escola_id}_${ld.dia_semana}`, ld.quantidade)
  }

  // Calculate day totals
  const dias: TotaisDia[] = []
  let total_pf = 0
  let total_pcq = 0
  let total_lanche = 0

  // Domingo: produção PF para segunda
  const domingo = addDays(inicio, -1)
  const domingoStr = dataISO(domingo)
  const segundaStr = dataISO(inicio)
  let pfDomingo = 0

  for (const escola of escolas) {
    if (!escola.recebe_pf) continue
    const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPao)
    if (!pfQ) continue

    const { zerado } = produtoZerado(feriadosMap, segundaStr, escola.categoria, 'PF')
    const ajusteKey = `${escola.id}_segunda_PF`
    const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zerado ? 0 : pfQ.segunda)
    pfDomingo += qtd
  }

  dias.push({
    data: domingoStr,
    total_pf: pfDomingo,
    total_pcq: 0,
    total_lanche: 0,
  })
  total_pf += pfDomingo

  // Segunda a sexta
  const diaKeys: DiaSemana[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
  const diaTextKeys = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

  for (let i = 0; i < 5; i++) {
    const diaDate = addDays(inicio, i)
    const diaStr = dataISO(diaDate)
    const diaKey = diaKeys[i]

    let diaPf = 0
    let diaPcq = 0
    let diaLanche = 0

    // PF: produzido D-1 (hoje produz para amanhã)
    if (i < 4) {
      const diaEntrega = diaKeys[i + 1]
      const dataEntrega = dataISO(addDays(inicio, i + 1))

      for (const escola of escolas) {
        if (!escola.recebe_pf) continue
        const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPao)
        if (!pfQ) continue

        const { zerado } = produtoZerado(feriadosMap, dataEntrega, escola.categoria, 'PF')
        const qtdBase = pfQ[diaEntrega as keyof typeof pfQ] as number
        const ajusteKey = `${escola.id}_${diaEntrega}_PF`
        const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zerado ? 0 : qtdBase)
        diaPf += qtd
      }
    }

    // PCQ: produzido seg/qua/sex
    const diaTexto = diaSemanaTexto(diaDate)
    if (diaTexto === 'segunda' || diaTexto === 'quarta' || diaTexto === 'sexta') {
      const pcqConfig = PCQ_PRODUCAO[diaTexto as keyof typeof PCQ_PRODUCAO]

      for (const escola of escolas) {
        if (!escola.recebe_pcq) continue
        const pcqQ = escola.pcq_quantidades[0]
        if (!pcqQ) continue

        const campoPcq = pcqConfig.campo as keyof typeof pcqQ
        const qtdFormas = pcqQ[campoPcq] as number

        if (qtdFormas > 0) {
          const ajusteKey = `${escola.id}_${diaKey}_PCQ`
          let zeradoPcq = false

          const checkProd = produtoZerado(feriadosMap, diaStr, escola.categoria, 'PCQ')
          if (checkProd.zerado) zeradoPcq = true

          if (!zeradoPcq) {
            for (const entregaDia of pcqConfig.entregas) {
              const entregaIdx = diaTextKeys.indexOf(entregaDia)
              if (entregaIdx >= 0) {
                const dataEntregaPCQ = dataISO(addDays(inicio, entregaIdx))
                const checkEnt = produtoZerado(feriadosMap, dataEntregaPCQ, escola.categoria, 'PCQ')
                if (checkEnt.zerado) { zeradoPcq = true; break }
              }
            }
          }

          const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zeradoPcq ? 0 : qtdFormas)
          diaPcq += qtd
        }

        // PF Complemento (creches)
        const campoComp = pcqConfig.pf_comp as keyof typeof pcqQ
        const qtdComp = pcqQ[campoComp] as number

        if (qtdComp > 0) {
          const ajusteKey = `${escola.id}_${diaKey}_PF_COMP`
          let zeradoComp = false
          const checkProdComp = produtoZerado(feriadosMap, diaStr, escola.categoria, 'PF_COMP')
          if (checkProdComp.zerado) zeradoComp = true

          if (!zeradoComp) {
            for (const entregaDia of pcqConfig.entregas) {
              const entregaIdx = diaTextKeys.indexOf(entregaDia)
              if (entregaIdx >= 0) {
                const dataEntregaComp = dataISO(addDays(inicio, entregaIdx))
                const checkEnt = produtoZerado(feriadosMap, dataEntregaComp, escola.categoria, 'PF_COMP')
                if (checkEnt.zerado) { zeradoComp = true; break }
              }
            }
          }

          const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zeradoComp ? 0 : qtdComp)
          diaPf += qtd
        }
      }
    }

    // Lanche: produzido D-0 (mesmo dia)
    for (const escola of escolas) {
      if (!escola.recebe_lanche) continue

      const lancheId = (escola.categoria === 'BIFASICA' ? lancheBifasica : lancheRegular)?.id
      if (!lancheId) continue

      const distKey = `${lancheId}_${escola.id}_${diaKey}`
      const qtdBase = lancheDistMap.get(distKey) || 0
      if (qtdBase === 0) continue

      const ajusteKey = `${escola.id}_${diaKey}_LANCHE`
      const { zerado } = produtoZerado(feriadosMap, diaStr, escola.categoria, 'LANCHE')
      const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zerado ? 0 : qtdBase)
      diaLanche += qtd
    }

    dias.push({
      data: diaStr,
      total_pf: diaPf,
      total_pcq: diaPcq,
      total_lanche: diaLanche,
    })

    total_pf += diaPf
    total_pcq += diaPcq
    total_lanche += diaLanche
  }

  const periodo = `${format(inicio, 'dd/MM/yyyy')} a ${format(addDays(inicio, 4), 'dd/MM/yyyy')}`

  return {
    semana,
    ano,
    periodo,
    tipoPao,
    nomePao,
    lancheRegular: lancheRegular?.nome || null,
    lancheBifasica: lancheBifasica?.nome || null,
    total_pf,
    total_pcq,
    total_lanche,
    dias,
  }
}

// ── Calculate insumo requirements from week totals ─────────

export async function calcularInsumosSemana(
  totais: TotaisSemana,
): Promise<InsumoCalculado[]> {
  // Fetch receitas and insumos
  const [receitas, insumos] = await Promise.all([
    db.receita.findMany({ include: { insumo: true } }),
    db.insumo.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
  ])

  // Build receita lookup: Map<produto_tipo, Map<insumo_id, quantidade_por_unidade>>
  const receitaMap = new Map<string, Map<string, number>>()
  for (const r of receitas) {
    if (!receitaMap.has(r.produto_tipo)) {
      receitaMap.set(r.produto_tipo, new Map())
    }
    receitaMap.get(r.produto_tipo)!.set(r.insumo_id, r.quantidade_por_unidade)
  }

  // Calculate per-insumo requirements
  const resultado: InsumoCalculado[] = []

  for (const insumo of insumos) {
    const pfReceita = receitaMap.get('PF')?.get(insumo.id) || 0
    const pcqReceita = receitaMap.get('PCQ')?.get(insumo.id) || 0
    const lancheReceita = receitaMap.get('LANCHE')?.get(insumo.id) || 0

    // If this insumo is not used in any recipe, skip detailed calc but still include
    let detalhePF = 0
    let detalhePCQ = 0
    let detalheLanche = 0

    for (const dia of totais.dias) {
      detalhePF += dia.total_pf * pfReceita
      detalhePCQ += dia.total_pcq * pcqReceita
      detalheLanche += dia.total_lanche * lancheReceita
    }

    const quantidade_estimada = detalhePF + detalhePCQ + detalheLanche
    const custo_estimado = quantidade_estimada * insumo.preco_unitario

    resultado.push({
      insumo_id: insumo.id,
      nome: insumo.nome,
      unidade: insumo.unidade,
      preco_unitario: insumo.preco_unitario,
      estoque_atual: insumo.estoque_atual,
      estoque_minimo: insumo.estoque_minimo,
      detalhe: {
        PF: Math.round(detalhePF * 1000) / 1000,
        PCQ: Math.round(detalhePCQ * 1000) / 1000,
        LANCHE: Math.round(detalheLanche * 1000) / 1000,
      },
      quantidade_estimada: Math.round(quantidade_estimada * 1000) / 1000,
      custo_estimado: Math.round(custo_estimado * 100) / 100,
    })
  }

  return resultado
}

// ── Get pending purchase orders aggregated by insumo ───────

export async function getPedidosPendentesPorInsumo(): Promise<Map<string, number>> {
  const itens = await db.itemPedidoCompra.findMany({
    where: {
      pedido: { status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
    },
    select: {
      insumo_id: true,
      quantidade: true,
    },
  })

  const map = new Map<string, number>()
  for (const item of itens) {
    map.set(item.insumo_id, (map.get(item.insumo_id) || 0) + item.quantidade)
  }
  return map
}

// ── Get latest physical count per insumo ───────────────────

export async function getUltimaContagemPorInsumo(): Promise<Map<string, { quantidade: number; data: string; diferenca: number }>> {
  try {
    const contagens = await db.contagemEstoque.findMany({
      orderBy: { data_contagem: 'desc' },
      include: { insumo: { select: { id: true } } },
    })

    const map = new Map<string, { quantidade: number; data: string; diferenca: number }>()
    for (const c of contagens) {
      if (!map.has(c.insumo_id)) {
        map.set(c.insumo_id, {
          quantidade: c.quantidade,
          data: c.data_contagem,
          diferenca: c.diferenca,
        })
      }
    }
    return map
  } catch (error: any) {
    // Table may not exist yet (migration not applied) — return empty map
    if (error?.code === 'P2021') {
      console.warn('[custo-utils] Tabela ContagemEstoque não encontrada. Retornando mapa vazio.')
      return new Map()
    }
    throw error
  }
}
