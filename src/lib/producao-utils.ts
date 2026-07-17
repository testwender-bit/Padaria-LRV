// ============================================================
// LÓGICA DE PRODUÇÃO — calcula o que produzir em cada dia
// ============================================================

import { addDays, format } from 'date-fns'
import type { DiaSemana } from './date-utils'

// Mapeia dia de PRODUÇÃO -> dia de ENTREGA (defasagem D-1)
export const PF_PRODUCAO_PARA_ENTREGA: Record<string, DiaSemana> = {
  domingo: 'segunda',
  segunda: 'terca',
  terca: 'quarta',
  quarta: 'quinta',
  quinta: 'sexta',
}

// Os ciclos do PCQ — PCQ é produzido e entregue no MESMO DIA (sem deslocamento)
export const PCQ_PRODUCAO = {
  segunda: { entregas: ['segunda'] as DiaSemana[], campo: 'prod_segunda', pf_comp: 'pf_comp_segunda' },
  quarta: { entregas: ['quarta'] as DiaSemana[], campo: 'prod_quarta', pf_comp: 'pf_comp_quarta' },
  sexta: { entregas: ['sexta'] as DiaSemana[], campo: 'prod_sexta', pf_comp: 'pf_comp_sexta' },
} as const

// Dia de produção do LANCHE = MESMO DIA de entrega (D-0)
export const LANCHE_PRODUCAO_PARA_ENTREGA: Record<string, DiaSemana> = {
  segunda: 'segunda',
  terca: 'terca',
  quarta: 'quarta',
  quinta: 'quinta',
  sexta: 'sexta',
}

export interface ItemProducao {
  escola_id: string
  escola_nome: string
  escola_curto: string
  categoria: string
  rota: string
  ordem_rota: number  // v9.5: para ordenação correta
  busca_propria: boolean
  produto: 'PF' | 'PCQ' | 'LANCHE' | 'PF_COMP'
  quantidade: number
  unidade: string
  obs?: string
  dia_entrega?: string
  ajustado?: boolean
  zerado?: boolean
  feriado_nome?: string
}

export interface ProducaoDia {
  data: string // YYYY-MM-DD
  dia_label: string // "Domingo", "Segunda"
  dia_curto: string // "Dom", "Seg"
  dia_key: string // "domingo", "segunda"
  itens_pf: ItemProducao[]
  itens_pcq: ItemProducao[]
  itens_lanche: ItemProducao[]
  total_pf: number
  total_pcq: number
  total_lanche: number
}

// Retorna o dia da semana em texto pt-BR
export function diaSemanaTexto(data: Date): string {
  const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
  return dias[data.getDay()]
}

// Calcula data de produção para PF (D-1)
export function calcularDataProducaoPF(dataEntrega: Date): Date {
  return addDays(dataEntrega, -1)
}

// Formata data como ISO YYYY-MM-DD
export function dataISO(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}
