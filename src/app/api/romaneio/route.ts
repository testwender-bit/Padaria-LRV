import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { inicioSemana, numeroSemana, anoSemana, dataISO, type DiaSemana, DIAS_SEMANA } from '@/lib/date-utils'
import type { EscolaRomaneio, RomaneioMotorista } from '@/lib/romaneio-utils'
import { diasVazios, diasVaziosStr, somaDias } from '@/lib/romaneio-utils'
import { produtoZerado, type FeriadoData } from '@/lib/feriado-utils'
import { tipoPaoEfetivoEscola, escolaPulaLanche } from '@/lib/producao-utils'  // v9.8.6 / v9.9.0
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
    // v9.6.7: matchExato = true apenas se numero_semana_iso bate com a semana
    let matchExato = !!cardapioFinal && cardapioFinal.numero_semana_iso === semana
    if (!cardapioFinal || !matchExato) {
      const segundaStr = dataISO(inicio)
      const sextaStr = dataISO(addDays(inicio, 4))
      cardapioFinal = await db.cardapioSemestral.findFirst({
        where: {
          data_inicio: { lte: sextaStr },
          data_fim: { gte: segundaStr },
        },
        include: { lanche_regular: true, lanche_bifasica: true },
      })
      matchExato = false
    }

    const tipoPao = cardapioFinal?.tipo_pao || 'PADRAO'
    const lancheRegular = cardapioFinal?.lanche_regular
    const lancheBifasica = cardapioFinal?.lanche_bifasica
    // v9.8.6: modo do lanche da tarde da BIFASICA — necessário para que a
    // bifásica use o tipo correto de PfQuantidade (PADRAO/PROTEINA/SEMPAO)
    // no romaneio, igual à API de produção.
    const lancheBifasicaModo = (cardapioFinal as any)?.lanche_bifasica_modo || 'LANCHE'
    // v9.9.0: modo do lanche da escola INTERIOR marcada como especial
    // (flag interior_especial na escola). Mesma semântica do bifásico.
    const lancheInteriorModo = (cardapioFinal as any)?.lanche_interior_modo || 'LANCHE'

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
      const pf_comp = diasVazios()  // v9.8.4: PF Complemento separado
      const feriado_pf = diasVaziosStr()
      const feriado_pcq = diasVaziosStr()
      const feriado_lanche = diasVaziosStr()

      // v9.8.4: Para creches, o PF Complemento vai agrupado com PCQ na tabela
      // do motorista. Para demais escolas, comportamento antigo (PF + PF_COMP somados).
      // v9.8.5: Bifásicas também têm pf_comp separado (vai agrupado em PCQ), MAS
      // continuam aparecendo na tabela de PF com seu PF regular do café da manhã.
      // v9.9.0: escola INTERIOR marcada como especial também agrupa pf_comp com
      // PCQ (comportamento espelhado da bifásica).
      const isCreche = escola.categoria === 'CRECHE'
      const isBifasica = escola.categoria === 'BIFASICA'
      const isInteriorEspecial = (escola as any).interior_especial === true && !isBifasica
      const temPfCompSeparado = isCreche || isBifasica || isInteriorEspecial

      // PF + PF Complemento (integrado, sem distinção)
      if (escola.recebe_pf) {
        // v9.8.6: usar tipoPaoEfetivoEscola() — respeita lanche_bifasica_modo
        // para que a bifásica use o tipo correto de PfQuantidade (PADRAO/PROTEINA
        // quando está em modo PAO_*, mesmo se tipo_pao da semana for outro).
        // v9.9.0: escola INTERIOR especial segue a mesma lógica com lanche_interior_modo.
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

      // PCQ + PF Complemento
      // v9.8.4: para creches, pf_comp vai SEPARADO (não somado em pf) — vai agrupado
      // na tabela de PCQ do motorista. Para demais escolas, comportamento antigo (somado em pf).
      // v9.8.7: se o PCQ for zerado (por ajuste ou feriado), o PF Complemento também
      // deve ser zerado — não faz sentido o motorista levar "0 + PF 25" (PF Comp sem PCQ).
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

            // PF Complemento
            const campoComp = entry.pfComp as keyof typeof pcqQ
            const qtdComp = pcqQ[campoComp] as number
            const ajusteKeyComp = `${escola.id}_${dia}_PF_COMP`
            const { zerado: zeradoComp, feriado: feriadoNomeComp } = produtoZerado(feriadosMap, dataDia, escola.categoria, 'PF_COMP')
            let qtdFinalComp = ajustesMap.has(ajusteKeyComp) ? ajustesMap.get(ajusteKeyComp)! : (zeradoComp ? 0 : qtdComp)
            // v9.8.7: se o PCQ foi zerado (por ajuste manual ou feriado), o PF
            // Complemento também deve ser zerado. O pf_comp só faz sentido se
            // o PCQ for entregue (são agrupados visualmente como "40 + PF 25").
            if (qtdFinalPcq === 0) {
              qtdFinalComp = 0
            }
            if (temPfCompSeparado) {
              // v9.8.4/v9.8.5: creche OU bifásica — pf_comp vai SEPARADO
              // (para agrupar com PCQ na impressão do motorista)
              pf_comp[dia] = qtdFinalComp
            } else {
              // Demais escolas — comportamento antigo: pf_comp somado em pf
              pf[dia] += qtdFinalComp
            }
          }
        }
      }

      // Lanche
      // v9.9.0: alinhado com /api/producao (v9.8) — bifásica e interior especial
      // só recebem o lanche quando o modo da semana é LANCHE, e usam a
      // distribuição do lancheRegular (o campo lanche_bifasica_id é legado e
      // não é mais usado na distribuição desde a v9.8). Isso elimina a
      // divergência antiga entre produção e romaneio para bifásicas.
      if (escola.recebe_lanche) {
        // v9.8.1/v9.9.0: bifásica e interior especial em modo PAO_*/NENHUM não recebem lanche
        if (!escolaPulaLanche(escola.categoria, (escola as any).interior_especial, lancheBifasicaModo, lancheInteriorModo)) {
          const lancheId = lancheRegular?.id
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
      }

      return {
        id: escola.id,
        nome: escola.nome,
        nome_curto: escola.nome_curto,
        rota: escola.rota,
        ordem_rota: escola.ordem_rota ?? 0,  // v9.5.2
        ordem_pcq: (escola as any).ordem_pcq ?? 0,  // v9.6.5
        categoria: escola.categoria,  // v9.8.5
        pf,
        pcq,
        lanche,
        pf_comp,  // v9.8.4
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
      const totais_pf_comp = diasVazios()  // v9.8.4

      for (const e of escolasDaRota) {
        for (const dia of dias) {
          totais_pf[dia] += e.pf[dia]
          totais_pcq[dia] += e.pcq[dia]
          totais_lanche[dia] += e.lanche[dia]
          totais_pf_comp[dia] += e.pf_comp[dia]  // v9.8.4
        }
      }

      return {
        rota: rota.key,
        rota_label: rota.label,
        escolas: escolasDaRota,
        totais_pf,
        totais_pcq,
        totais_lanche,
        totais_pf_comp,  // v9.8.4
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
      // v9.6.7: obs (aviso da semana) — SÓ se matchExato
      obs: matchExato ? (cardapioFinal?.obs || null) : null,
      romaneios,
    })
  } catch (error) {
    console.error('Erro ao gerar romaneio:', error)
    return NextResponse.json({ error: 'Erro ao gerar romaneio' }, { status: 500 })
  }
}
