// =============================================================================
// nutricao-utils.ts — Nutritional calculation engine for PNAE (Programa Nacional
// de Alimentação Escolar)
// =============================================================================

// ---------------------------------------------------------------------------
// 1. Types
// ---------------------------------------------------------------------------

export interface NutrienteDia {
  energia_kcal: number
  carboidratos_g: number
  proteinas_g: number
  lipidios_g: number
  fibra_alimentar_g: number
  sodio_mg: number
  ferro_mg: number
  ferro_heme_mg: number
  vitamina_a_mcg: number
  vitamina_c_mg: number
  calcio_mg: number
  magnesio_mg: number
  zinco_mg: number
  acucar_adicionado_g: number
}

export interface AlertaPNAE {
  tipo: 'CRITICO' | 'ATENCAO' | 'OK'
  nutriente: string
  mensagem: string
  valor_realizado: number
  valor_meta: number
  unidade: string
}

export interface ResumoNutricionalSemana {
  media_dia: NutrienteDia
  alertas: AlertaPNAE[]
  dias_com_ferro_heme: number
  dias_com_vitamina_a: number
  percentuais: {
    carboidratos_pct: number
    proteinas_pct: number
    lipidios_pct: number
    acucar_pct: number
  }
}

interface PreparacaoIngredienteComAlimento {
  quantidade_gramas: number
  alimento: {
    energia_kcal: number
    carboidratos_g: number
    proteinas_g: number
    lipidios_g: number
    fibra_alimentar_g: number
    sodio_mg: number
    ferro_mg: number
    ferro_heme_mg: number
    vitamina_a_mcg: number
    vitamina_c_mg: number
    calcio_mg: number
    magnesio_mg: number
    zinco_mg: number
    acucar_adicionado_g: number
  }
}

interface MetaNutricionalData {
  energia_kcal_min: number
  energia_kcal_max: number
  carboidratos_pct_min: number
  carboidratos_pct_max: number
  proteinas_pct_min: number
  proteinas_pct_max: number
  lipidios_pct_min: number
  lipidios_pct_max: number
  sodio_mg_max: number
  ferro_mg_min: number
  ferro_heme_dias_semana: number
  vitamina_a_mcg_min: number
  vitamina_a_dias_semana: number
  vitamina_c_mg_min: number
  acucar_pct_max: number
  acucar_proibido_menor3: boolean
}

// ---------------------------------------------------------------------------
// 2. Helper Functions
// ---------------------------------------------------------------------------

export function emptyNutrienteDia(): NutrienteDia {
  return {
    energia_kcal: 0,
    carboidratos_g: 0,
    proteinas_g: 0,
    lipidios_g: 0,
    fibra_alimentar_g: 0,
    sodio_mg: 0,
    ferro_mg: 0,
    ferro_heme_mg: 0,
    vitamina_a_mcg: 0,
    vitamina_c_mg: 0,
    calcio_mg: 0,
    magnesio_mg: 0,
    zinco_mg: 0,
    acucar_adicionado_g: 0,
  }
}

export function somarNutrientes(a: NutrienteDia, b: NutrienteDia): NutrienteDia {
  return {
    energia_kcal: a.energia_kcal + b.energia_kcal,
    carboidratos_g: a.carboidratos_g + b.carboidratos_g,
    proteinas_g: a.proteinas_g + b.proteinas_g,
    lipidios_g: a.lipidios_g + b.lipidios_g,
    fibra_alimentar_g: a.fibra_alimentar_g + b.fibra_alimentar_g,
    sodio_mg: a.sodio_mg + b.sodio_mg,
    ferro_mg: a.ferro_mg + b.ferro_mg,
    ferro_heme_mg: a.ferro_heme_mg + b.ferro_heme_mg,
    vitamina_a_mcg: a.vitamina_a_mcg + b.vitamina_a_mcg,
    vitamina_c_mg: a.vitamina_c_mg + b.vitamina_c_mg,
    calcio_mg: a.calcio_mg + b.calcio_mg,
    magnesio_mg: a.magnesio_mg + b.magnesio_mg,
    zinco_mg: a.zinco_mg + b.zinco_mg,
    acucar_adicionado_g: a.acucar_adicionado_g + b.acucar_adicionado_g,
  }
}

