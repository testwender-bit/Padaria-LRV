// ============================================================
// separacao-utils.ts — GUIA DE SEPARAÇÃO do Pão Francês (v9.10.14)
// ============================================================
// Problema prático relatado pela produção: na hora de despachar, os padeiros
// misturavam o PÃO FRANCÊS COMUM (que sai nas entregas da MANHÃ) com o PÃO
// COMPLEMENTO (que sai à TARDE, junto com a entrega do PCQ). Na folha de
// produção o complemento aparece como "150 + 10" — mas na correria tudo
// acabava indo junto na caixa da manhã.
//
// A 2ª via da folha de Pão Francês virou então uma GUIA DE SEPARAÇÃO:
// por dia de entrega, dois blocos — MANHÃ (pão comum) e TARDE (complemento) —
// com escola, quantidade e um quadrinho para marcar cada linha conferida.
//
// Fonte dos dados: o MESMO consolidador da folha de produção
// (EscolaConsolidada). pf[dia] é o total do dia e pf_comp[dia] é o pedaço que
// é complemento (subconjunto, v9.10.10) — base = pf − pf_comp.
// O dia de entrega vem do deslocamento D-1 já consolidado no sistema
// (PF_PRODUCAO_PARA_ENTREGA: dom→seg, ter→qua, qui→sex).
//
// Função PURA — sem acesso a dados; a página de produção injeta as escolas
// consolidadas e as datas de entrega da semana.

import type { DiaProducao, DiaSemana } from './date-utils'
import { DIAS_PRODUCAO, DIAS_SEMANA } from './date-utils'
import { PF_PRODUCAO_PARA_ENTREGA } from './producao-utils'
import type { EscolaConsolidada } from './producao-semana-utils'

// Uma linha da guia = uma escola a separar num período do dia
export interface LinhaSeparacao {
  id: string
  nome_curto: string
  nome: string
  ordem_rota: number
  ordem_pcq: number
  // v9.9.1: unidade que RETIRA na padaria (não vai em van) — marcada na guia
  busca_propria: boolean
  // Instituição do Inst. Extra (rota OUTROS): pão também é separado de manhã,
  // mas com o rótulo "extra" para não confundir com as escolas da van
  extra: boolean
  quantidade: number
}

export interface BlocoSeparacao {
  linhas: LinhaSeparacao[]
  total: number
}

export interface DiaSeparacao {
  dia_entrega: DiaSemana
  // dia de produção que abastece esta entrega (o "pão produzido na ...")
  dia_producao: DiaProducao
  // data da entrega em ISO (veio de datasEntrega da página)
  data: string
  // MANHÃ: pão francês comum (base) — entregas regulares da manhã
  manha: BlocoSeparacao
  // TARDE: pão complemento — sai junto com a entrega do PCQ
  tarde: BlocoSeparacao
  total_dia: number
}

// Rótulo do dia de produção, na linguagem da padaria ("Seg Madrugada" do
// consolidador v9.7.3 = pão produzido na madrugada da segunda)
const DIA_PRODUZIDO_LABEL: Record<DiaProducao, string> = {
  domingo: 'na madrugada de segunda',
  segunda: 'na segunda',
  terca: 'na terça',
  quarta: 'na quarta',
  quinta: 'na quinta',
  sexta: 'na sexta',
}

export function diaProduzidoLabel(dia: DiaProducao): string {
  return DIA_PRODUZIDO_LABEL[dia]
}

// 'YYYY-MM-DD' → 'DD/MM' (datasEntrega da página é dataISO)
export function formatarDataCurta(iso: string): string {
  const partes = (iso || '').split('-')
  if (partes.length !== 3) return iso || ''
  return `${partes[2]}/${partes[1]}`
}

function compararPorOrdem(
  a: LinhaSeparacao,
  b: LinhaSeparacao,
  campo: 'ordem_rota' | 'ordem_pcq',
): number {
  if (a[campo] !== b[campo]) return a[campo] - b[campo]
  return (a.nome_curto || '').localeCompare(b.nome_curto || '')
}

