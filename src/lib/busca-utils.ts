// ============================================================
// busca-utils.ts — Helpers para busca sem acento e case-insensitive
// ============================================================
// Usado em:
//   - APIs de nutrição (alimentos, preparações) para filtrar sem acento
//   - Front-end das páginas de nutrição para filtrar listas
// ============================================================

/**
 * Remove acentos/diacríticos de uma string e converte para minúsculas.
 * Ex: "Tomate Cereja" → "tomate cereja"
 *     "Açafrão" → "acafrao"
 *     "Pão Francês" → "pao frances"
 */
export function normalizeText(s: string): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove diacríticos
    .toLowerCase()
    .trim()
}

/**
 * Verifica se `texto` contém `busca` (ignora acentos e case).
 * Ex: containsCI("Açafrão da Índia", "acafrao") → true
 *     containsCI("Pão Francês", "pao") → true
 *     containsCI("Tomate", "PMT") → false
 */
export function containsCI(texto: string, busca: string): boolean {
  if (!busca) return true
  return normalizeText(texto).includes(normalizeText(busca))
}

/**
 * Filtra uma lista de objetos pelo campo `campo` usando busca sem acento.
 * Ex: filterByFieldCI(alimentos, 'nome', 'pao') → [Pão Francês, Pão de Queijo, ...]
 */
export function filterByFieldCI<T>(lista: T[], campo: keyof T, busca: string): T[] {
  if (!busca) return lista
  const buscaNorm = normalizeText(String(busca))
  return lista.filter((item) => {
    const valor = String(item[campo] ?? '')
    return normalizeText(valor).includes(buscaNorm)
  })
}
