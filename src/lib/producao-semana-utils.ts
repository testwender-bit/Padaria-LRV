// ============================================================
// PRODUÇÃO SEMANA — Visão consolidada (por dia de PRODUÇÃO)
// ============================================================

import type { ItemProducao, ProducaoDia } from './producao-utils'
import { arredondarFormas } from './producao-utils'
import type { DiaProducao } from './date-utils'
import { DIAS_PRODUCAO } from './date-utils'

export interface EscolaConsolidada {
  id: string
  nome: string
  nome_curto: string
  rota: string
  // v9.10.5: categoria propagada do item (escola real: REGULAR/CRECHE/...;
  // instituição avulsa do Inst. Extra: 'EXTRA') — usada pela impressão para
  // inserir o separador "Produção Extra" antes das instituições avulsas.
  categoria?: string
  ordem: number
  ordem_rota: number  // v9.5: para ordenação correta (PF)
  ordem_pcq: number  // v9.6.3: ordenação ESPECÍFICA para PCQ
  // v9.9.1: unidade Busca Própria — usada na legenda discreta do PCQ
  // "(N) = pães" (1 forma = 60 pães) na tela e na impressão da produção.
  busca_propria: boolean
  pf: Record<DiaProducao, number>
  pcq: Record<DiaProducao, number>
  lanche: Record<DiaProducao, number>
  total_pf: number
  total_pcq: number
  total_lanche: number
}

export interface ProducaoConsolidada {
  escolas: EscolaConsolidada[]
  totais_por_dia: {
    pf: Record<DiaProducao, number>
    pcq: Record<DiaProducao, number>
    lanche: Record<DiaProducao, number>
  }
  total_pf: number
  total_pcq: number
  total_lanche: number
}

function diasVazios(): Record<DiaProducao, number> {
  return { domingo: 0, segunda: 0, terca: 0, quarta: 0, quinta: 0, sexta: 0 }
}

