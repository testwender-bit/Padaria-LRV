// =============================================================================
// cardapio-ux-utils.ts — v9.10.17
// Helpers de UX do módulo Nutrição > Cardápios (funções PURAS, sem I/O).
//
// 1) abasAnoCardapios → abas do filtro por ano da lista de cardápios.
//    A aba do ANO CORRENTE é sempre a padrão ("acompanha o ano"): enquanto
//    estamos em 2026, a aba 2026 abre por padrão; ao virar 2027, a aba 2027
//    passa a ser a main automaticamente.
//
// 2) mapearCopiasDias → mapeamento origem→destino do dialog "Copiar Refeições".
//    Dois modos:
//      · par-a-par      — N dias de origem → N dias de destino (1º→1º, 2º→2º…)
//      · um-para-muitos — 1 dia de origem copiado para TODOS os destinos
//    Antes exigia contagens iguais nas duas pontas ("ingessado") — agora a
//    cópia de 1 dia para vários é permitida sem tocar na API (a API copiar-dia
//    já aceita a mesma origem repetida em destinos distintos).
//
// 3) prepararMovimentos → lote do novo modo "Mover várias" do editor: remove
//    duplicados e descarta itens que já estão no dia de destino (mover para
//    o mesmo dia não é um movimento).
// =============================================================================

import { DIAS_SEMANA_NUTRI } from './nutricao-utils'

const ORDEM_DIA: string[] = DIAS_SEMANA_NUTRI.map(d => d.value)
const indiceDia = (dia: string) => {
  const i = ORDEM_DIA.indexOf(dia)
  return i === -1 ? ORDEM_DIA.length : i
}

// ── 1) Abas do filtro por ano ────────────────────────────────────────────────

export interface AbaAno {
  key: string        // 'all' | String(ano)
  label: string      // 'Todos' | '2026' | '2027' …
  anos: number[]     // [] para a aba 'all'
}

// Abas = Todos + anos existentes (mais recentes primeiro) + ano corrente
// (sempre presente, mesmo sem cardápios — para ser a aba "main" do ano).
export function abasAnoCardapios(anosExistentes: number[], anoAtual: number): AbaAno[] {
  const anos = [...new Set(anosExistentes.filter(a => Number.isFinite(a)))]
  if (!anos.includes(anoAtual)) anos.push(anoAtual)
  anos.sort((a, b) => b - a)
  const abas: AbaAno[] = [{ key: 'all', label: 'Todos', anos: [] }]
  for (const ano of anos) abas.push({ key: String(ano), label: String(ano), anos: [ano] })
  return abas
}

// ── 2) Mapeamento do dialog Copiar Refeições ─────────────────────────────────

export interface CopiaMapa {
  origem_semana: number
  origem_dia: string
  destino_semana: number
  destino_dia: string
}

export type ModoCopia = 'par-a-par' | 'um-para-muitos'

export function mapearCopiasDias(
  origemDias: string[],
  destinoDias: string[],
  origemSemana: number,
  destinoSemana: number,
): { origens: CopiaMapa[]; modo: ModoCopia; erro: string | null } {
  const origem = [...origemDias].sort((a, b) => indiceDia(a) - indiceDia(b))
  const destino = [...destinoDias].sort((a, b) => indiceDia(a) - indiceDia(b))

  if (origem.length === 0 || destino.length === 0) {
    return { origens: [], modo: 'par-a-par', erro: 'Selecione pelo menos um dia de origem e um de destino' }
  }

  // Mesma semana + algum dia presente nas duas pontas → nada a fazer
  if (origemSemana === destinoSemana) {
    const conflito = destino.filter(d => origem.includes(d))
    if (conflito.length > 0) {
      return { origens: [], modo: 'par-a-par', erro: 'Pelo menos um dia de origem é igual ao destino' }
    }
  }

  // 1 origem → N destinos: copia o mesmo dia para todos os destinos
  if (origem.length === 1) {
    return {
      origens: destino.map(d => ({
        origem_semana: origemSemana,
        origem_dia: origem[0],
        destino_semana: destinoSemana,
        destino_dia: d,
      })),
      modo: 'um-para-muitos',
      erro: null,
    }
  }

  // N → N (mesma quantidade): mapeamento posicional, como sempre foi
  if (origem.length === destino.length) {
    return {
      origens: origem.map((o, i) => ({
        origem_semana: origemSemana,
        origem_dia: o,
        destino_semana: destinoSemana,
        destino_dia: destino[i],
      })),
      modo: 'par-a-par',
      erro: null,
    }
  }

  return {
    origens: [],
    modo: 'par-a-par',
    erro: 'Selecione a mesma quantidade de dias na origem e no destino (ou apenas 1 dia de origem para copiar para vários)',
  }
}

// ── 3) Lote do modo "Mover várias" ───────────────────────────────────────────

export interface ItemParaMover {
  item_id: string
  tipo_refeicao_id: string
  dia_origem: string
}

export interface MovimentoMover {
  item_id: string
  tipo_refeicao_id: string
  semana_numero: number
  dia_semana: string   // destino
}

// Dedupe por item_id e descarta os que já estão no dia de destino
// (mesma semana/dia/refeição seria um no-op na API mover-item).
export function prepararMovimentos(
  itens: ItemParaMover[],
  destinoDia: string,
  semanaNumero: number,
): { movimentos: MovimentoMover[]; ignoradosMesmoDia: number } {
  const vistos = new Set<string>()
  const movimentos: MovimentoMover[] = []
  let ignoradosMesmoDia = 0
  for (const it of itens) {
    if (vistos.has(it.item_id)) continue
    vistos.add(it.item_id)
    if (it.dia_origem === destinoDia) {
      ignoradosMesmoDia++
      continue
    }
    movimentos.push({
      item_id: it.item_id,
      tipo_refeicao_id: it.tipo_refeicao_id,
      semana_numero: semanaNumero,
      dia_semana: destinoDia,
    })
  }
  return { movimentos, ignoradosMesmoDia }
}
