import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { inicioSemana, numeroSemana, anoSemana, dataISO, type DiaSemana, DIAS_SEMANA } from '@/lib/date-utils'
import type { EscolaRomaneio, RomaneioMotorista } from '@/lib/romaneio-utils'
import { diasVazios, diasVaziosStr, somaDias } from '@/lib/romaneio-utils'
import { produtoZerado, type FeriadoData } from '@/lib/feriado-utils'
import { addDays } from 'date-fns'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dataRef = searchParams.get('data') || dataISO(new Date())
    const refDate = new Date(dataRef + 'T12:00:00')
    const inicio = inicioSemana(refDate)
    const semana = numeroSemana(refDate)
    const ano = anoSemana(refDate)

    const [escolas, feriados, ajustes, cardapio] = await Promise.all([
      db.escola.findMany({
        where: { ativo: true },
        include: { pf_quantidades: true, pcq_quantidades: true },
        // v9.5.7: ordem puramente SEQUENCIAL — sem agrupar por rota.
        // Romaneio continua agrupando por motorista na saída (filter por rota),
        // mas a ordem DENTRO de cada motorista respeita ordem_rota global.
        orderBy: [{ ordem_rota: 'asc' }, { nome_curto: 'asc' }],
      }),
      db.feriado.findMany(),
      db.ajuste.findMany({ where: { ano, semana } }),
      db.cardapioSemestral.findFirst({
        where: { numero_semana_iso: semana },
        include: { lanche_regular: true, lanche_bifasica: true },
      }),
    ])

    // Fallback: try to find cardápio by date range
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

    const tipoPao = cardapioFinal?.tipo_pao || 'PADRAO'
    const lancheRegular = cardapioFinal?.lanche_regular
    const lancheBifasica = cardapioFinal?.lanche_bifasica

    // BUG FIX 1: Build feriados map for proper checking
    const feriadosMap = new Map<string, FeriadoData[]>()
    for (const f of feriados) {
      const arr = feriadosMap.get(f.data) || []
      arr.push(f)
      feriadosMap.set(f.data, arr)
    }

    // Ajustes
    const ajustesMap = new Map<string, number>()
    for (const a of ajustes) {
      ajustesMap.set(`${a.escola_id}_${a.dia_semana}_${a.produto}`, a.qtd_final)
    }

    // Lanche distribuição
    const lancheDistribuicao = await db.lancheDistribuicao.findMany({
      where: {
        lanche_id: { in: [lancheRegular?.id || '', lancheBifasica?.id || ''].filter(Boolean) },
      },
    })
    const lancheDistMap = new Map<string, number>()
    for (const ld of lancheDistribuicao) {
      lancheDistMap.set(`${ld.lanche_id}_${ld.escola_id}_${ld.dia_semana}`, ld.quantidade)
    }

    // PCQ delivery mapping — PCQ é produzido e entregue no mesmo dia (sem deslocamento)
    const pcqEntregaMap: Record<DiaSemana, { prodDia: string; campo: string; pfComp: string }[]> = {
      segunda: [{ prodDia: 'segunda', campo: 'prod_segunda', pfComp: 'pf_comp_segunda' }],
      terca: [],
      quarta: [{ prodDia: 'quarta', campo: 'prod_quarta', pfComp: 'pf_comp_quarta' }],
      quinta: [],
      sexta: [{ prodDia: 'sexta', campo: 'prod_sexta', pfComp: 'pf_comp_sexta' }],
    }

    // Calculate date strings for each day of the week
    const diaDates: Record<DiaSemana, string> = {
      segunda: dataISO(inicio),
      terca: dataISO(addDays(inicio, 1)),
      quarta: dataISO(addDays(inicio, 2)),
      quinta: dataISO(addDays(inicio, 3)),
      sexta: dataISO(addDays(inicio, 4)),
    }

    const dias: DiaSemana[] = DIAS_SEMANA

    // Build romaneio per school
    const escolasRomaneio: EscolaRomaneio[] = escolas.map((escola) => {
      const pf = diasVazios()
      const pcq = diasVazios()
      const lanche = diasVazios()
      const feriado_pf = diasVaziosStr()
      const feriado_pcq = diasVaziosStr()
      const feriado_lanche = diasVaziosStr()

      // PF + PF Complemento (integrado, sem distinção)
      if (escola.recebe_pf) {
        // v9.5.7: se escola.pao_fixo === true, SEMPRE usa PADRAO
        const tipoPaoEfetivo = (escola as any).pao_fixo === true ? 'PADRAO' : tipoPao
        const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPaoEfetivo)
          || escola.pf_quantidades.find((q) => q.tipo_pao === 'PADRAO')
        if (pfQ) {
          for (const dia of dias) {
            const dataDia = diaDates[dia]
            const { zerado, feriado: feriadoNome } = produtoZerado(feriadosMap, dataDia, escola.categoria, 'PF')
            const qtdBase = pfQ[dia as keyof typeof pfQ] as number
            const ajusteKey = `${escola.id}_${dia}_PF`
            pf[dia] = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zerado ? 0 : qtdBase)
            if (zerado) feriado_pf[dia] = feriadoNome
          }
        }
      }

      // PCQ + PF Complemento (integrado ao PF)
      if (escola.recebe_pcq && escola.pcq_quantidades[0]) {
        const pcqQ = escola.pcq_quantidades[0]
        for (const dia of dias) {
          const dataDia = diaDates[dia]
          const entries = pcqEntregaMap[dia]
          for (const entry of entries) {
            // PCQ formas
            const campoPcq = entry.campo as keyof typeof pcqQ
            const qtdPcq = pcqQ[campoPcq] as number
            const ajusteKeyPcq = `${escola.id}_${dia}_PCQ`
            const { zerado: zeradoPcq, feriado: feriadoNomePcq } = produtoZerado(feriadosMap, dataDia, escola.categoria, 'PCQ')
            const qtdFinalPcq = ajustesMap.has(ajusteKeyPcq) ? ajustesMap.get(ajusteKeyPcq)! : (zeradoPcq ? 0 : qtdPcq)
            pcq[dia] += qtdFinalPcq
            if (zeradoPcq) feriado_pcq[dia] = feriadoNomePcq

            // PF Complemento — somado ao PF, sem distinção
            const campoComp = entry.pfComp as keyof typeof pcqQ
            const qtdComp = pcqQ[campoComp] as number
            const ajusteKeyComp = `${escola.id}_${dia}_PF_COMP`
            const { zerado: zeradoComp, feriado: feriadoNomeComp } = produtoZerado(feriadosMap, dataDia, escola.categoria, 'PF_COMP')
            const qtdFinalComp = ajustesMap.has(ajusteKeyComp) ? ajustesMap.get(ajusteKeyComp)! : (zeradoComp ? 0 : qtdComp)
            pf[dia] += qtdFinalComp
          }
        }
      }

      // Lanche
      if (escola.recebe_lanche) {
        const lancheId = (escola.categoria === 'BIFASICA' ? lancheBifasica : lancheRegular)?.id
        if (lancheId) {
          for (const dia of dias) {
            const dataDia = diaDates[dia]
            const distKey = `${lancheId}_${escola.id}_${dia}`
            const qtdBase = lancheDistMap.get(distKey) || 0
            const ajusteKey = `${escola.id}_${dia}_LANCHE`
            const { zerado, feriado: feriadoNome } = produtoZerado(feriadosMap, dataDia, escola.categoria, 'LANCHE')
            lanche[dia] = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zerado ? 0 : qtdBase)
            if (zerado) feriado_lanche[dia] = feriadoNome
          }
        }
      }

      return {
        id: escola.id,
        nome: escola.nome,
        nome_curto: escola.nome_curto,
        rota: escola.rota,
        ordem_rota: escola.ordem_rota ?? 0,  // v9.5.2
        ordem_pcq: (escola as any).ordem_pcq ?? 0,  // v9.6.5
        pf,
        pcq,
        lanche,
        feriado_pf,
        feriado_pcq,
        feriado_lanche,
        total_pf: somaDias(pf),
        total_pcq: somaDias(pcq),
        total_lanche: somaDias(lanche),
      }
    })

    // Group by route
    const rotas: { key: 'JOSE' | 'AROLDO' | 'BUSCA_PROPRIA'; label: string }[] = [
      { key: 'JOSE', label: 'Motorista José' },
      { key: 'AROLDO', label: 'Motorista Aroldo' },
      { key: 'BUSCA_PROPRIA', label: 'Busca Própria' },
    ]

    const romaneios: RomaneioMotorista[] = rotas.map((rota) => {
      // v9.5.2: filtrar e ordenar DEFINITIVAMENTE por ordem_rota → nome_curto
      const escolasDaRota = escolasRomaneio
        .filter((e) => {
          const escola = escolas.find((es) => es.id === e.id)
          return escola?.rota === rota.key
        })
        .sort((a, b) => {
          const oa = a.ordem_rota ?? 0
          const ob = b.ordem_rota ?? 0
          if (oa !== ob) return oa - ob
          return (a.nome_curto || '').localeCompare(b.nome_curto || '')
        })

      const totais_pf = diasVazios()
      const totais_pcq = diasVazios()
      const totais_lanche = diasVazios()

      for (const e of escolasDaRota) {
        for (const dia of dias) {
          totais_pf[dia] += e.pf[dia]
          totais_pcq[dia] += e.pcq[dia]
          totais_lanche[dia] += e.lanche[dia]
        }
      }

      return {
        rota: rota.key,
        rota_label: rota.label,
        escolas: escolasDaRota,
        totais_pf,
        totais_pcq,
        totais_lanche,
        total_pf: somaDias(totais_pf),
        total_pcq: somaDias(totais_pcq),
        total_lanche: somaDias(totais_lanche),
      }
    })

    return NextResponse.json({
      semana,
      ano,
      tipoPao,
      nomePao: cardapioFinal?.nome_pao || 'Pão Francês',
      lancheRegular: lancheRegular?.nome || null,
      lancheBifasica: lancheBifasica?.nome || null,
      romaneios,
    })
  } catch (error) {
    console.error('Erro ao gerar romaneio:', error)
    return NextResponse.json({ error: 'Erro ao gerar romaneio' }, { status: 500 })
  }
}
