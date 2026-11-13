// ============================================================
// separacao-utils.ts — GUIA DE SEPARAÇÃO DO PÃO FRANCÊS (1 página A4)
// ============================================================
// Problema operacional resolvido:
// Na folha de produção (1ª via), o pão das entregas da manhã e o Pão Complemento
// aparecem juntos na mesma célula ("150 + 10"). Na rotina da padaria, os
// padeiros acabavam embalando tudo junto pela manhã.
//
// Solução compacta em 1 única folha A4 (sem caixinhas de conferência):
//  - BLOCO 1 — MANHÃ: entregas da manhã (embalar pela manhã).
//  - BLOCO 2 — TARDE: apenas Pão Complemento (embalar à tarde / sai com o PCQ).
// Cada bloco usa matriz semanal por dia de ENTREGA (Seg–Sex), mantendo a guia
// inteira legível e em 1 folha só.
//
// Função PURA — sem acesso a banco; recebe o consolidado da página de Produção.

import type { DiaProducao, DiaSemana } from './date-utils'
import { DIAS_PRODUCAO, DIAS_SEMANA } from './date-utils'
import { PF_PRODUCAO_PARA_ENTREGA } from './producao-utils'
import type { EscolaConsolidada } from './producao-semana-utils'

export interface LinhaGuiaMatriz {
  id: string
  nome: string
  nome_curto: string
  ordem_rota: number
  ordem_pcq: number
  busca_propria: boolean
  extra: boolean
  dias: Record<DiaSemana, number>
  total: number
}

export interface BlocoGuiaManha {
  regulares: LinhaGuiaMatriz[]
  extras: LinhaGuiaMatriz[]
  totais_dia: Record<DiaSemana, number>
  total: number
}

export interface BlocoGuiaTarde {
  linhas: LinhaGuiaMatriz[]
  totais_dia: Record<DiaSemana, number>
  total: number
}

export interface GuiaSeparacaoMatriz {
  manha: BlocoGuiaManha
  tarde: BlocoGuiaTarde
  totais_dia_geral: Record<DiaSemana, number>
  total_geral: number
}

function diasSemanaVazios(): Record<DiaSemana, number> {
  return { segunda: 0, terca: 0, quarta: 0, quinta: 0, sexta: 0 }
}

function compararOrdem(
  a: LinhaGuiaMatriz,
  b: LinhaGuiaMatriz,
  campo: 'ordem_rota' | 'ordem_pcq',
): number {
  if (a[campo] !== b[campo]) return a[campo] - b[campo]
  if (a.ordem_rota !== b.ordem_rota) return a.ordem_rota - b.ordem_rota
  return (a.nome_curto || '').localeCompare(b.nome_curto || '')
}

export function formatarDataCurta(iso: string): string {
  const partes = (iso || '').split('-')
  if (partes.length !== 3) return iso || ''
  return `${partes[2]}/${partes[1]}`
}

/**
 * Monta a Guia de Separação em formato matriz semanal por dia de entrega:
 * - Bloco MANHÃ: base normal (pf - pf_comp) por escola/extra
 * - Bloco TARDE: complemento (pf_comp) ordenado pela rota de PCQ
 * Invariante: manha.total + tarde.total === soma(pf) dos dias com entrega.
 */
export function montarGuiaSeparacao(escolas: EscolaConsolidada[]): GuiaSeparacaoMatriz {
  const regularesManha: LinhaGuiaMatriz[] = []
  const extrasManha: LinhaGuiaMatriz[] = []
  const linhasTarde: LinhaGuiaMatriz[] = []

  const totaisManhaDia = diasSemanaVazios()
  const totaisTardeDia = diasSemanaVazios()
  const totaisGeralDia = diasSemanaVazios()

  let totalManha = 0
  let totalTarde = 0

  for (const escola of escolas || []) {
    const ehExtra =
      (escola.rota || '').toUpperCase() === 'OUTROS' ||
      (escola.categoria || '').toUpperCase() === 'EXTRA'

    const diasNormal = diasSemanaVazios()
    const diasComp = diasSemanaVazios()
    let somaNormal = 0
    let somaComp = 0

    for (const diaProd of DIAS_PRODUCAO as DiaProducao[]) {
      const diaEntrega = PF_PRODUCAO_PARA_ENTREGA[diaProd]
      if (!diaEntrega) continue

      const pfDia = escola.pf?.[diaProd] || 0
      if (pfDia <= 0) continue

      const compDia = Math.min(pfDia, Math.max(0, escola.pf_comp?.[diaProd] || 0))
      const normalDia = Math.max(0, pfDia - compDia)

      if (normalDia > 0) {
        diasNormal[diaEntrega] += normalDia
        somaNormal += normalDia
        totaisManhaDia[diaEntrega] += normalDia
        totaisGeralDia[diaEntrega] += normalDia
      }
      if (compDia > 0) {
        diasComp[diaEntrega] += compDia
        somaComp += compDia
        totaisTardeDia[diaEntrega] += compDia
        totaisGeralDia[diaEntrega] += compDia
      }
    }

    if (somaNormal > 0) {
      totalManha += somaNormal
      const linha: LinhaGuiaMatriz = {
        id: escola.id,
        nome: escola.nome,
        nome_curto: escola.nome_curto,
        ordem_rota: escola.ordem_rota ?? 0,
        ordem_pcq: escola.ordem_pcq ?? 0,
        busca_propria: escola.busca_propria === true,
        extra: ehExtra,
        dias: diasNormal,
        total: somaNormal,
      }
      if (ehExtra) extrasManha.push(linha)
      else regularesManha.push(linha)
    }

    if (somaComp > 0) {
      totalTarde += somaComp
      linhasTarde.push({
        id: escola.id,
        nome: escola.nome,
        nome_curto: escola.nome_curto,
        ordem_rota: escola.ordem_rota ?? 0,
        ordem_pcq: escola.ordem_pcq ?? 0,
        busca_propria: escola.busca_propria === true,
        extra: ehExtra,
        dias: diasComp,
        total: somaComp,
      })
    }
  }

  regularesManha.sort((a, b) => compararOrdem(a, b, 'ordem_rota'))
  extrasManha.sort((a, b) => compararOrdem(a, b, 'ordem_rota'))
  linhasTarde.sort((a, b) => compararOrdem(a, b, 'ordem_pcq'))

  // Verifica que DIAS_SEMANA mantém a ordem padrão Seg–Sex
  for (const d of DIAS_SEMANA) {
    totaisGeralDia[d] = (totaisManhaDia[d] || 0) + (totaisTardeDia[d] || 0)
  }

  return {
    manha: {
      regulares: regularesManha,
      extras: extrasManha,
      totais_dia: totaisManhaDia,
      total: totalManha,
    },
    tarde: {
      linhas: linhasTarde,
      totais_dia: totaisTardeDia,
      total: totalTarde,
    },
    totais_dia_geral: totaisGeralDia,
    total_geral: totalManha + totalTarde,
  }
}
