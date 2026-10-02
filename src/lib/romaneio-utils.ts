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
  // v9.8.5: categoria da escola (REGULAR, INTEGRAL, BIFASICA, CRECHE, etc).
  // Usado para diferenciar creches (PF só agrupado em PCQ) de bifásicas
  // (PF regular na tabela PF + PF Complemento agrupado em PCQ).
  categoria?: string
  // v9.10.6: só preenchido em pseudo-escolas do Inst. Extra com produto LANCHE
  // cujo lanche escolhido é DIFERENTE do lanche da semana — o nome da preparação
  // é exibido ao lado da instituição no romaneio (o motorista precisa saber o
  // que está levando). Nulo/vazio = sem anotação.
  extra_lanche?: string | null
  pf: Record<DiaSemana, number>
  pcq: Record<DiaSemana, number>
  lanche: Record<DiaSemana, number>
  // v9.8.4: PF Complemento (pf_comp_segunda/quarta/sexta) separado do PF regular.
  // Usado para agrupar com PCQ na tabela de PCQ do motorista — só creches e bifásicas.
  pf_comp: Record<DiaSemana, number>
  feriado_pf: Record<DiaSemana, string>
  feriado_pcq: Record<DiaSemana, string>
  feriado_lanche: Record<DiaSemana, string>
  total_pf: number
  total_pcq: number
  total_lanche: number
}

// v9.10.7: lanche extra FORA da semana (produto LANCHE com preparação diferente
// do lanche regular/bifásico) — sai da tabela do lanche da semana e aparece
// "separadinho" num bloco próprio "PREPARAÇÃO EXTRA — <lanche>" na MESMA folha
// do motorista (mesmo padrão da folha de produção de Lanches da v9.10.6),
// FORA dos totais do lanche da semana.
export interface ExtraLancheFora {
  id: string
  nome: string
  nome_curto: string
  dia_semana: DiaSemana
  quantidade: number
  lanche_nome: string
}

export interface RomaneioMotorista {
  rota: 'JOSE' | 'AROLDO' | 'BUSCA_PROPRIA'
  rota_label: string
  escolas: EscolaRomaneio[]
  totais_pf: Record<DiaSemana, number>
  totais_pcq: Record<DiaSemana, number>
  totais_lanche: Record<DiaSemana, number>
  // v9.8.4: totais de PF Complemento (só creches) por dia
  totais_pf_comp: Record<DiaSemana, number>
  total_pf: number
  total_pcq: number
  total_lanche: number
  // v9.10.7: instituições com lanche FORA da semana da rota (opcional — API
  // /api/romaneio sempre envia; telas usam `|| []` por segurança)
  extras_lanche_fora?: ExtraLancheFora[]
}

// v9.10.7: DIAS também usado por agruparExtrasLancheFora (ordenação por dia)
const DIAS: DiaSemana[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

// v9.10.7: agrupa os extras de lanche FORA da semana por preparação (case-
// insensitive) para os blocos "PREPARAÇÃO EXTRA" da folha de lanches do
// motorista — mesmo padrão dos blocos da P4 de produção (v9.10.6): grupos
// ordenados por nome, extras dentro do grupo ordenados por dia da semana.
export function agruparExtrasLancheFora(
  rom: Pick<RomaneioMotorista, 'extras_lanche_fora'>
): Array<{ lanche: string; extras: ExtraLancheFora[] }> {
  const grupos: Array<{ lanche: string; extras: ExtraLancheFora[] }> = []
  for (const x of rom.extras_lanche_fora || []) {
    const nome = (x.lanche_nome || '').trim()
    let g = grupos.find((gg) => gg.lanche.toLowerCase() === nome.toLowerCase())
    if (!g) { g = { lanche: nome, extras: [] }; grupos.push(g) }
    g.extras.push(x)
  }
  grupos.sort((a, b) => a.lanche.localeCompare(b.lanche))
  grupos.forEach((g) =>
    g.extras.sort((a, b) => DIAS.indexOf(a.dia_semana) - DIAS.indexOf(b.dia_semana)))
  return grupos
}

export function diasVazios(): Record<DiaSemana, number> {
  return { segunda: 0, terca: 0, quarta: 0, quinta: 0, sexta: 0 }
}

export function diasVaziosStr(): Record<DiaSemana, string> {
  return { segunda: '', terca: '', quarta: '', quinta: '', sexta: '' }
}

export function somaDias(d: Record<DiaSemana, number>): number {
  return DIAS.reduce((s, k) => s + (d[k] || 0), 0)
}
