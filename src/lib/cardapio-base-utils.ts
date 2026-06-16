// ============================================================
// cardapio-base-utils.ts — Utilitários para o modelo
// Cardápio-Base × Instância por Escola + Ciclo PNAE
// ============================================================

import { DIAS_SEMANA_NUTRI, FASES_ESCOLARES, type FaseEscolar } from './nutricao-utils'

// ── Segmentos de ensino ────────────────────────────────────
export const SEGMENTOS_ENSINO = [
  { value: 'CRECHE',         label: 'Creche / Berçário',            fases: ['BERCARIO', 'CRECHE'] },
  { value: 'PRE_ESCOLA',     label: 'Pré-Escola (4-5 anos)',        fases: ['ED_INFANTIL'] },
  { value: 'FUND_INICIAL',   label: 'Fundamental Inicial (6-10)',   fases: ['FUND_INICIAL'] },
  { value: 'FUND_FINAL',     label: 'Fundamental Final (11-15)',    fases: ['FUND_FINAL'] },
  { value: 'REGULAR',        label: 'Regular (misto)',              fases: ['FUND_INICIAL', 'FUND_FINAL'] },
  { value: 'INTEGRAL',       label: 'Integral',                     fases: ['FUND_INICIAL', 'FUND_FINAL'] },
] as const

export type SegmentoEnsino = typeof SEGMENTOS_ENSINO[number]['value']

// ── Dias da semana (siglas 3 letras para armazenar) ────────
export const DIAS_SEMANA_SIGLA: Record<string, string> = {
  segunda: 'SEG',
  terca: 'TER',
  quarta: 'QUA',
  quinta: 'QUI',
  sexta: 'SEX',
}

export const SIGLA_TO_DIA: Record<string, string> = Object.entries(DIAS_SEMANA_SIGLA).reduce(
  (acc, [dia, sigla]) => ({ ...acc, [sigla]: dia }),
  {} as Record<string, string>
)

// ── Mapeamento semana semestre → semana do ciclo base ──────
// Semana 6 (semestre) com ciclo de 5 → semana 1 do ciclo
// Semana 7 → 2, Semana 11 → 1, etc.
export function semanaSemestreParaCiclo(semanaSemestre: number, ciclo: number = 5): number {
  if (ciclo <= 0) return semanaSemestre
  return ((semanaSemestre - 1) % ciclo) + 1
}

// ── Verifica se uma semana do semestre é "réplica" do ciclo ──
export function isSemanaReplica(semanaSemestre: number, ciclo: number = 5): boolean {
  return semanaSemestre > ciclo
}

// ── Retorna label amigável para uma semana ─────────────────
// Ex.: "Semana 6 (cópia de 1)"
export function labelSemanaComCiclo(
  semanaSemestre: number,
  ciclo: number = 5,
  repetir: boolean = true
): string {
  if (!repetir || ciclo <= 0) return `Semana ${semanaSemestre}`
  if (semanaSemestre <= ciclo) return `Semana ${semanaSemestre}`
  const base = semanaSemestreParaCiclo(semanaSemestre, ciclo)
  return `Semana ${semanaSemestre} (cópia de ${base})`
}

// ── Percapita × Alunos — cálculo para lista de compras ─────
//
// Regras (por escola + dia + tipo_refeicao):
//   1. PARCIAL puro (alunos_parcial > 0, alunos_integral = 0):
//      total = percapita × alunos_parcial
//
//   2. INTEGRAL puro (alunos_integral > 0, alunos_parcial = 0):
//      Cada aluno come 2× — mas a percapita já é por refeição,
//      então o total é percapita × alunos_integral × 2 refeições
//      (distribuídas entre as refeições que a escola tem no dia).
//
//   3. MESCLA (alunos_parcial > 0 E alunos_integral > 0 E mescla = true):
//      Os dois grupos comem JUNTOS na refeição principal.
//      total_refeicao_principal = percapita × (alunos_parcial + alunos_integral)
//      Para as demais refeições (café/lanche da tarde):
//      total = percapita × alunos_integral  (só integral vem)
//
//   4. MESCLA=false com ambos > 0 (raro): tratar como 2× o parcial + 2× o integral
//      separadamente (cálculo isolado).
//
export interface DadosAlunosEscola {
  alunos_parcial: number
  alunos_integral: number
  mescla_parcial_integral: boolean
}

export interface ResultadoPercapita {
  total_gramas: number
  total_alunos_equivalentes: number
  // decomposição para debug/UI:
  parcial_gramas: number
  integral_gramas: number
}