export function dividirNutrientes(n: NutrienteDia, divisor: number): NutrienteDia {
  return {
    energia_kcal: n.energia_kcal / divisor,
    carboidratos_g: n.carboidratos_g / divisor,
    proteinas_g: n.proteinas_g / divisor,
    lipidios_g: n.lipidios_g / divisor,
    fibra_alimentar_g: n.fibra_alimentar_g / divisor,
    sodio_mg: n.sodio_mg / divisor,
    ferro_mg: n.ferro_mg / divisor,
    ferro_heme_mg: n.ferro_heme_mg / divisor,
    vitamina_a_mcg: n.vitamina_a_mcg / divisor,
    vitamina_c_mg: n.vitamina_c_mg / divisor,
    calcio_mg: n.calcio_mg / divisor,
    magnesio_mg: n.magnesio_mg / divisor,
    zinco_mg: n.zinco_mg / divisor,
    acucar_adicionado_g: n.acucar_adicionado_g / divisor,
  }
}

export function calcularPercentualEnergia(n: NutrienteDia): {
  carboidratos_pct: number
  proteinas_pct: number
  lipidios_pct: number
  acucar_pct: number
} {
  const totalKcal = n.energia_kcal

  if (totalKcal === 0) {
    return {
      carboidratos_pct: 0,
      proteinas_pct: 0,
      lipidios_pct: 0,
      acucar_pct: 0,
    }
  }

  const carbKcal = n.carboidratos_g * 4
  const protKcal = n.proteinas_g * 4
  const lipKcal = n.lipidios_g * 9
  const acucarKcal = n.acucar_adicionado_g * 4

  return {
    carboidratos_pct: (carbKcal / totalKcal) * 100,
    proteinas_pct: (protKcal / totalKcal) * 100,
    lipidios_pct: (lipKcal / totalKcal) * 100,
    acucar_pct: (acucarKcal / totalKcal) * 100,
  }
}

// ---------------------------------------------------------------------------
// 3. Core Calculation Functions
// ---------------------------------------------------------------------------

export function calcularNutrientesPreparacao(
  ingredientes: PreparacaoIngredienteComAlimento[],
): NutrienteDia {
  return ingredientes.reduce<NutrienteDia>((acc, ingrediente) => {
    const fator = ingrediente.quantidade_gramas / 100
    const alimento = ingrediente.alimento

    return somarNutrientes(acc, {
      energia_kcal: fator * alimento.energia_kcal,
      carboidratos_g: fator * alimento.carboidratos_g,
      proteinas_g: fator * alimento.proteinas_g,
      lipidios_g: fator * alimento.lipidios_g,
      fibra_alimentar_g: fator * alimento.fibra_alimentar_g,
      sodio_mg: fator * alimento.sodio_mg,
      ferro_mg: fator * alimento.ferro_mg,
      ferro_heme_mg: fator * alimento.ferro_heme_mg,
      vitamina_a_mcg: fator * alimento.vitamina_a_mcg,
      vitamina_c_mg: fator * alimento.vitamina_c_mg,
      calcio_mg: fator * alimento.calcio_mg,
      magnesio_mg: fator * alimento.magnesio_mg,
      zinco_mg: fator * alimento.zinco_mg,
      acucar_adicionado_g: fator * alimento.acucar_adicionado_g,
    })
  }, emptyNutrienteDia())
}

