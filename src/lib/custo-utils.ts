// ============================================================
// CUSTO UTILS — shared logic for calculating insumo requirements
// from production data. Used by /api/custos/insumos-semana
// and /api/custos/previsao
// ============================================================

import { db } from '@/lib/db'
import { inicioSemana, numeroSemana, anoSemana, dataISO, DIAS_SEMANA, type DiaSemana } from '@/lib/date-utils'
import { PCQ_PRODUCAO, diaSemanaTexto, tipoPaoEfetivoEscola, escolaPulaLanche } from '@/lib/producao-utils'
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
  // v9.7: quais lanches são servidos e suas quantidades totais
  lanches_servidos: Array<{ lanche_id: string; lanche_nome: string; quantidade: number }>
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
  // v9.9.0: modos de lanche da semana (bifásica e interior especial).
  // Necessários para que as escolas bifásica/interior-especial usem o tipo
  // de pão e o lanche corretos, IGUAL à /api/producao.
  const lancheBifasicaModo = (cardapioFinal as any)?.lanche_bifasica_modo || 'LANCHE'
  const lancheInteriorModo = (cardapioFinal as any)?.lanche_interior_modo || 'LANCHE'

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
  // v9.7: rastrear quais lanches são servidos e suas quantidades
  const lanchesServidosMap = new Map<string, number>()  // lanche_id → quantidade total

  // Domingo: produção PF para segunda
  const domingo = addDays(inicio, -1)
  const domingoStr = dataISO(domingo)
  const segundaStr = dataISO(inicio)
  let pfDomingo = 0

  for (const escola of escolas) {
    if (!escola.recebe_pf) continue
    // v9.9.0: usar tipoPaoEfetivoEscola() — alinha com /api/producao: bifásica
    // e interior especial usam o tipo de pão do modo da semana (SEMPAO quando
    // modo LANCHE/NENHUM), e pao_fixo força PADRAO. Fallback PADRAO igual à produção.
    const tipoPaoEfetivo = tipoPaoEfetivoEscola(
      escola.categoria,
      (escola as any).pao_fixo,
      tipoPao,
      lancheBifasicaModo,
      (escola as any).interior_especial === true,
      lancheInteriorModo
    )
    const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPaoEfetivo)
      || escola.pf_quantidades.find((q) => q.tipo_pao === 'PADRAO')
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
        // v9.9.0: usar tipoPaoEfetivoEscola() — alinha com /api/producao (ver domingo)
        const tipoPaoEfetivo = tipoPaoEfetivoEscola(
          escola.categoria,
          (escola as any).pao_fixo,
          tipoPao,
          lancheBifasicaModo,
          (escola as any).interior_especial === true,
          lancheInteriorModo
        )
        const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPaoEfetivo)
          || escola.pf_quantidades.find((q) => q.tipo_pao === 'PADRAO')
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
    // v9.9.0: alinhado com /api/producao — bifásica e interior especial só
    // recebem o lanche quando o modo da semana é LANCHE, usando a distribuição
    // do lancheRegular (lanche_bifasica_id é legado).
    for (const escola of escolas) {
      if (!escola.recebe_lanche) continue

      // v9.8.1/v9.9.0: bifásica e interior especial em modo PAO_*/NENHUM não recebem lanche
      if (escolaPulaLanche(escola.categoria, (escola as any).interior_especial, lancheBifasicaModo, lancheInteriorModo)) continue

      const lancheId = lancheRegular?.id
      if (!lancheId) continue

      const distKey = `${lancheId}_${escola.id}_${diaKey}`
      const qtdBase = lancheDistMap.get(distKey) || 0
      if (qtdBase === 0) continue

      const ajusteKey = `${escola.id}_${diaKey}_LANCHE`
      const { zerado } = produtoZerado(feriadosMap, diaStr, escola.categoria, 'LANCHE')
      const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zerado ? 0 : qtdBase)
      diaLanche += qtd
      // v9.7: rastrear quantidade por lanche_id
      lanchesServidosMap.set(lancheId, (lanchesServidosMap.get(lancheId) || 0) + qtd)
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
    // v9.7: lanches servidos com nome e quantidade
    lanches_servidos: Array.from(lanchesServidosMap.entries()).map(([lanche_id, quantidade]) => {
      const lanche = lancheRegular?.id === lanche_id ? lancheRegular : lancheBifasica?.id === lanche_id ? lancheBifasica : null
      return {
        lanche_id,
        lanche_nome: lanche?.nome || 'Lanche desconhecido',
        quantidade,
      }
    }),
  }
}

