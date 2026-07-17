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
    const [escolas, feriados, ajustes] = await Promise.all([
      db.escola.findMany({
        where: { ativo: true },
        include: { pf_quantidades: true, pcq_quantidades: true },
        orderBy: [{ rota: 'asc' }, { ordem_rota: 'asc' }, { nome_curto: 'asc' }],
      }),
      db.feriado.findMany(),
      db.ajuste.findMany({ where: { ano, semana } }),
    ])

    // v9.4: busca cardápio por ano + semana ISO (match exato)
    const cardapioExato = await db.cardapioSemestral.findFirst({
      where: { ano, numero_semana_iso: semana },
      include: { lanche_regular: true, lanche_bifasica: true },
    })

    // v9.4: controla se o match foi exato (para saber se o obs é desta semana)
    let matchExato = !!cardapioExato

    // Fallback: try to find cardápio by date range if not found by ISO week
    let cardapioFinal = cardapioExato
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
      if (cardapioFinal) matchExato = true // match por data também é exato
    }

    // v9.3: Segundo fallback — busca por semana ISO sem filtrar ano
    if (!cardapioFinal) {
      cardapioFinal = await db.cardapioSemestral.findFirst({
        where: { numero_semana_iso: semana },
        include: { lanche_regular: true, lanche_bifasica: true },
      })
      // match por ISO sem ano NÃO é exato — não deve usar obs
    }

    // v9.3: Se mesmo assim não encontrou, busca o primeiro cardápio do ano
    if (!cardapioFinal) {
      cardapioFinal = await db.cardapioSemestral.findFirst({
        where: { ano },
        orderBy: { semana: 'asc' },
        include: { lanche_regular: true, lanche_bifasica: true },
      })
      // fallback genérico NÃO é exato — não deve usar obs
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
      // v9.5: escolas com pao_fixo sempre usam PADRAO (ignora cardápio da semana)
      const tipoPaoEscola = escola.pao_fixo ? 'PADRAO' : tipoPao
      const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPaoEscola)
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
        ordem_rota: escola.ordem_rota,  // v9.5
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
          // v9.5: escolas com pao_fixo sempre usam PADRAO (ignora cardápio da semana)
          const tipoPaoEscola = escola.pao_fixo ? 'PADRAO' : tipoPao
          const pfQ = escola.pf_quantidades.find((q) => q.tipo_pao === tipoPaoEscola)
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
            ordem_rota: escola.ordem_rota,  // v9.5
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
              ordem_rota: escola.ordem_rota,  // v9.5
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

          // PF Complemento (creches) — integrado ao PF, sem distinção
          const campoComp = pcqConfig.pf_comp as keyof typeof pcqQ
          const qtdComp = pcqQ[campoComp] as number

          if (qtdComp > 0) {
            const ajusteKey = `${escola.id}_${diaKey}_PF_COMP`
            let zeradoComp = false
            let feriadoNomeComp = ''
            const checkProdComp = produtoZerado(feriadosMap, diaStr, escola.categoria, 'PF_COMP')
            if (checkProdComp.zerado) {
              zeradoComp = true
              feriadoNomeComp = checkProdComp.feriado
            }
            if (!zeradoComp) {
              for (const entregaDia of pcqConfig.entregas) {
                const entregaIdx = diaTextKeys.indexOf(entregaDia)
                if (entregaIdx >= 0) {
                  const dataEntregaComp = dataISO(addDays(inicio, entregaIdx))
                  const checkEnt = produtoZerado(feriadosMap, dataEntregaComp, escola.categoria, 'PF_COMP')
                  if (checkEnt.zerado) {
                    zeradoComp = true
                    feriadoNomeComp = checkEnt.feriado
                    break
                  }
                }
              }
            }

            const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zeradoComp ? 0 : qtdComp)

            // PF_COMP vai para itensPf como PF (sem sinalizar complemento)
            itensPf.push({
              escola_id: escola.id,
              escola_nome: escola.nome,
              escola_curto: escola.nome_curto,
              categoria: escola.categoria,
              rota: escola.rota,
              busca_propria: escola.busca_propria,
              produto: 'PF',
              quantidade: qtd,
              unidade: 'un',
              dia_entrega: diaKey,
              ajustado: ajustesMap.has(ajusteKey),
              zerado: zeradoComp,
              feriado_nome: feriadoNomeComp,
            })
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
        const { zerado, feriado: feriadoNome } = produtoZerado(feriadosMap, diaStr, escola.categoria, 'LANCHE')
        const qtd = ajustesMap.has(ajusteKey) ? ajustesMap.get(ajusteKey)! : (zerado ? 0 : qtdBase)

        itensLanche.push({
          escola_id: escola.id,
          escola_nome: escola.nome,
          escola_curto: escola.nome_curto,
          categoria: escola.categoria,
          rota: escola.rota,
          ordem_rota: escola.ordem_rota,  // v9.5
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

    // v9.5: buscar produções extras (instituições avulsas)
    const producaoExtra = await db.producaoExtra.findMany({
      where: { ano, semana },
      orderBy: [{ produto: 'asc' }, { dia_semana: 'asc' }],
    })

    return NextResponse.json({
      semana,
      ano,
      tipoPao,
      nomePao,
      lancheRegular: lancheRegular?.nome || null,
      lancheBifasica: lancheBifasica?.nome || null,
      // v9.4: só retorna obs se o match foi exato (não fallback genérico)
      obs: matchExato ? (cardapioFinal?.obs || null) : null,
      dias: diasProducao,
      // v9.5: produções extras
      producaoExtra,
    })
  } catch (error) {
    console.error('Erro ao calcular produção:', error)
    return NextResponse.json({ error: 'Erro ao calcular produção' }, { status: 500 })
  }
}