export function calcularNutrientesRefeicao(
  itens: {
    preparacao: { ingredientes: PreparacaoIngredienteComAlimento[] }
    porcoes: number
  }[],
): NutrienteDia {
  return itens.reduce<NutrienteDia>((acc, item) => {
    const nutrientesPreparacao = calcularNutrientesPreparacao(
      item.preparacao.ingredientes,
    )
    const multiplicado: NutrienteDia = {
      energia_kcal: nutrientesPreparacao.energia_kcal * item.porcoes,
      carboidratos_g: nutrientesPreparacao.carboidratos_g * item.porcoes,
      proteinas_g: nutrientesPreparacao.proteinas_g * item.porcoes,
      lipidios_g: nutrientesPreparacao.lipidios_g * item.porcoes,
      fibra_alimentar_g: nutrientesPreparacao.fibra_alimentar_g * item.porcoes,
      sodio_mg: nutrientesPreparacao.sodio_mg * item.porcoes,
      ferro_mg: nutrientesPreparacao.ferro_mg * item.porcoes,
      ferro_heme_mg: nutrientesPreparacao.ferro_heme_mg * item.porcoes,
      vitamina_a_mcg: nutrientesPreparacao.vitamina_a_mcg * item.porcoes,
      vitamina_c_mg: nutrientesPreparacao.vitamina_c_mg * item.porcoes,
      calcio_mg: nutrientesPreparacao.calcio_mg * item.porcoes,
      magnesio_mg: nutrientesPreparacao.magnesio_mg * item.porcoes,
      zinco_mg: nutrientesPreparacao.zinco_mg * item.porcoes,
      acucar_adicionado_g: nutrientesPreparacao.acucar_adicionado_g * item.porcoes,
    }
    return somarNutrientes(acc, multiplicado)
  }, emptyNutrienteDia())
}

