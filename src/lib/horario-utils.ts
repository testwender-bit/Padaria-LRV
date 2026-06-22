// ============================================================
// horario-utils.ts — Helpers para horário de refeição
// ============================================================
// Funções utilitárias para:
//   - Parsear string de horário (ex: "09h00 / 15h00") em minutos
//   - Ordenar refeições por horário cronológico
//   - Detectar multiplicador (quantos horários uma refeição tem)
// ============================================================

/**
 * Converte uma string de horário em minutos desde meia-noite.
 * Suporta formatos:
 *   - "09h00"          → 540
 *   - "09h00min"       → 540
 *   - "09:00"          → 540
 *   - "07h30min"       → 450
 *   - "9h00"           → 540 (sem zero à esquerda)
 *
 * Se não conseguir parsear, retorna Number.MAX_SAFE_INTEGER (vai pro fim da lista).
 */
export function parseHorarioToMinutes(horario: string | null | undefined): number {
  if (!horario) return Number.MAX_SAFE_INTEGER

  // Pega o PRIMEIRO horário da string (antes de qualquer "/" ou "-")
  // ex: "09h00 / 15h00" → "09h00"
  const primeiroHorario = String(horario).split(/[/\-]/)[0].trim()

  // Padrões comuns:
  // - 09h00, 09h00min, 9h00, 9h00min
  // - 09:00, 9:00
  // - 09h, 9h
  let match = primeiroHorario.match(/^(\d{1,2})h(\d{0,2})/)
  if (match) {
    const h = parseInt(match[1], 10)
    const m = match[2] ? parseInt(match[2], 10) : 0
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m
  }

  match = primeiroHorario.match(/^(\d{1,2}):(\d{0,2})/)
  if (match) {
    const h = parseInt(match[1], 10)
    const m = match[2] ? parseInt(match[2], 10) : 0
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m
  }

  match = primeiroHorario.match(/^(\d{1,2})h\b/)
  if (match) {
    const h = parseInt(match[1], 10)
    if (!isNaN(h)) return h * 60
  }

  // Tenta só número (assume horas)
  match = primeiroHorario.match(/^(\d{1,2})$/)
  if (match) {
    const h = parseInt(match[1], 10)
    if (!isNaN(h)) return h * 60
  }

  return Number.MAX_SAFE_INTEGER
}

/**
 * Conta quantos horários distintos existem na string.
 *   - "09h00"          → 1
 *   - "09h00 / 15h00"  → 2
 *   - "07h30 - 11h00 - 15h00" → 3
 */
export function contarHorarios(horario: string | null | undefined): number {
  if (!horario) return 1
  const parts = String(horario).split(/[/\-]/).map(s => s.trim()).filter(Boolean)
  return parts.length || 1
}

/**
 * Detecta se um horário tem múltiplos turnos (manhã + tarde, por exemplo).
 * Útil para mostrar badge "2 horários" no editor.
 */
export function temMultiplosHorarios(horario: string | null | undefined): boolean {
  return contarHorarios(horario) > 1
}

/**
 * Ordena uma lista de refeições por horário cronológico.
 * Espera objetos que TENHAM um campo de horário acessível.
 *
 * Aceita dois formatos:
 *   - Objeto com campo `horario` direto (ex: CardapioHorarioRefeicao)
 *   - Objeto com campo `tipo_refeicao.horario` (ex: CategoriaRefeicao)
 *   - Objeto com campo `horario_efetivo` (computado previamente)
 *
 * Retorna novo array ordenado (não muta o original).
 */
export function ordenarPorHorario<T extends Record<string, unknown>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ha = getHorarioEfetivo(a)
    const hb = getHorarioEfetivo(b)
    return parseHorarioToMinutes(ha) - parseHorarioToMinutes(hb)
  })
}

// Helper interno — extrai o horário efetivo de qualquer formato
function getHorarioEfetivo(item: Record<string, unknown>): string | null {
  // 1. Campo direto `horario_efetivo` (se já foi computado antes)
  if (typeof item.horario_efetivo === 'string') return item.horario_efetivo
  // 2. Campo direto `horario`
  if (typeof item.horario === 'string') return item.horario
  // 3. Campo aninhado `tipo_refeicao.horario`
  const tr = item.tipo_refeicao as { horario?: string } | undefined
  if (tr && typeof tr.horario === 'string') return tr.horario
  return null
}