// ── Calculate insumo requirements from week totals ─────────

export async function calcularInsumosSemana(
  totais: TotaisSemana,
): Promise<InsumoCalculado[]> {
  // Fetch receitas and insumos
  const [receitas, insumos] = await Promise.all([
    db.receita.findMany({ include: { insumo: true, lanche: true } }),
    db.insumo.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
  ])

  // Build receita lookup for PF and PCQ (generic, no lanche_id)
  // Map<produto_tipo, Map<insumo_id, quantidade>>
  const receitaGenericMap = new Map<string, Map<string, number>>()
  for (const r of receitas) {
    if (r.lanche_id) continue  // skip lanche-specific recipes for now
    if (!receitaGenericMap.has(r.produto_tipo)) {
      receitaGenericMap.set(r.produto_tipo, new Map())
    }
    receitaGenericMap.get(r.produto_tipo)!.set(r.insumo_id, r.quantidade_por_unidade)
  }

  // v9.7: Build lanche-specific receita lookup
  // Map<lanche_id, Map<insumo_id, quantidade>>
  const receitaLancheMap = new Map<string, Map<string, number>>()
  for (const r of receitas) {
    if (!r.lanche_id) continue  // only lanche-specific recipes
    if (!receitaLancheMap.has(r.lanche_id)) {
      receitaLancheMap.set(r.lanche_id, new Map())
    }
    receitaLancheMap.get(r.lanche_id)!.set(r.insumo_id, r.quantidade_por_unidade)
  }

  // Generic LANCHE receita (fallback when no specific recipe)
  const lancheGenericReceita = receitaGenericMap.get('LANCHE') || new Map<string, number>()

  // Calculate per-insumo requirements
  const resultado: InsumoCalculado[] = []

  for (const insumo of insumos) {
    const pfReceita = receitaGenericMap.get('PF')?.get(insumo.id) || 0
    const pcqReceita = receitaGenericMap.get('PCQ')?.get(insumo.id) || 0

    // PF and PCQ: same as before (generic recipe × total)
    let detalhePF = 0
    let detalhePCQ = 0
    for (const dia of totais.dias) {
      detalhePF += dia.total_pf * pfReceita
      detalhePCQ += dia.total_pcq * pcqReceita
    }

    // v9.7: LANCHE — use receita específica por lanche quando disponível
    let detalheLanche = 0
    if (totais.lanches_servidos && totais.lanches_servidos.length > 0) {
      for (const ls of totais.lanches_servidos) {
        // Tenta receita específica deste lanche
        const receitaEspecifica = receitaLancheMap.get(ls.lanche_id)?.get(insumo.id)
        if (receitaEspecifica !== undefined) {
          detalheLanche += ls.quantidade * receitaEspecifica
        } else {
          // Fallback: receita genérica de LANCHE
          const receitaGenerica = lancheGenericReceita.get(insumo.id) || 0
          detalheLanche += ls.quantidade * receitaGenerica
        }
      }
    } else {
      // Fallback: se não há lanches_servidos, usa total_lanche × receita genérica
      const lancheReceita = lancheGenericReceita.get(insumo.id) || 0
      for (const dia of totais.dias) {
        detalheLanche += dia.total_lanche * lancheReceita
      }
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