export function gerarAlertasPNAE(
  media: NutrienteDia,
  metas: MetaNutricionalData,
  diasFerroHeme: number,
  diasVitA: number,
  pct: {
    carboidratos_pct: number
    proteinas_pct: number
    lipidios_pct: number
    acucar_pct: number
  },
  categoriaEscola: string = '',
): AlertaPNAE[] {
  const alertas: AlertaPNAE[] = []

  // Energy outside min/max → CRITICO
  if (media.energia_kcal < metas.energia_kcal_min) {
    alertas.push({
      tipo: 'CRITICO',
      nutriente: 'energia_kcal',
      mensagem: `Energia abaixo do mínimo recomendado (${media.energia_kcal.toFixed(0)} kcal < ${metas.energia_kcal_min} kcal)`,
      valor_realizado: media.energia_kcal,
      valor_meta: metas.energia_kcal_min,
      unidade: 'kcal',
    })
  } else if (media.energia_kcal > metas.energia_kcal_max) {
    alertas.push({
      tipo: 'CRITICO',
      nutriente: 'energia_kcal',
      mensagem: `Energia acima do máximo recomendado (${media.energia_kcal.toFixed(0)} kcal > ${metas.energia_kcal_max} kcal)`,
      valor_realizado: media.energia_kcal,
      valor_meta: metas.energia_kcal_max,
      unidade: 'kcal',
    })
  }

  // Carb pct outside range → ATENCAO
  if (
    pct.carboidratos_pct < metas.carboidratos_pct_min ||
    pct.carboidratos_pct > metas.carboidratos_pct_max
  ) {
    alertas.push({
      tipo: 'ATENCAO',
      nutriente: 'carboidratos_pct',
      mensagem: `Carboidratos fora da faixa recomendada (${pct.carboidratos_pct.toFixed(1)}% — faixa: ${metas.carboidratos_pct_min}%–${metas.carboidratos_pct_max}%)`,
      valor_realizado: pct.carboidratos_pct,
      valor_meta: metas.carboidratos_pct_min,
      unidade: '%',
    })
  }

  // Protein pct outside range → ATENCAO
  if (
    pct.proteinas_pct < metas.proteinas_pct_min ||
    pct.proteinas_pct > metas.proteinas_pct_max
  ) {
    alertas.push({
      tipo: 'ATENCAO',
      nutriente: 'proteinas_pct',
      mensagem: `Proteínas fora da faixa recomendada (${pct.proteinas_pct.toFixed(1)}% — faixa: ${metas.proteinas_pct_min}%–${metas.proteinas_pct_max}%)`,
      valor_realizado: pct.proteinas_pct,
      valor_meta: metas.proteinas_pct_min,
      unidade: '%',
    })
  }

  // Lipids pct outside range → ATENCAO
  if (
    pct.lipidios_pct < metas.lipidios_pct_min ||
    pct.lipidios_pct > metas.lipidios_pct_max
  ) {
    alertas.push({
      tipo: 'ATENCAO',
      nutriente: 'lipidios_pct',
      mensagem: `Lipídios fora da faixa recomendada (${pct.lipidios_pct.toFixed(1)}% — faixa: ${metas.lipidios_pct_min}%–${metas.lipidios_pct_max}%)`,
      valor_realizado: pct.lipidios_pct,
      valor_meta: metas.lipidios_pct_min,
      unidade: '%',
    })
  }

  // Lipids > 30% → CRITICO
  if (pct.lipidios_pct > 30) {
    alertas.push({
      tipo: 'CRITICO',
      nutriente: 'lipidios_pct',
      mensagem: `Lipídios acima de 30% do VET (${pct.lipidios_pct.toFixed(1)}%)`,
      valor_realizado: pct.lipidios_pct,
      valor_meta: 30,
      unidade: '%',
    })
  }

  // Sodium > max → CRITICO
  if (media.sodio_mg > metas.sodio_mg_max) {
    alertas.push({
      tipo: 'CRITICO',
      nutriente: 'sodio_mg',
      mensagem: `Sódio acima do máximo permitido (${media.sodio_mg.toFixed(0)} mg > ${metas.sodio_mg_max} mg)`,
      valor_realizado: media.sodio_mg,
      valor_meta: metas.sodio_mg_max,
      unidade: 'mg',
    })
  }

  // Iron < min → ATENCAO
  if (media.ferro_mg < metas.ferro_mg_min) {
    alertas.push({
      tipo: 'ATENCAO',
      nutriente: 'ferro_mg',
      mensagem: `Ferro abaixo do mínimo recomendado (${media.ferro_mg.toFixed(1)} mg < ${metas.ferro_mg_min} mg)`,
      valor_realizado: media.ferro_mg,
      valor_meta: metas.ferro_mg_min,
      unidade: 'mg',
    })
  }

  // Heme iron days < required → CRITICO
  if (diasFerroHeme < metas.ferro_heme_dias_semana) {
    alertas.push({
      tipo: 'CRITICO',
      nutriente: 'ferro_heme_dias',
      mensagem: `Ferro heme presente em apenas ${diasFerroHeme} de ${metas.ferro_heme_dias_semana} dias obrigatórios na semana`,
      valor_realizado: diasFerroHeme,
      valor_meta: metas.ferro_heme_dias_semana,
      unidade: 'dias',
    })
  }

  // Vit A < min → ATENCAO
  if (media.vitamina_a_mcg < metas.vitamina_a_mcg_min) {
    alertas.push({
      tipo: 'ATENCAO',
      nutriente: 'vitamina_a_mcg',
      mensagem: `Vitamina A abaixo do mínimo recomendado (${media.vitamina_a_mcg.toFixed(0)} mcg < ${metas.vitamina_a_mcg_min} mcg)`,
      valor_realizado: media.vitamina_a_mcg,
      valor_meta: metas.vitamina_a_mcg_min,
      unidade: 'mcg',
    })
  }

  // Vit A days < required → CRITICO
  if (diasVitA < metas.vitamina_a_dias_semana) {
    alertas.push({
      tipo: 'CRITICO',
      nutriente: 'vitamina_a_dias',
      mensagem: `Vitamina A presente em apenas ${diasVitA} de ${metas.vitamina_a_dias_semana} dias obrigatórios na semana`,
      valor_realizado: diasVitA,
      valor_meta: metas.vitamina_a_dias_semana,
      unidade: 'dias',
    })
  }

  // Vit C < min → ATENCAO
  if (media.vitamina_c_mg < metas.vitamina_c_mg_min) {
    alertas.push({
      tipo: 'ATENCAO',
      nutriente: 'vitamina_c_mg',
      mensagem: `Vitamina C abaixo do mínimo recomendado (${media.vitamina_c_mg.toFixed(1)} mg < ${metas.vitamina_c_mg_min} mg)`,
      valor_realizado: media.vitamina_c_mg,
      valor_meta: metas.vitamina_c_mg_min,
      unidade: 'mg',
    })
  }

  // Sugar pct > max → CRITICO
  if (pct.acucar_pct > metas.acucar_pct_max) {
    alertas.push({
      tipo: 'CRITICO',
      nutriente: 'acucar_pct',
      mensagem: `Açúcar adicionado acima do limite (${pct.acucar_pct.toFixed(1)}% > ${metas.acucar_pct_max}%)`,
      valor_realizado: pct.acucar_pct,
      valor_meta: metas.acucar_pct_max,
      unidade: '%',
    })
  }

  // Sugar and creche (acucar_proibido_menor3) → CRITICO
  if (metas.acucar_proibido_menor3 && categoriaEscola === 'CRECHE' && media.acucar_adicionado_g > 0) {
    alertas.push({
      tipo: 'CRITICO',
      nutriente: 'acucar_adicionado_g',
      mensagem: `Açúcar adicionado é proibido para creche (${media.acucar_adicionado_g.toFixed(1)} g detectado)`,
      valor_realizado: media.acucar_adicionado_g,
      valor_meta: 0,
      unidade: 'g',
    })
  }

  return alertas
}

