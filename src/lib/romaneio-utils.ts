// ============================================================
// ROMANEIO — calcula a tabela cruzada de entregas por motorista
// ============================================================

import type { DiaSemana } from './date-utils'

export interface EscolaRomaneio {
  id: string
  nome: string
  nome_curto: string
  rota?: string
  ordem_rota?: number  // v9.5.2: para ordenação dentro da rota (PF)
  ordem_pcq?: number   // v9.6.5: ordenação específica para PCQ no romaneio
  pf: Record<DiaSemana, number>
  pcq: Record<DiaSemana, number>
  lanche: Record<DiaSemana, number>
  feriado_pf: Record<DiaSemana, string>
  feriado_pcq: Record<DiaSemana, string>
  feriado_lanche: Record<DiaSemana, string>
  total_pf: number
  total_pcq: number
  total_lanche: number
}

export interface RomaneioMotorista {
  rota: 'JOSE' | 'AROLDO' | 'BUSCA_PROPRIA'
  rota_label: string
  escolas: EscolaRomaneio[]
  totais_pf: Record<DiaSemana, number>
  totais_pcq: Record<DiaSemana, number>
  totais_lanche: Record<DiaSemana, number>
  total_pf: number
  total_pcq: number
  total_lanche: number
}

const DIAS: DiaSemana[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

export function diasVazios(): Record<DiaSemana, number> {
  return { segunda: 0, terca: 0, quarta: 0, quinta: 0, sexta: 0 }
}

export function diasVaziosStr(): Record<DiaSemana, string> {
  return { segunda: '', terca: '', quarta: '', quinta: '', sexta: '' }
}

export function somaDias(d: Record<DiaSemana, number>): number {
  return DIAS.reduce((s, k) => s + (d[k] || 0), 0)
}