/**
 * Monta a guia por DIA DE ENTREGA (seg–sex), só com dias que têm pão.
 * - base = pf[diaProd] − pf_comp[diaProd] → bloco MANHÃ
 * - pf_comp[diaProd]                     → bloco TARDE
 * Linhas com quantidade 0 (feriado/ajuste zerando) NÃO aparecem — a guia é
 * lista de separação, não tabela de conferência.
 */
export function montarGuiaSeparacao(
  escolas: EscolaConsolidada[],
  datasEntrega: Record<DiaSemana, string>,
): DiaSeparacao[] {
  // acumuladores por dia de entrega
  const manhaPorDia = new Map<DiaSemana, LinhaSeparacao[]>()
  const tardePorDia = new Map<DiaSemana, LinhaSeparacao[]>()
  const producaoPorDia = new Map<DiaSemana, DiaProducao>()

  for (const escola of escolas || []) {
    const ehExtra = (escola.rota || '').toUpperCase() === 'OUTROS'
    for (const diaProd of DIAS_PRODUCAO) {
      const diaEntrega = PF_PRODUCAO_PARA_ENTREGA[diaProd]
      if (!diaEntrega) continue // sexta não tem entrega D+1 (PF não é produzido na sexta)
      const totalDia = escola.pf?.[diaProd] || 0
      if (totalDia <= 0) continue
      const comp = escola.pf_comp?.[diaProd] || 0
      const base = totalDia - comp
      if (base <= 0 && comp <= 0) continue

      if (!manhaPorDia.has(diaEntrega)) {
        manhaPorDia.set(diaEntrega, [])
        tardePorDia.set(diaEntrega, [])
      }
      producaoPorDia.set(diaEntrega, diaProd)

      const linhaBase = {
        id: escola.id,
        nome_curto: escola.nome_curto,
        nome: escola.nome,
        ordem_rota: escola.ordem_rota ?? 0,
        ordem_pcq: escola.ordem_pcq ?? 0,
        busca_propria: escola.busca_propria === true,
        extra: ehExtra,
        quantidade: base,
      }
      if (base > 0) {
        manhaPorDia.get(diaEntrega)!.push(linhaBase)
      }
      if (comp > 0) {
        tardePorDia.get(diaEntrega)!.push({ ...linhaBase, quantidade: comp })
      }
    }
  }

  // dias em ordem de semana, só os que têm pão
  const dias: DiaSeparacao[] = []
  for (const diaEntrega of DIAS_SEMANA) {
    const manhaLinhas = manhaPorDia.get(diaEntrega) || []
    const tardeLinhas = tardePorDia.get(diaEntrega) || []
    const manha = manhaLinhas.reduce((s, l) => s + l.quantidade, 0)
    const tarde = tardeLinhas.reduce((s, l) => s + l.quantidade, 0)
    if (manha + tarde <= 0) continue
    dias.push({
      dia_entrega: diaEntrega,
      dia_producao: producaoPorDia.get(diaEntrega) || 'domingo',
      data: datasEntrega?.[diaEntrega] || '',
      // manhã: mesma ordem da folha de produção (ordem_rota), extras por último
      manha: {
        linhas: manhaLinhas.sort((a, b) => {
          if (a.extra !== b.extra) return a.extra ? 1 : -1
          return compararPorOrdem(a, b, 'ordem_rota')
        }),
        total: manha,
      },
      // tarde: ordem do PCQ (a entrega do complemento viaja com o PCQ —
      // mesma ordem da folha do motorista facilita carregar)
      tarde: {
        linhas: tardeLinhas.sort((a, b) => compararPorOrdem(a, b, 'ordem_pcq')),
        total: tarde,
      },
      total_dia: manha + tarde,
    })
  }
  return dias
}