export function calcularResumoSemana(
  diasNutrientes: NutrienteDia[],
  metas: MetaNutricionalData,
  categoriaEscola: string,
): ResumoNutricionalSemana {
  // v8.7: Filtrar dias com preparação (ignora dias de feriado sem itens).
  // Antes a média dividia por todos os dias (5), o que dava média baixa
  // quando um dia era feriado. Agora divide apenas pelos dias que têm
  // nutrientes (sum > 0), garantindo média real.
  const diasComNutrientes = diasNutrientes.filter(
    (d) => d.energia_kcal > 0 || d.proteinas_g > 0 || d.carboidratos_g > 0,
  )

  const totalSemana = diasComNutrientes.reduce(somarNutrientes, emptyNutrienteDia())
  const numDias = diasComNutrientes.length > 0 ? diasComNutrientes.length : 1
  const mediaDia = dividirNutrientes(totalSemana, numDias)

  // Count days with heme iron and vitamin A
  const diasComFerroHeme = diasComNutrientes.filter(
    (d) => d.ferro_heme_mg > 0,
  ).length
  const diasComVitaminaA = diasComNutrientes.filter(
    (d) => d.vitamina_a_mcg > 0,
  ).length

  // Calculate macronutrient energy percentages
  const percentuais = calcularPercentualEnergia(mediaDia)

  // Generate PNAE compliance alerts
  const alertas = gerarAlertasPNAE(
    mediaDia,
    metas,
    diasComFerroHeme,
    diasComVitaminaA,
    percentuais,
    categoriaEscola,
  )

  return {
    media_dia: mediaDia,
    alertas,
    dias_com_ferro_heme: diasComFerroHeme,
    dias_com_vitamina_a: diasComVitaminaA,
    percentuais,
  }
}

// ---------------------------------------------------------------------------
// 4. Constants
// ---------------------------------------------------------------------------

export const GRUPOS_ALIMENTOS = [
  'Cereais e derivados',
  'Leguminosas e derivados',
  'Verduras e hortaliças',
  'Frutas',
  'Frutas e derivados',
  'Carnes e ovos',
  'Pescados e frutos do mar',
  'Leite e derivados',
  'Óleos e gorduras',
  'Açúcares e doces',
  'Bebidas',
  'Preparações',
  'Outros',
] as const

export const CATEGORIAS_ESCOLA_NUTRI = [
  { value: 'REGULAR', label: 'Regular (1 lanche)' },
  { value: 'INTEGRAL', label: 'Integral (2 lanches)' },
  { value: 'BIFASICA', label: 'Bifásica (2 lanches)' },
  { value: 'CRECHE', label: 'Creche (5 refeições)' },
  { value: 'INTERIOR', label: 'Interior (lanche + almoço)' },
] as const

// ── Fases Escolares (percapita por idade) ────────────────────
export const FASES_ESCOLARES = [
  { value: 'FUND_FINAL', label: 'Ens. Fund. Final', faixa: '11 a 15 anos', percentual: 100, cor: '#1A3A5C' },
  { value: 'FUND_INICIAL', label: 'Ens. Fund. Inicial', faixa: '6 a 10 anos', percentual: 90, cor: '#2D6A4F' },
  { value: 'ED_INFANTIL', label: 'Ed. Infantil', faixa: '4 a 5 anos', percentual: 75, cor: '#7B2D8E' },
  { value: 'CRECHE', label: 'Creche', faixa: '1 a 3 anos', percentual: 50, cor: '#B45309' },
  { value: 'BERCARIO', label: 'Berçário', faixa: '6 a 12 meses', percentual: 40, cor: '#9F1239' },
] as const