export function consolidarProducaoSemana(
  producao: ProducaoDia[],
  ordensEscola?: Map<string, number>
): ProducaoConsolidada {
  const empty: ProducaoConsolidada = {
    escolas: [],
    totais_por_dia: { pf: diasVazios(), pcq: diasVazios(), lanche: diasVazios() },
    total_pf: 0, total_pcq: 0, total_lanche: 0,
  }

  if (!Array.isArray(producao) || producao.length === 0) return empty

  const mapa = new Map<string, EscolaConsolidada>()

  function obterOuCriar(item: ItemProducao): EscolaConsolidada {
    let e = mapa.get(item.escola_id)
    if (!e) {
      e = {
        id: item.escola_id,
        nome: item.escola_nome,
        nome_curto: item.escola_curto,
        rota: item.rota,
        categoria: item.categoria,  // v9.10.5: propaga categoria do item
        ordem: ordensEscola?.get(item.escola_id) ?? 999,
        // v9.5.2: ordem_rota agora é campo obrigatório em ItemProducao.
        // Fallback 0 só para segurança (não deve acontecer).
        ordem_rota: typeof item.ordem_rota === 'number' ? item.ordem_rota : 0,
        // v9.6.3: ordem_pcq — ordenação específica para PCQ
        ordem_pcq: typeof (item as any).ordem_pcq === 'number' ? (item as any).ordem_pcq : 0,
        // v9.9.1: propaga o flag Busca Própria do item (qualquer produto serve —
        // o flag vem da escola, não do produto)
        busca_propria: item.busca_propria === true,
        pf: diasVazios(),
        pcq: diasVazios(),
        lanche: diasVazios(),
        total_pf: 0,
        total_pcq: 0,
        total_lanche: 0,
      }
      mapa.set(item.escola_id, e)
    }
    return e
  }

  // Processar todos os itens de todos os dias de produção,
  // agrupando pelo dia de PRODUÇÃO (não pelo dia de entrega)
  producao.forEach((diaP) => {
    const diaProd = diaP.dia_key as DiaProducao
    if (!DIAS_PRODUCAO.includes(diaProd)) return

    const allItems = [
      ...(Array.isArray(diaP?.itens_pf) ? diaP.itens_pf : []),
      ...(Array.isArray(diaP?.itens_pcq) ? diaP.itens_pcq : []),
      ...(Array.isArray(diaP?.itens_lanche) ? diaP.itens_lanche : []),
    ]

    allItems.forEach((item) => {
      const e = obterOuCriar(item)

      // PF_COMP é integrado ao PF (sem distinção)
      if (item.produto === 'PF' || item.produto === 'PF_COMP') {
        e.pf[diaProd] += item.quantidade
        e.total_pf += item.quantidade
      } else if (item.produto === 'PCQ') {
        e.pcq[diaProd] += item.quantidade
        e.total_pcq += item.quantidade
      } else if (item.produto === 'LANCHE') {
        e.lanche[diaProd] += item.quantidade
        e.total_lanche += item.quantidade
      }
    })
  })

  // v9.9.2: Normaliza resíduos de ponto flutuante por escola ANTES de somar os
  // totais do dia. Quantidades fracionárias de PCQ (0.1, 0.2, 0.5 formas —
  // conversão 1 forma = 50 pães das unidades Busca Própria) acumuladas com
  // " += " produzem valores como 0.30000000000000004, que vazavam para a
  // linha "Total PCQ" da tela Semanal e da impressão ("50.20000000000001").
  mapa.forEach((e) => {
    DIAS_PRODUCAO.forEach((d) => {
      e.pf[d] = arredondarFormas(e.pf[d])
      e.pcq[d] = arredondarFormas(e.pcq[d])
      e.lanche[d] = arredondarFormas(e.lanche[d])
    })
    e.total_pf = arredondarFormas(e.total_pf)
    e.total_pcq = arredondarFormas(e.total_pcq)
    e.total_lanche = arredondarFormas(e.total_lanche)
  })

  const totais_por_dia = {
    pf: diasVazios(),
    pcq: diasVazios(),
    lanche: diasVazios(),
  }

  let total_pf = 0, total_pcq = 0, total_lanche = 0

  Array.from(mapa.values()).forEach((e) => {
    DIAS_PRODUCAO.forEach((d) => {
      totais_por_dia.pf[d] += e.pf[d]
      totais_por_dia.pcq[d] += e.pcq[d]
      totais_por_dia.lanche[d] += e.lanche[d]
    })
    total_pf += e.total_pf
    total_pcq += e.total_pcq
    total_lanche += e.total_lanche
  })

  // v9.9.2: totais do dia e da semana também normalizados — mesmo somando
  // valores já limpos, a acumulação binária pode reintroduzir resíduo.
  DIAS_PRODUCAO.forEach((d) => {
    totais_por_dia.pf[d] = arredondarFormas(totais_por_dia.pf[d])
    totais_por_dia.pcq[d] = arredondarFormas(totais_por_dia.pcq[d])
    totais_por_dia.lanche[d] = arredondarFormas(totais_por_dia.lanche[d])
  })

  // v9.5.4: ordenação puramente SEQUENCIAL por ordem_rota → nome_curto.
  // NÃO agrupa por rota — o usuário quer 1, 2, 3, 4... independente do
  // motorista. Romaneio continua agrupado por rota (lógica própria).
  const escolas = Array.from(mapa.values()).sort((a, b) => {
    if ((a.ordem_rota ?? 0) !== (b.ordem_rota ?? 0)) return (a.ordem_rota ?? 0) - (b.ordem_rota ?? 0)
    return (a.nome_curto || '').localeCompare(b.nome_curto || '')
  })

  return {
    escolas,
    totais_por_dia,
    total_pf: arredondarFormas(total_pf),
    total_pcq: arredondarFormas(total_pcq),
    total_lanche: arredondarFormas(total_lanche),
  }
}
