// ============================================================
// preparacao-categorias.ts
// ============================================================
// Constantes e helpers para a nova classificação de preparações (v8).
// Usada pelo cadastro de preparações, pelo editor de cardápio e
// pela UI de replicação.
// ============================================================

export const PREPARACAO_CATEGORIAS = [
  {
    value: 'PREPARACAO',
    label: 'Preparação',
    descricao: 'Prato normal — sem categoria específica (usa detecção por nome)',
    cor: '#1A3A5C',
    icone: 'utensils',
  },
  {
    value: 'SALADA',
    label: 'Salada',
    descricao: 'Salada, vinagrete, alface, acelga, rúcula — sempre primeiro no cardápio',
    cor: '#16A34A',
    icone: 'salad',
  },
  {
    value: 'ARROZ',
    label: 'Arroz',
    descricao: 'Arroz (branco, integral, com legumes, caipira) — sempre após salada',
    cor: '#F59E0B',
    icone: 'rice',
  },
  {
    value: 'FEIJAO',
    label: 'Feijão',
    descricao: 'Feijão (carioca, preto, tropeiro) — sempre após arroz',
    cor: '#92400E',
    icone: 'circle',
  },
  {
    value: 'PROTEINA',
    label: 'Proteína',
    descricao: 'Carne, frango, peixe, ovo, soja — sempre após feijão',
    cor: '#DC2626',
    icone: 'beef',
  },
  {
    value: 'ACOMPANHAMENTO',
    label: 'Acompanhamento',
    descricao: 'Legumes, purê, batata, farofa, polenta, macarrão — após proteína',
    cor: '#166534',
    icone: 'soup',
  },
  {
    value: 'PAO',
    label: 'Pão',
    descricao: 'Pão francês / pão de forma — recebe dia fixo na replicação',
    cor: '#B45309',
    icone: 'sandwich',
  },
  {
    value: 'LANCHE',
    label: 'Lanche',
    descricao: 'Lanche especial (rosca, brioche, bisnaguinha) — recebe dia fixo na replicação',
    cor: '#7C2D12',
    icone: 'cookie',
  },
  {
    value: 'CUSCUZ',
    label: 'Cuscuz',
    descricao: 'Cuscuz — tem perfil próprio (bebida → salada → cuscuz → acompanhamento → fruta)',
    cor: '#A16207',
    icone: 'wheat',
  },
  {
    value: 'BEBIDA',
    label: 'Bebida',
    descricao: 'Leite, café, chá, iogurte, vitamina — primeiro no lanche/manhã',
    cor: '#1E40AF',
    icone: 'cup',
  },
  {
    value: 'SUCO',
    label: 'Suco',
    descricao: 'Suco de frutas — primeiro no lanche/manhã',
    cor: '#2563EB',
    icone: 'glass',
  },
  {
    value: 'DOCE',
    label: 'Doce',
    descricao: 'Canjica, curau, pamonha, bolo doce, pudim — perfil doce (bebida → doce → fruta)',
    cor: '#C026D3',
    icone: 'cake',
  },
  {
    value: 'FRUTA',
    label: 'Fruta',
    descricao: 'Fruta in natura, salada de frutas, frozen de fruta — sempre por último',
    cor: '#15803D',
    icone: 'apple',
  },
  {
    value: 'SOBREMESA',
    label: 'Sobremesa',
    descricao: 'Sobremesa (pudim, gelatina, mousse) — sempre por último',
    cor: '#9D174D',
    icone: 'cake',
  },
] as const

export type PreparacaoCategoria = typeof PREPARACAO_CATEGORIAS[number]['value']

export function getCategoriaInfo(categoria: string) {
  return PREPARACAO_CATEGORIAS.find((c) => c.value === categoria) || PREPARACAO_CATEGORIAS[0]
}

export function getCategoriaLabel(categoria: string): string {
  return getCategoriaInfo(categoria).label
}

export function getCategoriaCor(categoria: string): string {
  return getCategoriaInfo(categoria).cor
}

/**
 * Retorna true se a categoria é "especial" — isto é, recebe tratamento
 * de dia fixo durante a replicação do cardápio base para escolas.
 */
export function isCategoriaEspecial(categoria: string): boolean {
  return categoria === 'PAO' || categoria === 'LANCHE'
}

// ── Mapeamento dia_pt ↔ dia_iso ──────────────────────────
// O schema usa 'segunda', 'terca', ... para dia_semana em CardapioDiaNutri.
// Mas o override dia_pao_frances/dia_lanche usa SEG, TER, QUA, QUI, SEX
// para consistência com o modelo Escola (campo dia_pao_frances e dia_lanche).
// Esta tabela faz o mapeamento bidirecional.

export const DIAS_SEMANA_ISO = [
  { value: 'SEG', label: 'Segunda', iso_pt: 'segunda' },
  { value: 'TER', label: 'Terça',   iso_pt: 'terca'   },
  { value: 'QUA', label: 'Quarta',  iso_pt: 'quarta'  },
  { value: 'QUI', label: 'Quinta',  iso_pt: 'quinta'  },
  { value: 'SEX', label: 'Sexta',   iso_pt: 'sexta'   },
] as const

export function isoToPt(iso: string): string {
  return DIAS_SEMANA_ISO.find((d) => d.value === iso)?.iso_pt || iso.toLowerCase()
}

export function ptToIso(pt: string): string {
  const found = DIAS_SEMANA_ISO.find((d) => d.iso_pt === pt.toLowerCase())
  return found?.value || pt.toUpperCase()
}