export type FaseEscolar = typeof FASES_ESCOLARES[number]['value']

/** Calcula a percapita em gramas para uma fase escolar baseado no valor base (Fund. Final = 100%) */
export function calcularPercapitaPorFase(gramasBase: number, faseEscolar: FaseEscolar): number {
  const fase = FASES_ESCOLARES.find((f) => f.value === faseEscolar)
  if (!fase) return gramasBase
  return Math.round(gramasBase * (fase.percentual / 100))
}

/** Retorna o percentual padrão de uma fase escolar */
export function getPercentualFase(faseEscolar: FaseEscolar): number {
  const fase = FASES_ESCOLARES.find((f) => f.value === faseEscolar)
  return fase?.percentual ?? 100
}

export const DIAS_SEMANA_NUTRI = [
  { value: 'segunda', label: 'Segunda' },
  { value: 'terca', label: 'Terça' },
  { value: 'quarta', label: 'Quarta' },
  { value: 'quinta', label: 'Quinta' },
  { value: 'sexta', label: 'Sexta' },
] as const

// ---------------------------------------------------------------------------
// 5. TACO Ingredient Name Cleaning
// ---------------------------------------------------------------------------

/**
 * Limpa nomes de ingredientes vindos da tabela TACO.
 * Remove qualificadores de preparo como "cozido", "cru", "crua", "cozida",
 * "assado", "grelhado", "refogado", etc. que não são relevantes para exibição
 * em cardápios impressos ou na interface.
 * Também aplica capitalização title-case (preservando preposições).
 *
 * Exemplos:
 *   "Arroz branco cozido" → "Arroz Branco"
 *   "Alho cru" → "Alho"
 *   "Cebola crua" → "Cebola"
 *   "Feijão carioca cozido" → "Feijão Carioca"
 *   "Frango coxa" → "Frango Coxa"  (mantido — "coxa" é corte, não preparo)
 *   "Óleo de soja" → "Óleo de Soja" (mantido)
 */
export function limparNomeIngrediente(nome: string): string {
  // Sufixos de preparo/cozimento a remover (apenas no final do nome)
  const sufixosRemover = [
    ' cozido e amassado', ' cozida e amassada',
    ' cozido no vapor', ' cozida no vapor',
    ' cozido', ' cozida',
    ' cru', ' crua',
    ' assado', ' assada',
    ' grelhado', ' grelhada',
    ' frito', ' frita',
    ' refogado', ' refogada',
    ' em cubos', ' em pedaços',
    ' picado', ' picada',
    ' cortado', ' cortada',
    ' descascado', ' descascada',
    ' sem casca', ' com casca',
    ' inteiro', ' inteira',
    ' moído', ' moída',
    ' ralado', ' ralada',
    ' amassado', ' amassada',
    ' passado', ' passada',
    ' selecionado', ' selecionada',
    ' sanfonado', ' sanfonada',
    ' desfiado', ' desfiada',
    ' laminado', ' laminada',
  ]

  // Ordenar por tamanho decrescente para match mais longo primeiro
  sufixosRemover.sort((a, b) => b.length - a.length)

  let limpo = nome
  for (const sufixo of sufixosRemover) {
    if (limpo.toLowerCase().endsWith(sufixo)) {
      limpo = limpo.substring(0, limpo.length - sufixo.length)
      break // Remove apenas um sufixo
    }
  }

  // Remover artigo "à" no final
  limpo = limpo.replace(/\s+à\s*$/i, '')

  // Limpar espaços extras
  limpo = limpo.replace(/\s+/g, ' ').trim()

  // Aplicar title-case (primeira letra maiúscula de cada palavra)
  // Preservar preposições minúsculas (de, da, do, das, dos, em, na, no, com, à, e)
  const preposicoes = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'com', 'à', 'e'])
  limpo = limpo.split(' ').map((palavra, idx) => {
    if (idx > 0 && preposicoes.has(palavra.toLowerCase())) {
      return palavra.toLowerCase()
    }
    return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase()
  }).join(' ')

  return limpo
}
