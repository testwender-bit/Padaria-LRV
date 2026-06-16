// ============================================================
// ferro-heme-utils.ts — Estima ferro heme baseado em grupo TACO
// e padrões no nome do alimento.
//
// Justificativa: a TACO não separa ferro heme / não-heme, mas o
// PNAE exige identificação de dias com ferro heme. Esta função
// estima o percentual de ferro total que é heme conforme literatura:
//   - Carnes vermelhas (boi, porco): ~60%
//   - Aves (frango, peru, galinha): ~50%
//   - Pescados: ~40%
//   - Vísceras (fígado, coração, moela): ~70%
//   - Ovos: 0% (ferro do ovo é não-heme)
//   - Preparações com carne: ~25% (diluído por outros ingredientes)
//   - Outros grupos: 0%
// ============================================================

export interface TacoItemBasico {
  grupo: string
  nome: string
  ferro_mg: number
}

/**
 * Estima o teor de ferro heme (mg) para um alimento TACO.
 * Retorna 0 quando não aplicável.
 */
export function estimarFerroHeme(item: TacoItemBasico): number {
  const grupo = (item.grupo || '').trim()
  const nome = (item.nome || '').toLowerCase()
  const ferroTotal = Number(item.ferro_mg) || 0

  if (ferroTotal <= 0) return 0

  // Grupo "Carnes e ovos"
  if (grupo === 'Carnes e ovos') {
    // Ovos: ferro é NÃO-heme
    if (nome.includes('ovo')) return 0

    // Vísceras / miúdos → 70%
    const visceras = ['fígado', 'figado', 'coração', 'coracao', 'moela', 'rins', 'figadinho']
    if (visceras.some((v) => nome.includes(v))) {
      return +(ferroTotal * 0.7).toFixed(3)
    }

    // Aves (frango, galinha, peru, pato, ganso) → 50%
    const aves = ['frango', 'galinha', 'peru', 'pato', 'ganso', 'chester', 'capote']
    if (aves.some((v) => nome.includes(v))) {
      return +(ferroTotal * 0.5).toFixed(3)
    }

    // Carnes vermelhas bovinas e suínas → 60%
    const bovinos = ['boi', 'carne', 'patinho', 'alcatra', 'maminha', 'contrafilé',
      'contrafile', 'coxão', 'coxao', 'filé mignon', 'file mignon', 'picanha',
      'acém', 'acem', 'músculo', 'musculo', 'lagarto', 'fraldinha', 'macaxeira']
    const suinos = ['porco', 'lombo', 'pernil', 'panceta', 'bacon', 'costelinha', 'linguiça', 'linguica']
    if (bovinos.some((v) => nome.includes(v)) || suinos.some((v) => nome.includes(v))) {
      return +(ferroTotal * 0.6).toFixed(3)
    }

    // Default para "Carnes e ovos" não-classificados acima → 50%
    return +(ferroTotal * 0.5).toFixed(3)
  }

  // Grupo "Pescados e frutos do mar" → 40%
  if (grupo === 'Pescados e frutos do mar') {
    return +(ferroTotal * 0.4).toFixed(3)
  }

  // Grupo "Preparações" — verificar nome para identificar carnes
  if (grupo === 'Preparações') {
    const carnesPrep = ['frango', 'galinha', 'carne', 'boi', 'porco', 'peixe',
      'moqueca', 'ensopado', 'ensopada', 'ensop', 'cozido', 'cozida',
      'estragado', 'picadinho', 'ragu', 'bolo de carne', 'empadão', 'empadao',
      'croquete', 'almôndega', 'almondega', 'hambúrguer', 'hamburguer',
      'salsicha', 'linguiça', 'linguica', 'bacon']
    if (carnesPrep.some((v) => nome.includes(v))) {
      // Preparações diluem o ferro: 25% do total é heme
      return +(ferroTotal * 0.25).toFixed(3)
    }
    return 0
  }

  // Outros grupos (cereais, leguminosas, verduras, frutas, leite,
  // açúcares, bebidas, outros) → ferro 100% não-heme
  return 0
}