export function calcularPercapitaTotal(
  percapita_gramas: number, // porção por aluno (em gramas) — já ajustada para a fase escolar
  refeicao_principal: boolean, // true se é a refeição que mescla (ex.: almoço)
  alunos: DadosAlunosEscola
): ResultadoPercapita {
  const { alunos_parcial, alunos_integral, mescla_parcial_integral } = alunos

  // Caso 1: só parcial
  if (alunos_integral === 0) {
    return {
      total_gramas: percapita_gramas * alunos_parcial,
      total_alunos_equivalentes: alunos_parcial,
      parcial_gramas: percapita_gramas * alunos_parcial,
      integral_gramas: 0,
    }
  }

  // Caso 2: só integral (2 refeições por aluno)
  if (alunos_parcial === 0) {
    const fator = refeicao_principal ? 1 : 1
    // Cada aluno integral consome 1× esta percapita (já é por refeição)
    const total = percapita_gramas * alunos_integral * fator
    return {
      total_gramas: total,
      total_alunos_equivalentes: alunos_integral,
      parcial_gramas: 0,
      integral_gramas: total,
    }
  }

  // Caso 3: mescla (ambos comem juntos na principal)
  if (mescla_parcial_integral && refeicao_principal) {
    const totalAlunos = alunos_parcial + alunos_integral
    const total = percapita_gramas * totalAlunos
    return {
      total_gramas: total,
      total_alunos_equivalentes: totalAlunos,
      parcial_gramas: percapita_gramas * alunos_parcial,
      integral_gramas: percapita_gramas * alunos_integral,
    }
  }

  // Caso 4: mescla mas refeição não-principal (só integral)
  if (mescla_parcial_integral && !refeicao_principal) {
    const total = percapita_gramas * alunos_integral
    return {
      total_gramas: total,
      total_alunos_equivalentes: alunos_integral,
      parcial_gramas: 0,
      integral_gramas: total,
    }
  }

  // Caso 5: ambos > 0 mas sem mescla (raro) — soma simples
  const totalParcial = percapita_gramas * alunos_parcial
  const totalIntegral = percapita_gramas * alunos_integral * 2 // 2 refeições
  return {
    total_gramas: totalParcial + totalIntegral,
    total_alunos_equivalentes: alunos_parcial + alunos_integral,
    parcial_gramas: totalParcial,
    integral_gramas: totalIntegral,
  }
}

// ── Identifica refeições "principais" para mescla ─────────
// PNAE define: almoço e jantar são refeições principais.
// Café da manhã, lanche da manhã, lanche da tarde são complementares.
export const REFEICOES_PRINCIPAIS_CODIGOS = new Set([
  'ALMOCO',
  'JANTAR',
  'ALMOCO_INTEGRAL',
  'JANTAR_INTEGRAL',
])

export function isRefeicaoPrincipal(codigoTipoRefeicao: string): boolean {
  return REFEICOES_PRINCIPAIS_CODIGOS.has(codigoTipoRefeicao.toUpperCase())
}

// ── Constante: total de semanas no semestre ────────────────
export const SEMANAS_SEMESTRE = 22

// ── Gera datas para as 22 semanas do semestre ──────────────
// A partir da 1ª segunda-feira após a data base
export function gerarDatasSemanasSemestre(dataInicio: Date, totalSemanas: number = SEMANAS_SEMESTRE) {
  const datas: { numero: number; data_inicio: string; data_fim: string }[] = []
  const primeiraSegunda = new Date(dataInicio)
  // Garante que é segunda-feira
  const diaSem = primeiraSegunda.getDay()
  if (diaSem !== 1) {
    const diff = diaSem === 0 ? 1 : 8 - diaSem
    primeiraSegunda.setDate(primeiraSegunda.getDate() + diff)
  }

  for (let i = 0; i < totalSemanas; i++) {
    const inicio = new Date(primeiraSegunda)
    inicio.setDate(primeiraSegunda.getDate() + i * 7)
    const fim = new Date(inicio)
    fim.setDate(inicio.getDate() + 4) // sexta
    datas.push({
      numero: i + 1,
      data_inicio: inicio.toISOString().split('T')[0],
      data_fim: fim.toISOString().split('T')[0],
    })
  }
  return datas
}

// ── Dia da semana por extenso (PT-BR) ──────────────────────
export function diaSemanaExtenso(dia: string): string {
  const map: Record<string, string> = {
    segunda: 'Segunda-feira',
    terca: 'Terça-feira',
    quarta: 'Quarta-feira',
    quinta: 'Quinta-feira',
    sexta: 'Sexta-feira',
    sabado: 'Sábado',
    domingo: 'Domingo',
  }
  return map[dia] || dia
}

// ── Re-export para conveniência ────────────────────────────
export { DIAS_SEMANA_NUTRI, FASES_ESCOLARES }
export type { FaseEscolar }
