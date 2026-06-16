/**
 * Shared feriado (holiday) utility functions.
 *
 * Centralises the duplicated holiday-check logic that was previously inlined
 * in both the `/api/producao` and `/api/romaneio` route handlers.
 *
 * Bug-fix applied: BIFASICA is now its own separate entry in the
 * `escolas_afetadas` mapping rather than being incorrectly grouped with OUTROS.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape of a feriado record required by the check functions. */
export interface FeriadoData {
  /** Date string in YYYY-MM-DD format. */
  data: string
  /** Human-readable holiday name (e.g. "Natal"). */
  nome: string
  /** Which school categories are affected: TODAS, REGULARES, INTEGRAIS, CRECHES, INTERIOR, OUTROS, BIFASICA. */
  escolas_afetadas: string
  /** Action to take: zerar_dia, zerar_pf, zerar_pcq, zerar_lanche, apenas_observacao. */
  acao: string
}

/** Result of checking whether a product should be zeroed out. */
export interface ProdutoZeradoResult {
  /** Whether the product quantity should be set to zero. */
  zerado: boolean
  /** Name of the holiday that caused the zeroing (empty string if not zeroed). */
  feriado: string
}

// ---------------------------------------------------------------------------
// Internal mapping
// ---------------------------------------------------------------------------

/**
 * Maps the `escolas_afetadas` value on a feriado record to the list of school
 * `categoria` values that are affected.
 *
 * Each key corresponds to a value that may appear in `feriado.escolas_afetadas`;
 * each value is the array of `escola.categoria` strings that should be matched.
 *
 * FIX: BIFASICA is now a separate entry — it was previously (and incorrectly)
 * grouped under OUTROS.
 */
const CATEGORIA_MAP: Record<string, string[]> = {
  REGULARES: ['REGULAR'],
  INTEGRAIS: ['INTEGRAL'],
  CRECHES: ['CRECHE'],
  INTERIOR: ['INTERIOR'],
  OUTROS: ['OUTROS'],
  BIFASICA: ['BIFASICA'],
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Determines whether a given school category is affected by a specific holiday.
 *
 * @param feriado   - The holiday record to evaluate.
 * @param categoria - The school's category (e.g. "REGULAR", "BIFASICA").
 * @returns `true` when the school category is affected by the holiday.
 */
export function escolaAfetada(feriado: FeriadoData, categoria: string): boolean {
  if (feriado.escolas_afetadas === 'TODAS') return true
  return CATEGORIA_MAP[feriado.escolas_afetadas]?.includes(categoria) ?? false
}

/**
 * Checks whether a product's quantity should be zeroed out on a given date
 * due to a holiday.
 *
 * Iterates over all holidays that fall on `dataStr` and, for each holiday
 * that affects the school's category, evaluates the holiday's `acao` (action)
 * against the product type.
 *
 * @param feriadosMap - Pre-built map from date string → list of holidays on that date.
 * @param dataStr     - The date to check (YYYY-MM-DD).
 * @param categoria   - The school's category.
 * @param produto     - The product identifier (PF, PF_COMP, PCQ, LANCHE, …).
 * @returns A {@link ProdutoZeradoResult} indicating whether to zero the product.
 */
export function produtoZerado(
  feriadosMap: Map<string, FeriadoData[]>,
  dataStr: string,
  categoria: string,
  produto: string,
): ProdutoZeradoResult {
  const feriadosDia = feriadosMap.get(dataStr) || []
  for (const f of feriadosDia) {
    if (!escolaAfetada(f, categoria)) continue
    if (f.acao === 'zerar_dia') return { zerado: true, feriado: f.nome }
    if (f.acao === 'zerar_pf' && (produto === 'PF' || produto === 'PF_COMP')) return { zerado: true, feriado: f.nome }
    if (f.acao === 'zerar_pcq' && produto === 'PCQ') return { zerado: true, feriado: f.nome }
    if (f.acao === 'zerar_lanche' && produto === 'LANCHE') return { zerado: true, feriado: f.nome }
  }
  return { zerado: false, feriado: '' }
}
