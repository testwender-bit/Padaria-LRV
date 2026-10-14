import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { inicioSemana, numeroSemana, anoSemana, dataISO, type DiaSemana, DIAS_SEMANA } from '@/lib/date-utils'
import type { EscolaRomaneio, RomaneioMotorista, ExtraLancheFora } from '@/lib/romaneio-utils'
import { diasVazios, diasVaziosStr, somaDias } from '@/lib/romaneio-utils'
import { produtoZerado, type FeriadoData } from '@/lib/feriado-utils'
import { tipoPaoEfetivoEscola, escolaPulaLanche } from '@/lib/producao-utils'  // v9.8.6 / v9.9.0
import { addDays } from 'date-fns'

// v9.10.5: produção extra (instituições avulsas) — registro lido da tabela
// ProducaoExtra e injetado como pseudo-escola no romaneio do motorista escolhido
// no cadastro (campo motorista: 'JOSE' | 'AROLDO' | 'BUSCA_PROPRIA').
// v9.10.6: extra_lanche = nome do lanche escolhido quando DIFERENTE do lanche
// da semana (anotado ao lado da instituição na tabela de lanches do motorista).
type EscolaRomaneioExtra = EscolaRomaneio & { motorista?: string | null }

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

      // v9.8.4: PF Complemento com histórico de restrição por categoria —
      //   v9.8.4/5: só creche/bifásica; v9.9.0: + interior especial; resto somava em PF.
      // v9.10.9: o complemento agora vai SEPARADO (agrupado com PCQ na tabela do
      // motorista, formato "X + PF YY") para QUALQUER unidade que tenha PCQ +
      // complemento cadastrados (pf_comp_segunda/quarta/sexta > 0) — não importa
      // a categoria. Escolas sem complemento configurado não mudam nada (pf_comp
      // fica 0 e o comportamento é idêntico ao de antes).

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
      // v9.8.4: pf_comp vai SEPARADO (não somado em pf) — agrupado na tabela de
      // PCQ do motorista. v9.10.9: para TODAS as escolas (antes só creche/
      // bifásica/interior especial; as demais somavam o complemento no PF).
      // v9.8.7: se o PCQ for zerado (por ajuste ou feriado), o PF Complemento também
      // deve ser zerado — não faz sentido o motorista levar "0 + PF 25" (PF Comp sem PCQ).
      if (escola.recebe_pcq && escola.pcq_quantidades[0]) {
        const pcqQ = escola.pcq_quantidades[0]
        for (const dia of dias) {
          const dataDia = diaDates[dia]
          const entries = pcqEntregaMap[dia]
          // v9.10.4: ter/qui não têm PCQ padrão (entries vazio), mas podem ter
          // ajuste manual de produção excepcional (criado na view Semanal da
          // produção). PCQ é D-0 (produção = entrega), então o romaneio reflete
          // a entrega no mesmo dia — alinhado com /api/producao.
          if (entries.length === 0) {
            const ajusteKeyEx = `${escola.id}_${dia}_PCQ`
            if (ajustesMap.has(ajusteKeyEx)) {
              pcq[dia] += ajustesMap.get(ajusteKeyEx)!
            }
            continue
          }
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
            // v9.8.4: pf_comp SEPARADO — v9.10.9: para TODAS as escolas com
            // complemento cadastrado (agrupa com PCQ como "X + PF YY" na folha
            // do motorista; escolas sem complemento seguem com pf_comp 0)
            pf_comp[dia] = qtdFinalComp
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

    // v9.10.5: produções extras da semana (instituições avulsas cadastradas no
    // botão "Inst. Extra" da Produção). Antes elas apareciam SOMENTE nas páginas
    // de produção (injeção client-side em diasComExtra) e NUNCA no romaneio do
    // motorista. Agora cada extra com motorista definido vira uma pseudo-escola
    // (categoria 'EXTRA') dentro do romaneio da rota escolhida, aparecendo no
    // lugar certo conforme o produto (PF na tabela de PF, PCQ na de PCQ, Lanche
    // na de lanche) e no dia de entrega correspondente.
    // Regras:
    //  - PF: dia_semana do extra é o dia de ENTREGA (a produção é D-1 — mesma
    //    semântica do cadastro; as páginas de produção já fazem a inversão).
    //    PCQ/Lanche: produção = entrega (D-0), mesmo dia.
    //  - Extras NÃO são afetados por feriado/ajuste — são cadastros manuais
    //    pontuais, exatamente como já se comportam nas páginas de produção.
    //  - Extras SEM motorista (registros anteriores à v9.10.5) continuam
    //    aparecendo na produção, mas NÃO entram no romaneio até serem
    //    recadastrados com o motorista.
    let extrasSemana: any[] = []
    try {
      extrasSemana = await (db as any).producaoExtra.findMany({
        where: { ano, semana },
        orderBy: [{ produto: 'asc' }, { dia_semana: 'asc' }],
      })
    } catch {
      // Coluna motorista pode não existir ainda (db push pendente) — ignora
      // silenciosamente para não derrubar o romaneio.
      extrasSemana = []
    }

    const extrasRomaneio: EscolaRomaneioExtra[] = []
    // v9.10.7: lanches extras FORA da semana — vão num campo próprio por rota
    // (extras_lanche_fora) para o bloco "PREPARAÇÃO EXTRA" da folha do motorista
    // e são EXCLUÍDOS dos totais do lanche da semana (mesma regra da folha de
    // produção de Lanches da v9.10.6: não mistura preparações diferentes).
    const extrasLancheFora: Array<ExtraLancheFora & { motorista: string }> = []
    for (const extra of extrasSemana) {
      if (!extra.motorista || !DIAS_SEMANA.includes(extra.dia_semana as DiaSemana)) continue
      if (!(extra.quantidade > 0)) continue
      const diaEntrega = extra.dia_semana as DiaSemana
      const pf = diasVazios()
      const pcq = diasVazios()
      const lanche = diasVazios()
      if (extra.produto === 'PF') {
        pf[diaEntrega] = extra.quantidade
      } else if (extra.produto === 'PCQ') {
        pcq[diaEntrega] = extra.quantidade
      } else if (extra.produto === 'LANCHE') {
        lanche[diaEntrega] = extra.quantidade
      } else {
        continue
      }
      // v9.10.6: lanche específico escolhido no cadastro. Se for DIFERENTE do
      // lanche da semana (regular/bifásico), o romaneio anota o nome da
      // preparação ao lado da instituição — o motorista precisa saber o que
      // está levando. Lanche igual ao da semana (ou registro antigo sem nome)
      // = sem anotação, comportamento normal.
      let extraLanche: string | null = null
      if (extra.produto === 'LANCHE' && typeof extra.lanche_nome === 'string' && extra.lanche_nome.trim()) {
        const nomeEscolhido = extra.lanche_nome.trim().toLowerCase()
        const lanchesDaSemana = [lancheRegular?.nome, lancheBifasica?.nome]
          .filter((n): n is string => !!n && !!n.trim())
          .map((n) => n.trim().toLowerCase())
        if (!lanchesDaSemana.includes(nomeEscolhido)) {
          extraLanche = extra.lanche_nome.trim()
        }
      }
      extrasRomaneio.push({
        id: `extra_${extra.id}`,
        nome: extra.nome_instituicao,
        nome_curto: extra.nome_instituicao.length > 25
          ? extra.nome_instituicao.substring(0, 25)
          : extra.nome_instituicao,
        rota: extra.motorista,
        ordem_rota: 9999,  // sempre por último dentro da rota (padrão v9.5.2)
        ordem_pcq: 9999,   // padrão v9.6.3/v9.6.5
        categoria: 'EXTRA',
        pf,
        pcq,
        lanche,
        pf_comp: diasVazios(),
        feriado_pf: diasVaziosStr(),
        feriado_pcq: diasVaziosStr(),
        feriado_lanche: diasVaziosStr(),
        total_pf: somaDias(pf),
        total_pcq: somaDias(pcq),
        total_lanche: somaDias(lanche),
        extra_lanche: extraLanche,  // v9.10.6: anotação do lanche fora da semana
        motorista: extra.motorista,
      })
      // v9.10.7: lanche FORA da semana → folha do motorista mostra "separadinho"
      // (bloco próprio FORA dos totais do lanche da semana). Continua também na
      // lista de escolas acima (com extra_lanche) para as telas contabilizarem.
      if (extra.produto === 'LANCHE' && extraLanche) {
        extrasLancheFora.push({
          id: `extra_${extra.id}`,
          nome: extra.nome_instituicao,
          nome_curto: extra.nome_instituicao.length > 25
            ? extra.nome_instituicao.substring(0, 25)
            : extra.nome_instituicao,
          dia_semana: diaEntrega,
          quantidade: extra.quantidade,
          lanche_nome: extraLanche,
          motorista: extra.motorista,
        })
      }
    }

    const romaneios: RomaneioMotorista[] = rotas.map((rota) => {
      // v9.5.2: filtrar e ordenar DEFINITIVAMENTE por ordem_rota → nome_curto
      // v9.10.5: extras da rota entram APÓS as escolas (ordem_rota 9999 garante
      // que fiquem no fim mesmo se algum dia mudarem de posição no array).
      const extrasDaRota = extrasRomaneio.filter((x) => x.motorista === rota.key)
      const escolasDaRota: EscolaRomaneio[] = [
        ...escolasRomaneio
          .filter((e) => {
            const escola = escolas.find((es) => es.id === e.id)
            return escola?.rota === rota.key
          })
          .sort((a, b) => {
            const oa = a.ordem_rota ?? 0
            const ob = b.ordem_rota ?? 0
            if (oa !== ob) return oa - ob
            return (a.nome_curto || '').localeCompare(b.nome_curto || '')
          }),
        ...extrasDaRota,
      ]

      const totais_pf = diasVazios()
      const totais_pcq = diasVazios()
      const totais_lanche = diasVazios()
      const totais_pf_comp = diasVazios()  // v9.8.4

      for (const e of escolasDaRota) {
        for (const dia of dias) {
          totais_pf[dia] += e.pf[dia]
          totais_pcq[dia] += e.pcq[dia]
          // v9.10.7: lanche FORA da semana (extra_lanche) não soma no total do
          // lanche da semana — aparece separadinho em extras_lanche_fora (a
          // pseudo-escola extra só tem quantidade no lanche, pf/pcq zerados)
          if (!e.extra_lanche) totais_lanche[dia] += e.lanche[dia]
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
        // v9.10.7: lanches extras fora da semana da rota (bloco separadinho na
        // folha do motorista, fora dos totais do lanche da semana)
        extras_lanche_fora: extrasLancheFora
          .filter((x) => x.motorista === rota.key)
          .map((x) => ({
            id: x.id,
            nome: x.nome,
            nome_curto: x.nome_curto,
            dia_semana: x.dia_semana,
            quantidade: x.quantidade,
            lanche_nome: x.lanche_nome,
          })),
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
