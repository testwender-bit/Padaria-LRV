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

// v9.7.5: Dias de PRODUÇÃO válidos por produto.
// Usado pela view semanal para saber quais células são "clicáveis"
// (ou seja, em quais dias o produto é efetivamente produzido).
//
// PF: dom→seg, seg→ter, ter→qua, qua→qui, qui→sex (D-1). Não tem sexta
//     porque sábado não tem entrega.
// PCQ: seg, qua, sex (mesmo dia de entrega — seg/qua/sex).
// LANCHE: seg→sex (D-0, mesmo dia).
// PF_COMP: dom (entrega seg), ter (entrega qua), qui (entrega sex) — D-1.
export const DIAS_PRODUCAO_POR_PRODUTO: Record<string, string[]> = {
  PF: ['domingo', 'segunda', 'terca', 'quarta', 'quinta'],
  PCQ: ['segunda', 'quarta', 'sexta'],
  LANCHE: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
  PF_COMP: ['domingo', 'terca', 'quinta'],
}

// v9.7.5: Retorna true se o dia é um dia válido de produção para o produto.
// Previne bug visual onde ajuste de quinta (entrega sexta) "vazava" para
// a coluna sexta na tabela de PF (que não tem produção de PF na sexta).
export function ehDiaProducaoDoProduto(diaProd: string, produto: string): boolean {
  const dias = DIAS_PRODUCAO_POR_PRODUTO[produto]
  return !!dias && dias.includes(diaProd)
}

// v9.8.1: Determina o tipo_pao EFETIVO de uma escola na semana.
// Regras:
// - pao_fixo=true (Bombeiros, CRAS, etc): SEMPRE usa PADRAO, ignorando tudo.
// - BIFASICA: usa lanche_bifasica_modo da semana:
//     LANCHE       → SEMPAO (bifásica só recebe pão do café da manhã;
//                  o lanche da tarde é outro tipo, vai na planilha Lanche)
//     PAO_PADRAO   → PADRAO (café da manhã + lanche da tarde com pão padrão)
//     PAO_PROTEINA → PROTEINA (café da manhã + lanche da tarde com pão proteína)
//     NENHUM       → SEMPAO (bifásica faz preparação na escola — só café da manhã)
// - v9.9.0: escola INTERIOR marcada como "especial" (interior_especial=true
//   na escola) segue a MESMA lógica da bifásica, mas usando o
//   lanche_interior_modo da semana. Demais escolas do Interior seguem o
//   tipo_pao da semana normalmente.
// - Demais escolas: usa o tipo_pao da semana (PADRAO/PROTEINA/SEMPAO).
// Nota: os novos parâmetros são OPCIONAIS para manter compatibilidade com
// chamadas antigas que passam apenas 4 argumentos.
export function tipoPaoEfetivoEscola(
  categoria: string,
  paoFixo: boolean | undefined,
  tipoPaoSemana: string,
  lancheBifasicaModo: string,
  // v9.9.0: flag da escola (interior_especial) + modo da semana
  interiorEspecial?: boolean,
  lancheInteriorModo?: string
): string {
  // pao_fixo sempre vence (Bombeiros, CRAS, etc)
  if (paoFixo === true) return 'PADRAO'

  const isBifasica = categoria === 'BIFASICA'
  // v9.9.0: interior especial — só se NÃO for bifásica (bifásica tem prioridade
  // e usa o próprio modo; uma escola não deve ter as duas flags ao mesmo tempo)
  const isInteriorEspecial = !isBifasica && interiorEspecial === true

  // BIFASICA ou INTERIOR ESPECIAL: tipo de pão depende do modo lanche da semana
  if (isBifasica || isInteriorEspecial) {
    const modo = isInteriorEspecial ? (lancheInteriorModo || 'LANCHE') : lancheBifasicaModo
    if (modo === 'PAO_PADRAO') return 'PADRAO'
    if (modo === 'PAO_PROTEINA') return 'PROTEINA'
    // LANCHE ou NENHUM: escola só recebe pão do café da manhã,
    // então usa SEMPAO (a quantidade cadastrada em SEMPAO é só café da manhã).
    return 'SEMPAO'
  }

  // Demais escolas: usa o tipo_pao da semana
  return tipoPaoSemana
}

// v9.9.0: Modo de lanche EFETIVO de uma escola na semana.
// - BIFASICA: usa lanche_bifasica_modo da semana
// - INTERIOR especial (interior_especial=true): usa lanche_interior_modo da semana
// - Demais escolas: 'LANCHE' (mesmo lanche de todo mundo)
export function modoLancheEfetivoEscola(
  categoria: string,
  interiorEspecial: boolean | undefined,
  lancheBifasicaModo: string,
  lancheInteriorModo: string
): string {
  if (categoria === 'BIFASICA') return lancheBifasicaModo || 'LANCHE'
  if (interiorEspecial === true) return lancheInteriorModo || 'LANCHE'
  return 'LANCHE'
}

// v9.9.0: true quando a escola NÃO deve receber item na planilha de Lanche
// (está em modo PAO_PADRAO, PAO_PROTEINA ou NENHUM — o lanche dela é pão
// francês já embutido no PfQuantidade do tipo correspondente, ou preparação
// na escola). Aplica à bifásica E à escola do Interior especial.
export function escolaPulaLanche(
  categoria: string,
  interiorEspecial: boolean | undefined,
  lancheBifasicaModo: string,
  lancheInteriorModo: string
): boolean {
  const modo = modoLancheEfetivoEscola(categoria, interiorEspecial, lancheBifasicaModo, lancheInteriorModo)
  return modo === 'PAO_PADRAO' || modo === 'PAO_PROTEINA' || modo === 'NENHUM'
}

export interface ItemProducao {
  escola_id: string
  escola_nome: string
  escola_curto: string
  categoria: string
  rota: string
  ordem_rota: number  // v9.5.2: OBRIGATÓRIO — usado para ordenação do PF
  ordem_pcq: number  // v9.6.3: ordenação ESPECÍFICA para PCQ (pão de cachorro quente)
  busca_propria: boolean
  produto: 'PF' | 'PCQ' | 'LANCHE' | 'PF_COMP'
  quantidade: number
  unidade: string
  obs?: string
  dia_entrega?: string
  ajustado?: boolean
  ajuste_motivo?: string  // v9.7.4: motivo do ajuste (para exibir na UI)
  ajuste_qtd_original?: number  // v9.7.4: qtd original antes do ajuste
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
