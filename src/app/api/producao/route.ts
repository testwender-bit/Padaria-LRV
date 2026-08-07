import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { inicioSemana, numeroSemana, anoSemana, dataISO, DIAS_SEMANA, type DiaSemana } from '@/lib/date-utils'
import { PCQ_PRODUCAO, type ItemProducao, type ProducaoDia, diaSemanaTexto } from '@/lib/producao-utils'
import { produtoZerado, type FeriadoData } from '@/lib/feriado-utils'
import { addDays, format } from 'date-fns'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dataParam = searchParams.get('data')
    if (dataParam && !/^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
      return NextResponse.json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' }, { status: 400 })
    }
    const dataRef = dataParam || dataISO(new Date())
    const refDate = new Date(dataRef + 'T12:00:00')
    const inicio = inicioSemana(refDate)
    const semana = numeroSemana(refDate)
    const ano = anoSemana(refDate)

    // Buscar dados
    const [escolas, feriados, ajustes, cardapio] = await Promise.all([
      db.escola.findMany({
        where: { ativo: true },
        include: { pf_quantidades: true, pcq_quantidades: true },
        // v9.5.7: ordem puramente SEQUENCIAL — sem agrupar por rota.
        orderBy: [{ ordem_rota: 'asc' }, { nome_curto: 'asc' }],
      }),
      db.feriado.findMany(),
      db.ajuste.findMany({ where: { ano, semana } }),
      // BUG FIX 3: Cardápio lookup - first try ISO week, then fall back to date range
      db.cardapioSemestral.findFirst({
        where: { numero_semana_iso: semana },
        include: { lanche_regular: true, lanche_bifasica: true },
      }),
    ])

    // Fallback: try to find cardápio by date range if not found by ISO week
    let cardapioFinal = cardapio
    // v9.6.7: matchExato = true apenas se encontrou por numero_semana_iso.
    // Se caiu no fallback (date range), matchExato = false — nesse caso
    // NÃO retornamos o obs, pois o cardápio pode ser de outra semana.
    let matchExato = !!cardapioFinal
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
      matchExato = false
    }

    // Feriados da semana
    const feriadosMap = new Map<string, FeriadoData[]>()
    for (const f of feriados) {
      const arr = feriadosMap.get(f.data) || []
      arr.push(f)
      feriadosMap.set(f.data, arr)
    }

    // Ajustes map
    const ajustesMap = new Map<string, number>()
    for (const a of ajustes) {
      ajustesMap.set(`${a.escola_id}_${a.dia_semana}_${a.produto}`, a.qtd_final)
    }

    // Cardápio da semana
    const tipoPao = cardapioFinal?.tipo_pao || 'PADRAO'
    const nomePao = cardapioFinal?.nome_pao || 'Pão Francês'
    const lancheRegular = cardapioFinal?.lanche_regular
    const lancheBifasica = cardapioFinal?.lanche_bifasica

    // Buscar distribuição de lanche
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

    // Gerar produção para cada dia da semana
    // Dias: domingo (produção PF para segunda) + segunda a sexta
    const diasProducao: ProducaoDia[] = []

    // Domingo: produção PF para segunda
    const domingo = addDays(inicio, -1) // domingo antes da segunda
    const domingoStr = dataISO(domingo)
    const segundaStr = dataISO(inicio)

    const itensPfDomingo: ItemProducao[] = []
    for (const escola of escolas) {
      if (!escola.recebe_pf) continue
      // v9.5.7: se escola.pao_fixo === true, SEMPRE usa pf_quantidades do tipo PADRAO
      // (ignora o tipo_pao do cardápio da semana). Garante que Outras Instituições
      // como Bombeiros, Ambulância, etc. sempre apareçam na produção de PF.
      const tipoPaoEfetivo = (escola as any).pao_fixo === true ? 'PADRAO' : tipoPao
      const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPaoEfetivo)
        || escola.pf_quantidades.find((q) => q.tipo_pao === 'PADRAO')
      if (!pfQ) continue

      // Check feriado on DELIVERY day (segunda)
      const { zerado, feriado: feriadoNome } = produtoZerado(feriadosMap, segundaStr, escola.categoria, 'PF')
      const qtdBase = pfQ.segunda
      const ajusteKey = `${escola.id}_segunda_PF`
      const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zerado ? 0 : qtdBase)

      itensPfDomingo.push({
        escola_id: escola.id,
        escola_nome: escola.nome,
        escola_curto: escola.nome_curto,
        categoria: escola.categoria,
        rota: escola.rota,
        ordem_rota: escola.ordem_rota ?? 0,  // v9.5.2
        ordem_pcq: (escola as any).ordem_pcq ?? 0,  // v9.6.3
        busca_propria: escola.busca_propria,
        produto: 'PF',
        quantidade: qtd,
        unidade: 'un',
        dia_entrega: 'segunda',
        ajustado: ajustesMap.has(ajusteKey),
        zerado,
        feriado_nome: feriadoNome,
      })
    }

    // v9.5.8: PF COMPLEMENTO para entrega de SEGUNDA — produção no DOMINGO (D-1).
    // O Comp Seg é pão francês complementar (creches), com entrega na segunda,
    // então a produção é no domingo (mesma regra D-1 do PF regular).
    for (const escola of escolas) {
      if (!escola.recebe_pcq) continue
      const pcqQ = escola.pcq_quantidades[0]
      if (!pcqQ) continue
      const qtdComp = pcqQ.pf_comp_segunda as number
      if (qtdComp <= 0) continue

      const ajusteKey = `${escola.id}_segunda_PF_COMP`
      let zeradoComp = false
      let feriadoNomeComp = ''
      // Check feriado no dia de PRODUÇÃO (domingo)
      const checkProdComp = produtoZerado(feriadosMap, domingoStr, escola.categoria, 'PF_COMP')
      if (checkProdComp.zerado) {
        zeradoComp = true
        feriadoNomeComp = checkProdComp.feriado
      }
      // Check feriado no dia de ENTREGA (segunda)
      if (!zeradoComp) {
        const checkEnt = produtoZerado(feriadosMap, segundaStr, escola.categoria, 'PF_COMP')
        if (checkEnt.zerado) {
          zeradoComp = true
          feriadoNomeComp = checkEnt.feriado
        }
      }

      const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zeradoComp ? 0 : qtdComp)

      itensPfDomingo.push({
        escola_id: escola.id,
        escola_nome: escola.nome,
        escola_curto: escola.nome_curto,
        categoria: escola.categoria,
        rota: escola.rota,
        ordem_rota: escola.ordem_rota ?? 0,  // v9.5.2
        ordem_pcq: (escola as any).ordem_pcq ?? 0,  // v9.6.3
        busca_propria: escola.busca_propria,
        produto: 'PF',
        quantidade: qtd,
        unidade: 'un',
        dia_entrega: 'segunda',
        ajustado: ajustesMap.has(ajusteKey),
        zerado: zeradoComp,
        feriado_nome: feriadoNomeComp,
      })
    }

    diasProducao.push({
      data: domingoStr,
      dia_label: 'Domingo',
      dia_curto: 'Dom',
      dia_key: 'domingo',
      itens_pf: itensPfDomingo,
      itens_pcq: [],
      itens_lanche: [],
      total_pf: itensPfDomingo.reduce((s, i) => s + i.quantidade, 0),
      total_pcq: 0,
      total_lanche: 0,
    })

    // Segunda a sexta
    const diaLabels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
    const diaCurtos = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
    const diaKeys: DiaSemana[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
    const diaTextKeys = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

    for (let i = 0; i < 5; i++) {
      const diaDate = addDays(inicio, i)
      const diaStr = dataISO(diaDate)
      const diaKey = diaKeys[i]

      const itensPf: ItemProducao[] = []
      const itensPcq: ItemProducao[] = []
      const itensLanche: ItemProducao[] = []

      // PF: produzido D-1 (hoje produz para amanhã)
      if (i < 4) { // segunda-thursday produzem para terça-sexta
        const diaEntrega = diaKeys[i + 1]
        const dataEntrega = dataISO(addDays(inicio, i + 1))

        for (const escola of escolas) {
          if (!escola.recebe_pf) continue
          // v9.5.7: se escola.pao_fixo === true, SEMPRE usa PADRAO
          const tipoPaoEfetivo = (escola as any).pao_fixo === true ? 'PADRAO' : tipoPao
          const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPaoEfetivo)
            || escola.pf_quantidades.find((q) => q.tipo_pao === 'PADRAO')
          if (!pfQ) continue

          // Check feriado on DELIVERY day
          const { zerado, feriado: feriadoNome } = produtoZerado(feriadosMap, dataEntrega, escola.categoria, 'PF')
          const qtdBase = pfQ[diaEntrega as keyof typeof pfQ] as number
          const ajusteKey = `${escola.id}_${diaEntrega}_PF`
          const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zerado ? 0 : qtdBase)

          itensPf.push({
            escola_id: escola.id,
            escola_nome: escola.nome,
            escola_curto: escola.nome_curto,
            categoria: escola.categoria,
            rota: escola.rota,
            ordem_rota: escola.ordem_rota ?? 0,  // v9.5.2
        ordem_pcq: (escola as any).ordem_pcq ?? 0,  // v9.6.3
            busca_propria: escola.busca_propria,
            produto: 'PF',
            quantidade: qtd,
            unidade: 'un',
            dia_entrega: diaEntrega,
            ajustado: ajustesMap.has(ajusteKey),
            zerado,
            feriado_nome: feriadoNome,
          })
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
            // BUG FIX 7: Check feriado on PRODUCTION day AND on DELIVERY days
            let zeradoPcq = false
            let feriadoNomePcq = ''
            // Check production day
            const checkProd = produtoZerado(feriadosMap, diaStr, escola.categoria, 'PCQ')
            if (checkProd.zerado) {
              zeradoPcq = true
              feriadoNomePcq = checkProd.feriado
            }
            // Also check each delivery day
            if (!zeradoPcq) {
              for (const entregaDia of pcqConfig.entregas) {
                const entregaIdx = diaTextKeys.indexOf(entregaDia)
                if (entregaIdx >= 0) {
                  const dataEntregaPCQ = dataISO(addDays(inicio, entregaIdx))
                  const checkEnt = produtoZerado(feriadosMap, dataEntregaPCQ, escola.categoria, 'PCQ')
                  if (checkEnt.zerado) {
                    zeradoPcq = true
                    feriadoNomePcq = checkEnt.feriado
                    break
                  }
                }
              }
            }

            const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zeradoPcq ? 0 : qtdFormas)

            itensPcq.push({
              escola_id: escola.id,
              escola_nome: escola.nome,
              escola_curto: escola.nome_curto,
              categoria: escola.categoria,
              rota: escola.rota,
              ordem_rota: escola.ordem_rota ?? 0,  // v9.5.2
        ordem_pcq: (escola as any).ordem_pcq ?? 0,  // v9.6.3
              busca_propria: escola.busca_propria,
              produto: 'PCQ',
              quantidade: qtd,
              unidade: 'formas',
              dia_entrega: diaKey,
              ajustado: ajustesMap.has(ajusteKey),
              zerado: zeradoPcq,
              feriado_nome: feriadoNomePcq,
            })
          }

          // v9.5.8: PF Complemento (creches) — é PÃO FRANCÊS, segue regra D-1.
          // Era processado dentro do loop PCQ (seg/qua/sex = dia de entrega),
          // mas o usuário quer que apareça na produção 1 dia ANTES:
          //   Comp Seg (entrega seg) → produção DOMINGO
          //   Comp Qua (entrega qua) → produção TERÇA
          //   Comp Sex (entrega sex) → produção QUINTA
          // Agora é processado em um bloco separado abaixo (fora do if PCQ)
          // para injetar no dia de produção correto.
        }
      }

      // v9.5.8: PF COMPLEMENTO — processado separadamente para respeitar D-1.
      // Para CADA dia de entrega (seg/qua/sex), injeta o PF Complemento no dia
      // de produção correspondente (dom/ter/qui).
      // Mapeia dia de entrega → dia de produção (D-1).
      const pfCompEntregaParaProducao: Record<string, string> = {
        segunda: 'domingo',
        quarta: 'terca',
        sexta: 'quinta',
      }
      const pfCompCampos: Record<string, 'pf_comp_segunda' | 'pf_comp_quarta' | 'pf_comp_sexta'> = {
        segunda: 'pf_comp_segunda',
        quarta: 'pf_comp_quarta',
        sexta: 'pf_comp_sexta',
      }
      // Para cada dia de ENTREGA (seg/qua/sex) que tem PF Complemento configurado:
      for (const entregaDia of ['segunda', 'quarta', 'sexta']) {
        const diaProdKey = pfCompEntregaParaProducao[entregaDia]  // dom/ter/qui
        // Só processa se o dia de produção corrente (i) bate com diaProdKey
        if (diaKey !== diaProdKey) continue
        // Data de entrega para checagem de feriados
        const entregaIdx = diaTextKeys.indexOf(entregaDia)
        const dataEntregaComp = entregaIdx >= 0 ? dataISO(addDays(inicio, entregaIdx)) : diaStr

        for (const escola of escolas) {
          if (!escola.recebe_pcq) continue
          const pcqQ = escola.pcq_quantidades[0]
          if (!pcqQ) continue
          const campoComp = pfCompCampos[entregaDia]
          const qtdComp = pcqQ[campoComp] as number
          if (qtdComp <= 0) continue

          const ajusteKey = `${escola.id}_${entregaDia}_PF_COMP`
          let zeradoComp = false
          let feriadoNomeComp = ''
          // Check feriado no dia de PRODUÇÃO (D-1)
          const checkProdComp = produtoZerado(feriadosMap, diaStr, escola.categoria, 'PF_COMP')
          if (checkProdComp.zerado) {
            zeradoComp = true
            feriadoNomeComp = checkProdComp.feriado
          }
          // Check feriado no dia de ENTREGA
          if (!zeradoComp) {
            const checkEnt = produtoZerado(feriadosMap, dataEntregaComp, escola.categoria, 'PF_COMP')
            if (checkEnt.zerado) {
              zeradoComp = true
              feriadoNomeComp = checkEnt.feriado
            }
          }

          const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zeradoComp ? 0 : qtdComp)

          // PF_COMP vai para itensPf como PF (sem sinalizar complemento)
          // v9.5.8: dia_entrega indica o dia real de entrega (seg/qua/sex),
          // mas o item é injetado no dia de PRODUÇÃO (dom/ter/qui) — que é
          // o dia_key corrente deste loop.
          itensPf.push({
            escola_id: escola.id,
            escola_nome: escola.nome,
            escola_curto: escola.nome_curto,
            categoria: escola.categoria,
            rota: escola.rota,
            ordem_rota: escola.ordem_rota ?? 0,  // v9.5.2
        ordem_pcq: (escola as any).ordem_pcq ?? 0,  // v9.6.3
            busca_propria: escola.busca_propria,
            produto: 'PF',
            quantidade: qtd,
            unidade: 'un',
            dia_entrega: entregaDia,
            ajustado: ajustesMap.has(ajusteKey),
            zerado: zeradoComp,
            feriado_nome: feriadoNomeComp,
          })
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
        const { zerado, feriado: feriadoNome } = produtoZerado(feriadosMap, diaStr, escola.categoria, 'LANCHE')
        const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zerado ? 0 : qtdBase)

        itensLanche.push({
          escola_id: escola.id,
          escola_nome: escola.nome,
          escola_curto: escola.nome_curto,
          categoria: escola.categoria,
          rota: escola.rota,
          ordem_rota: escola.ordem_rota ?? 0,  // v9.5.2
        ordem_pcq: (escola as any).ordem_pcq ?? 0,  // v9.6.3
          busca_propria: escola.busca_propria,
          produto: 'LANCHE',
          quantidade: qtd,
          unidade: lancheRegular?.unidade || 'un',
          dia_entrega: diaKey,
          ajustado: ajustesMap.has(ajusteKey),
          zerado,
          feriado_nome: feriadoNome,
        })
      }

      diasProducao.push({
        data: diaStr,
        dia_label: diaLabels[i],
        dia_curto: diaCurtos[i],
        dia_key: diaTexto,
        itens_pf: itensPf,
        itens_pcq: itensPcq,
        itens_lanche: itensLanche,
        total_pf: itensPf.reduce((s, it) => s + it.quantidade, 0),
        total_pcq: itensPcq.reduce((s, it) => s + it.quantidade, 0),
        total_lanche: itensLanche.reduce((s, it) => s + it.quantidade, 0),
      })
    }

    // v9.5.4: buscar produções extras (instituições avulsas) — usado pela
    // página para injetá-las como ItemProducao nos dias de produção.
    let producaoExtra: any[] = []
    try {
      producaoExtra = await (db as any).producaoExtra.findMany({
        where: { ano, semana },
        orderBy: [{ produto: 'asc' }, { dia_semana: 'asc' }],
      })
    } catch {
      // Model pode não existir ainda no banco — ignora silenciosamente.
      producaoExtra = []
    }

    return NextResponse.json({
      semana,
      ano,
      tipoPao,
      nomePao,
      lancheRegular: lancheRegular?.nome || null,
      lancheBifasica: lancheBifasica?.nome || null,
      // v9.6.7: obs (aviso da semana) — SÓ retorna se matchExato (cardápio
      // encontrado por numero_semana_iso exato). Se caiu no fallback de
      // date range, não retorna obs (pode ser de outra semana).
      obs: matchExato ? (cardapioFinal?.obs || null) : null,
      dias: diasProducao,
      // v9.5.4: produções extras para a página injetar como ItemProducao
      producaoExtra,
    })
  } catch (error) {
    console.error('Erro ao calcular produção:', error)
    return NextResponse.json({ error: 'Erro ao calcular produção' }, { status: 500 })
  }
}
