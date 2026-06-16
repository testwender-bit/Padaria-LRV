// ============================================================
// UTILITÁRIOS DE DATA — semanas, dias, formatação
// ============================================================

import { startOfWeek, endOfWeek, format, addWeeks, getISOWeek, getYear, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type DiaSemana = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta'

export const DIAS_SEMANA: DiaSemana[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

export const DIAS_LABEL: Record<DiaSemana, string> = {
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
}

export const DIAS_LABEL_CURTO: Record<DiaSemana, string> = {
  segunda: 'Seg',
  terca: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
}

// Production days (includes domingo — PF production starts on Sunday)
export type DiaProducao = 'domingo' | 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta'

export const DIAS_PRODUCAO: DiaProducao[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta']

export const DIAS_LABEL_CURTO_PRODUCAO: Record<DiaProducao, string> = {
  domingo: 'Dom',
  segunda: 'Seg',
  terca: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
}

export const DIAS_LABEL_PRODUCAO: Record<DiaProducao, string> = {
  domingo: 'Domingo',
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
}

// Retorna a segunda-feira da semana atual
export function inicioSemana(data: Date = new Date()): Date {
  return startOfWeek(data, { weekStartsOn: 1 })
}

// Retorna a sexta-feira da semana atual
export function fimSemana(data: Date = new Date()): Date {
  const inicio = inicioSemana(data)
  return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 4)
}

// Número da semana (ISO 8601)
export function numeroSemana(data: Date = new Date()): number {
  return getISOWeek(data)
}

// Ano da semana
export function anoSemana(data: Date = new Date()): number {
  return getYear(data)
}

// Formata data como "DD/MM/YYYY"
export function formatarData(data: Date | string): string {
  const d = typeof data === 'string' ? new Date(data + 'T12:00:00') : data
  return format(d, 'dd/MM/yyyy', { locale: ptBR })
}

// Formata "Semana 12 — 23 a 27 de Mar"
export function formatarPeriodoSemana(inicio: Date, fim: Date): string {
  return `${format(inicio, "dd 'de' MMM", { locale: ptBR })} a ${format(fim, "dd 'de' MMM", { locale: ptBR })}`
}

// Pega próxima/anterior semana
export function semanaAdjacente(data: Date, offset: number): Date {
  return addWeeks(data, offset)
}

// Verifica se duas datas são o mesmo dia
export function mesmoDia(d1: Date, d2: Date): boolean {
  return format(d1, 'yyyy-MM-dd') === format(d2, 'yyyy-MM-dd')
}

// Data de referência para planejamento
export function dataReferenciaPlanejamento(hoje: Date = new Date()): Date {
  const diaDaSemana = hoje.getDay()
  if (diaDaSemana === 0 || diaDaSemana >= 4) {
    return addWeeks(hoje, 1)
  }
  return hoje
}

export function ehSemanaPlanejamentoFutura(hoje: Date = new Date()): boolean {
  const diaDaSemana = hoje.getDay()
  return diaDaSemana === 0 || diaDaSemana >= 4
}

// Dia da semana a partir de data
export function diaSemanaFromDate(data: Date): DiaSemana {
  const dias: DiaSemana[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
  // getDay: 0=domingo, 1=segunda, ..., 6=sabado
  const idx = data.getDay() - 1 // ajustar para 0=segunda
  return dias[idx >= 0 && idx < 5 ? idx : 0]
}

// Data ISO string
export function dataISO(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

// Retorna a data de um dia específico da semana
export function dataDiaSemana(refDate: Date, dia: DiaSemana): Date {
  const inicio = inicioSemana(refDate)
  const idx = DIAS_SEMANA.indexOf(dia)
  return addDays(inicio, idx)
}
