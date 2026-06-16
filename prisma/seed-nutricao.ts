// ============================================================
// SEED — Módulo de Nutrição (TACO / PNAE)
// Padaria Municipal de Lucas do Rio Verde - MT
// ============================================================
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Helper: upsert Alimento by codigo_taco ──────────────────
async function upsertAlimento(
  data: {
    codigo_taco: number
    nome: string
    grupo: string
    medida_caseira: string
    gramas_por_medida: number
    energia_kcal: number
    carboidratos_g: number
    proteinas_g: number
    lipidios_g: number
    fibra_alimentar_g: number
    sodio_mg: number
    ferro_mg: number
    ferro_heme_mg?: number
    vitamina_a_mcg: number
    vitamina_c_mg: number
    calcio_mg: number
    magnesio_mg: number
    zinco_mg: number
    acucar_adicionado_g?: number
  }
) {
  const existing = await prisma.alimento.findFirst({
    where: { codigo_taco: data.codigo_taco },
  })
  if (existing) {
    return prisma.alimento.update({
      where: { id: existing.id },
      data: {
        nome: data.nome,
        grupo: data.grupo,
        medida_caseira: data.medida_caseira,
        gramas_por_medida: data.gramas_por_medida,
        energia_kcal: data.energia_kcal,
        carboidratos_g: data.carboidratos_g,
        proteinas_g: data.proteinas_g,
        lipidios_g: data.lipidios_g,
        fibra_alimentar_g: data.fibra_alimentar_g,
        sodio_mg: data.sodio_mg,
        ferro_mg: data.ferro_mg,
        ferro_heme_mg: data.ferro_heme_mg ?? 0,
        vitamina_a_mcg: data.vitamina_a_mcg,
        vitamina_c_mg: data.vitamina_c_mg,
        calcio_mg: data.calcio_mg,
        magnesio_mg: data.magnesio_mg,
        zinco_mg: data.zinco_mg,
        acucar_adicionado_g: data.acucar_adicionado_g ?? 0,
        ativo: true,
      },
    })
  }
  return prisma.alimento.create({
    data: {
      codigo_taco: data.codigo_taco,
      nome: data.nome,
      grupo: data.grupo,
      medida_caseira: data.medida_caseira,
      gramas_por_medida: data.gramas_por_medida,
      energia_kcal: data.energia_kcal,
      carboidratos_g: data.carboidratos_g,
      proteinas_g: data.proteinas_g,
      lipidios_g: data.lipidios_g,
      fibra_alimentar_g: data.fibra_alimentar_g,
      sodio_mg: data.sodio_mg,
      ferro_mg: data.ferro_mg,
      ferro_heme_mg: data.ferro_heme_mg ?? 0,
      vitamina_a_mcg: data.vitamina_a_mcg,
      vitamina_c_mg: data.vitamina_c_mg,
      calcio_mg: data.calcio_mg,
      magnesio_mg: data.magnesio_mg,
      zinco_mg: data.zinco_mg,
      acucar_adicionado_g: data.acucar_adicionado_g ?? 0,
      ativo: true,
    },
  })
}

async function main() {
  console.log('🌱 Iniciando seed-nutricao...')

  // ════════════════════════════════════════════════════════════
  // 1. TIPO REFEIÇÃO
  // ════════════════════════════════════════════════════════════
  console.log('  → TipoRefeicao...')

  const tiposRefeicaoData = [
    { codigo: 'CAFE_MANHA', nome: 'Café da Manhã', horario: '07h30min', ordem: 1 },
    { codigo: 'FRUTA_MANHA', nome: 'Fruta da Manhã', horario: '08h45min', ordem: 2 },
    { codigo: 'ALMOCO', nome: 'Almoço', horario: '10h00min', ordem: 3 },
    { codigo: 'LANCHE', nome: 'Lanche', horario: '15h00min', ordem: 4 },
    { codigo: 'HIDRATACAO', nome: 'Hidratação', horario: '13h30min', ordem: 5 },
    { codigo: 'JANTAR', nome: 'Jantar', horario: '15h30min', ordem: 6 },
    { codigo: 'LANCHE_1', nome: '1º Lanche', horario: '09h00min', ordem: 7 },
    { codigo: 'LANCHE_2', nome: '2º Lanche', horario: '15h00min', ordem: 8 },
  ]

  for (const tr of tiposRefeicaoData) {
    await prisma.tipoRefeicao.upsert({
      where: { codigo: tr.codigo },
      update: { nome: tr.nome, horario: tr.horario, ordem: tr.ordem },
      create: tr,
    })
  }
  console.log('    ✓ 8 tipos de refeição')

  // Map codigo → id (for foreign keys)
  const tipoRefeicaoMap: Record<string, string> = {}
  for (const tr of tiposRefeicaoData) {
    const found = await prisma.tipoRefeicao.findUnique({ where: { codigo: tr.codigo } })
    if (found) tipoRefeicaoMap[tr.codigo] = found.id
  }

  // ════════════════════════════════════════════════════════════
  // 2. CATEGORIA REFEIÇÃO (Escola × Refeição)
  // ════════════════════════════════════════════════════════════
  console.log('  → CategoriaRefeicao...')

  const categoriasRefeicaoData = [
    // REGULAR: LANCHE (100% energia)
    { categoria_escola: 'REGULAR', tipo_refeicao_codigo: 'LANCHE', percentual_energia: 100 },
    // INTEGRAL: LANCHE_1 (30%) + LANCHE_2 (30%) = 60%
    { categoria_escola: 'INTEGRAL', tipo_refeicao_codigo: 'LANCHE_1', percentual_energia: 30 },
    { categoria_escola: 'INTEGRAL', tipo_refeicao_codigo: 'LANCHE_2', percentual_energia: 30 },
    // BIFASICA: LANCHE_1 (30%) + LANCHE_2 (30%)
    { categoria_escola: 'BIFASICA', tipo_refeicao_codigo: 'LANCHE_1', percentual_energia: 30 },
    { categoria_escola: 'BIFASICA', tipo_refeicao_codigo: 'LANCHE_2', percentual_energia: 30 },
    // CRECHE: 5 refeições
    { categoria_escola: 'CRECHE', tipo_refeicao_codigo: 'CAFE_MANHA', percentual_energia: 20 },
    { categoria_escola: 'CRECHE', tipo_refeicao_codigo: 'FRUTA_MANHA', percentual_energia: 10 },
    { categoria_escola: 'CRECHE', tipo_refeicao_codigo: 'ALMOCO', percentual_energia: 30 },
    { categoria_escola: 'CRECHE', tipo_refeicao_codigo: 'HIDRATACAO', percentual_energia: 5 },
    { categoria_escola: 'CRECHE', tipo_refeicao_codigo: 'JANTAR', percentual_energia: 25 },
    // INTERIOR: 2 refeições
    { categoria_escola: 'INTERIOR', tipo_refeicao_codigo: 'LANCHE', percentual_energia: 30 },
    { categoria_escola: 'INTERIOR', tipo_refeicao_codigo: 'ALMOCO', percentual_energia: 40 },
  ]

  for (const cr of categoriasRefeicaoData) {
    const tipoRefeicaoId = tipoRefeicaoMap[cr.tipo_refeicao_codigo]
    if (!tipoRefeicaoId) {
      console.warn(`    ⚠ TipoRefeicao "${cr.tipo_refeicao_codigo}" não encontrado`)
      continue
    }
    await prisma.categoriaRefeicao.upsert({
      where: {
        categoria_escola_tipo_refeicao_id: {
          categoria_escola: cr.categoria_escola,
          tipo_refeicao_id: tipoRefeicaoId,
        },
      },
      update: { percentual_energia: cr.percentual_energia },
      create: {
        categoria_escola: cr.categoria_escola,
        tipo_refeicao_id: tipoRefeicaoId,
        percentual_energia: cr.percentual_energia,
      },
    })
  }
  console.log('    ✓ 12 categorias de refeição')

  // ════════════════════════════════════════════════════════════
  // 3. ALIMENTOS (Base TACO — 80 itens)
  // ════════════════════════════════════════════════════════════
  console.log('  → Alimentos (TACO)...')

  const alimentos = [
    // ── Cereais e derivados ───────────────────────────────────
    { codigo_taco: 1, nome: 'Arroz branco cozido', grupo: 'Cereais e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 20, energia_kcal: 130, carboidratos_g: 28.1, proteinas_g: 2.6, lipidios_g: 0.3, fibra_alimentar_g: 0.7, sodio_mg: 1, ferro_mg: 0.3, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 4, magnesio_mg: 9, zinco_mg: 0.5 },
    { codigo_taco: 2, nome: 'Arroz integral cozido', grupo: 'Cereais e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 22, energia_kcal: 112, carboidratos_g: 23.3, proteinas_g: 2.6, lipidios_g: 1.3, fibra_alimentar_g: 1.8, sodio_mg: 3, ferro_mg: 0.4, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 12, magnesio_mg: 44, zinco_mg: 0.6 },
    { codigo_taco: 3, nome: 'Feijão carioca cozido', grupo: 'Cereais e derivados', medida_caseira: '1 concha', gramas_por_medida: 80, energia_kcal: 76, carboidratos_g: 14.2, proteinas_g: 4.8, lipidios_g: 0.5, fibra_alimentar_g: 5.4, sodio_mg: 208, ferro_mg: 1.2, vitamina_a_mcg: 0, vitamina_c_mg: 0.1, calcio_mg: 22, magnesio_mg: 27, zinco_mg: 0.6 },
    { codigo_taco: 4, nome: 'Feijão preto cozido', grupo: 'Cereais e derivados', medida_caseira: '1 concha', gramas_por_medida: 80, energia_kcal: 66, carboidratos_g: 12.3, proteinas_g: 4.5, lipidios_g: 0.5, fibra_alimentar_g: 6.2, sodio_mg: 208, ferro_mg: 1.2, vitamina_a_mcg: 0, vitamina_c_mg: 0.3, calcio_mg: 17, magnesio_mg: 25, zinco_mg: 0.5 },
    { codigo_taco: 5, nome: 'Macarrão cozido', grupo: 'Cereais e derivados', medida_caseira: '1 escumadeira', gramas_por_medida: 120, energia_kcal: 158, carboidratos_g: 30.6, proteinas_g: 5.3, lipidios_g: 0.9, fibra_alimentar_g: 1.4, sodio_mg: 1, ferro_mg: 0.8, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 10, magnesio_mg: 19, zinco_mg: 0.5 },
    { codigo_taco: 6, nome: 'Farinha de trigo', grupo: 'Cereais e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 8, energia_kcal: 336, carboidratos_g: 70.5, proteinas_g: 10.7, lipidios_g: 1.2, fibra_alimentar_g: 2.8, sodio_mg: 2, ferro_mg: 1.5, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 18, magnesio_mg: 27, zinco_mg: 0.7 },
    { codigo_taco: 7, nome: 'Pão francês', grupo: 'Cereais e derivados', medida_caseira: '1 unidade', gramas_por_medida: 50, energia_kcal: 300, carboidratos_g: 58.6, proteinas_g: 8.1, lipidios_g: 2.2, fibra_alimentar_g: 2.1, sodio_mg: 644, ferro_mg: 1.6, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 34, magnesio_mg: 21, zinco_mg: 0.6 },
    { codigo_taco: 8, nome: 'Pão integral', grupo: 'Cereais e derivados', medida_caseira: '1 fatia', gramas_por_medida: 30, energia_kcal: 259, carboidratos_g: 47.8, proteinas_g: 9.2, lipidios_g: 3.5, fibra_alimentar_g: 5.7, sodio_mg: 476, ferro_mg: 2.1, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 49, magnesio_mg: 60, zinco_mg: 1.1 },
    { codigo_taco: 9, nome: 'Milho cozido', grupo: 'Cereais e derivados', medida_caseira: '1 espiga', gramas_por_medida: 150, energia_kcal: 96, carboidratos_g: 18.3, proteinas_g: 3.2, lipidios_g: 1.4, fibra_alimentar_g: 2.4, sodio_mg: 1, ferro_mg: 0.4, vitamina_a_mcg: 7, vitamina_c_mg: 4.5, calcio_mg: 2, magnesio_mg: 24, zinco_mg: 0.5 },
    { codigo_taco: 10, nome: 'Aveia', grupo: 'Cereais e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 12, energia_kcal: 387, carboidratos_g: 66.1, proteinas_g: 13.5, lipidios_g: 6.9, fibra_alimentar_g: 9.1, sodio_mg: 4, ferro_mg: 4.5, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 52, magnesio_mg: 129, zinco_mg: 3.3 },

    // ── Leguminosas e derivados ───────────────────────────────
    { codigo_taco: 11, nome: 'Lentilha cozida', grupo: 'Leguminosas e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 18, energia_kcal: 116, carboidratos_g: 20.1, proteinas_g: 9.0, lipidios_g: 0.4, fibra_alimentar_g: 7.9, sodio_mg: 3, ferro_mg: 3.3, vitamina_a_mcg: 1, vitamina_c_mg: 1.2, calcio_mg: 19, magnesio_mg: 36, zinco_mg: 1.2 },
    { codigo_taco: 12, nome: 'Grão-de-bico cozido', grupo: 'Leguminosas e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 18, energia_kcal: 122, carboidratos_g: 20.5, proteinas_g: 6.3, lipidios_g: 2.0, fibra_alimentar_g: 6.5, sodio_mg: 185, ferro_mg: 2.5, vitamina_a_mcg: 3, vitamina_c_mg: 0.8, calcio_mg: 30, magnesio_mg: 33, zinco_mg: 0.9 },

    // ── Verduras e hortaliças ─────────────────────────────────
    { codigo_taco: 13, nome: 'Alface', grupo: 'Verduras e hortaliças', medida_caseira: '1 folha grande', gramas_por_medida: 15, energia_kcal: 14, carboidratos_g: 2.1, proteinas_g: 0.8, lipidios_g: 0.2, fibra_alimentar_g: 1.0, sodio_mg: 7, ferro_mg: 0.4, vitamina_a_mcg: 275, vitamina_c_mg: 6.2, calcio_mg: 20, magnesio_mg: 6, zinco_mg: 0.1 },
    { codigo_taco: 14, nome: 'Cenoura crua', grupo: 'Verduras e hortaliças', medida_caseira: '1 colher de sopa ralada', gramas_por_medida: 12, energia_kcal: 41, carboidratos_g: 9.6, proteinas_g: 0.9, lipidios_g: 0.2, fibra_alimentar_g: 2.4, sodio_mg: 56, ferro_mg: 0.3, vitamina_a_mcg: 1833, vitamina_c_mg: 4.7, calcio_mg: 28, magnesio_mg: 11, zinco_mg: 0.2 },
    { codigo_taco: 15, nome: 'Couve refogada', grupo: 'Verduras e hortaliças', medida_caseira: '1 colher de sopa', gramas_por_medida: 20, energia_kcal: 36, carboidratos_g: 4.1, proteinas_g: 1.7, lipidios_g: 1.3, fibra_alimentar_g: 2.1, sodio_mg: 268, ferro_mg: 0.6, vitamina_a_mcg: 550, vitamina_c_mg: 52, calcio_mg: 72, magnesio_mg: 14, zinco_mg: 0.2 },
    { codigo_taco: 16, nome: 'Brócolis cozido', grupo: 'Verduras e hortaliças', medida_caseira: '1 ramo', gramas_por_medida: 30, energia_kcal: 35, carboidratos_g: 5.2, proteinas_g: 2.8, lipidios_g: 0.4, fibra_alimentar_g: 2.6, sodio_mg: 28, ferro_mg: 0.5, vitamina_a_mcg: 60, vitamina_c_mg: 44, calcio_mg: 40, magnesio_mg: 17, zinco_mg: 0.3 },
    { codigo_taco: 17, nome: 'Abóbora cozida', grupo: 'Verduras e hortaliças', medida_caseira: '1 colher de sopa', gramas_por_medida: 20, energia_kcal: 38, carboidratos_g: 8.7, proteinas_g: 0.8, lipidios_g: 0.2, fibra_alimentar_g: 1.3, sodio_mg: 1, ferro_mg: 0.3, vitamina_a_mcg: 526, vitamina_c_mg: 3.6, calcio_mg: 14, magnesio_mg: 9, zinco_mg: 0.1 },
    { codigo_taco: 18, nome: 'Beterraba crua', grupo: 'Verduras e hortaliças', medida_caseira: '1 fatia', gramas_por_medida: 25, energia_kcal: 40, carboidratos_g: 8.8, proteinas_g: 1.4, lipidios_g: 0.1, fibra_alimentar_g: 2.8, sodio_mg: 64, ferro_mg: 0.7, vitamina_a_mcg: 2, vitamina_c_mg: 3.6, calcio_mg: 14, magnesio_mg: 20, zinco_mg: 0.3 },
    { codigo_taco: 19, nome: 'Chuchu cozido', grupo: 'Verduras e hortaliças', medida_caseira: '1 colher de sopa', gramas_por_medida: 20, energia_kcal: 17, carboidratos_g: 3.9, proteinas_g: 0.5, lipidios_g: 0.1, fibra_alimentar_g: 1.0, sodio_mg: 1, ferro_mg: 0.2, vitamina_a_mcg: 0, vitamina_c_mg: 4.5, calcio_mg: 8, magnesio_mg: 6, zinco_mg: 0.1 },
    { codigo_taco: 20, nome: 'Repolho refogado', grupo: 'Verduras e hortaliças', medida_caseira: '1 colher de sopa', gramas_por_medida: 20, energia_kcal: 21, carboidratos_g: 3.2, proteinas_g: 0.8, lipidios_g: 0.4, fibra_alimentar_g: 1.3, sodio_mg: 116, ferro_mg: 0.3, vitamina_a_mcg: 40, vitamina_c_mg: 20, calcio_mg: 26, magnesio_mg: 7, zinco_mg: 0.1 },
    { codigo_taco: 21, nome: 'Espinafre refogado', grupo: 'Verduras e hortaliças', medida_caseira: '1 colher de sopa', gramas_por_medida: 18, energia_kcal: 32, carboidratos_g: 2.0, proteinas_g: 2.4, lipidios_g: 1.5, fibra_alimentar_g: 1.7, sodio_mg: 320, ferro_mg: 1.8, vitamina_a_mcg: 469, vitamina_c_mg: 9.8, calcio_mg: 69, magnesio_mg: 50, zinco_mg: 0.4 },
    { codigo_taco: 22, nome: 'Mandioca cozida', grupo: 'Verduras e hortaliças', medida_caseira: '1 pedaço', gramas_por_medida: 60, energia_kcal: 125, carboidratos_g: 29.8, proteinas_g: 0.9, lipidios_g: 0.2, fibra_alimentar_g: 1.7, sodio_mg: 2, ferro_mg: 0.4, vitamina_a_mcg: 0, vitamina_c_mg: 11.5, calcio_mg: 10, magnesio_mg: 17, zinco_mg: 0.2 },

    // ── Frutas ────────────────────────────────────────────────
    { codigo_taco: 23, nome: 'Banana prata', grupo: 'Frutas', medida_caseira: '1 unidade', gramas_por_medida: 90, energia_kcal: 89, carboidratos_g: 22.3, proteinas_g: 1.2, lipidios_g: 0.2, fibra_alimentar_g: 1.4, sodio_mg: 1, ferro_mg: 0.2, vitamina_a_mcg: 5, vitamina_c_mg: 3.7, calcio_mg: 3, magnesio_mg: 25, zinco_mg: 0.1 },
    { codigo_taco: 24, nome: 'Maçã', grupo: 'Frutas', medida_caseira: '1 unidade', gramas_por_medida: 130, energia_kcal: 52, carboidratos_g: 13.4, proteinas_g: 0.3, lipidios_g: 0.2, fibra_alimentar_g: 1.8, sodio_mg: 1, ferro_mg: 0.1, vitamina_a_mcg: 2, vitamina_c_mg: 5.2, calcio_mg: 4, magnesio_mg: 4, zinco_mg: 0 },
    { codigo_taco: 25, nome: 'Laranja', grupo: 'Frutas', medida_caseira: '1 unidade', gramas_por_medida: 170, energia_kcal: 47, carboidratos_g: 11.5, proteinas_g: 0.8, lipidios_g: 0.1, fibra_alimentar_g: 2.0, sodio_mg: 2, ferro_mg: 0.1, vitamina_a_mcg: 28, vitamina_c_mg: 51, calcio_mg: 22, magnesio_mg: 8, zinco_mg: 0.1 },
    { codigo_taco: 26, nome: 'Mamão papaia', grupo: 'Frutas', medida_caseira: '1 fatia', gramas_por_medida: 100, energia_kcal: 32, carboidratos_g: 7.2, proteinas_g: 0.5, lipidios_g: 0.1, fibra_alimentar_g: 1.0, sodio_mg: 2, ferro_mg: 0.2, vitamina_a_mcg: 126, vitamina_c_mg: 61.8, calcio_mg: 21, magnesio_mg: 10, zinco_mg: 0.1 },
    { codigo_taco: 27, nome: 'Melancia', grupo: 'Frutas', medida_caseira: '1 fatia', gramas_por_medida: 150, energia_kcal: 30, carboidratos_g: 7.2, proteinas_g: 0.4, lipidios_g: 0.1, fibra_alimentar_g: 0.3, sodio_mg: 1, ferro_mg: 0.1, vitamina_a_mcg: 21, vitamina_c_mg: 5.3, calcio_mg: 5, magnesio_mg: 8, zinco_mg: 0 },
    { codigo_taco: 28, nome: 'Abacaxi', grupo: 'Frutas', medida_caseira: '1 fatia', gramas_por_medida: 80, energia_kcal: 48, carboidratos_g: 12.4, proteinas_g: 0.5, lipidios_g: 0.1, fibra_alimentar_g: 0.9, sodio_mg: 2, ferro_mg: 0.2, vitamina_a_mcg: 3, vitamina_c_mg: 19.5, calcio_mg: 10, magnesio_mg: 9, zinco_mg: 0.1 },
    { codigo_taco: 29, nome: 'Manga', grupo: 'Frutas', medida_caseira: '1 unidade pequena', gramas_por_medida: 100, energia_kcal: 54, carboidratos_g: 13.3, proteinas_g: 0.6, lipidios_g: 0.2, fibra_alimentar_g: 1.4, sodio_mg: 2, ferro_mg: 0.1, vitamina_a_mcg: 525, vitamina_c_mg: 23, calcio_mg: 9, magnesio_mg: 8, zinco_mg: 0 },
    { codigo_taco: 30, nome: 'Goiaba', grupo: 'Frutas', medida_caseira: '1 unidade média', gramas_por_medida: 80, energia_kcal: 54, carboidratos_g: 12.3, proteinas_g: 1.0, lipidios_g: 0.2, fibra_alimentar_g: 4.4, sodio_mg: 2, ferro_mg: 0.2, vitamina_a_mcg: 232, vitamina_c_mg: 80.6, calcio_mg: 12, magnesio_mg: 9, zinco_mg: 0.2 },
    { codigo_taco: 31, nome: 'Limão', grupo: 'Frutas', medida_caseira: '1 unidade', gramas_por_medida: 50, energia_kcal: 22, carboidratos_g: 6.9, proteinas_g: 0.5, lipidios_g: 0.2, fibra_alimentar_g: 2.1, sodio_mg: 2, ferro_mg: 0.3, vitamina_a_mcg: 1, vitamina_c_mg: 34.3, calcio_mg: 17, magnesio_mg: 6, zinco_mg: 0.1 },
    { codigo_taco: 32, nome: 'Acerola', grupo: 'Frutas', medida_caseira: '1 xícara', gramas_por_medida: 100, energia_kcal: 33, carboidratos_g: 7.5, proteinas_g: 0.7, lipidios_g: 0.4, fibra_alimentar_g: 1.5, sodio_mg: 3, ferro_mg: 0.2, vitamina_a_mcg: 372, vitamina_c_mg: 1200, calcio_mg: 9, magnesio_mg: 11, zinco_mg: 0.1 },

    // ── Carnes e ovos ─────────────────────────────────────────
    { codigo_taco: 33, nome: 'Frango peito grelhado', grupo: 'Carnes e ovos', medida_caseira: '1 filé pequeno', gramas_por_medida: 80, energia_kcal: 162, carboidratos_g: 0, proteinas_g: 31.0, lipidios_g: 2.7, fibra_alimentar_g: 0, sodio_mg: 62, ferro_mg: 0.5, ferro_heme_mg: 0.3, vitamina_a_mcg: 6, vitamina_c_mg: 0, calcio_mg: 11, magnesio_mg: 27, zinco_mg: 0.8 },
    { codigo_taco: 34, nome: 'Frango coxa', grupo: 'Carnes e ovos', medida_caseira: '1 unidade', gramas_por_medida: 70, energia_kcal: 185, carboidratos_g: 0, proteinas_g: 23.4, lipidios_g: 9.3, fibra_alimentar_g: 0, sodio_mg: 62, ferro_mg: 0.8, ferro_heme_mg: 0.4, vitamina_a_mcg: 16, vitamina_c_mg: 0, calcio_mg: 10, magnesio_mg: 19, zinco_mg: 1.2 },
    { codigo_taco: 35, nome: 'Carne bovina patinho', grupo: 'Carnes e ovos', medida_caseira: '1 bife pequeno', gramas_por_medida: 80, energia_kcal: 219, carboidratos_g: 0, proteinas_g: 36.1, lipidios_g: 7.2, fibra_alimentar_g: 0, sodio_mg: 47, ferro_mg: 2.2, ferro_heme_mg: 1.3, vitamina_a_mcg: 4, vitamina_c_mg: 0, calcio_mg: 4, magnesio_mg: 22, zinco_mg: 4.5 },
    { codigo_taco: 36, nome: 'Carne bovina acém', grupo: 'Carnes e ovos', medida_caseira: '1 pedaço', gramas_por_medida: 80, energia_kcal: 254, carboidratos_g: 0, proteinas_g: 27.2, lipidios_g: 15.1, fibra_alimentar_g: 0, sodio_mg: 50, ferro_mg: 1.9, ferro_heme_mg: 1.1, vitamina_a_mcg: 6, vitamina_c_mg: 0, calcio_mg: 5, magnesio_mg: 18, zinco_mg: 3.8 },
    { codigo_taco: 37, nome: 'Carne moída refogada', grupo: 'Carnes e ovos', medida_caseira: '1 colher de sopa', gramas_por_medida: 25, energia_kcal: 254, carboidratos_g: 0, proteinas_g: 27.2, lipidios_g: 15.1, fibra_alimentar_g: 0, sodio_mg: 328, ferro_mg: 1.9, ferro_heme_mg: 1.1, vitamina_a_mcg: 6, vitamina_c_mg: 0, calcio_mg: 5, magnesio_mg: 18, zinco_mg: 3.8 },
    { codigo_taco: 38, nome: 'Fígado bovino', grupo: 'Carnes e ovos', medida_caseira: '1 bife', gramas_por_medida: 70, energia_kcal: 135, carboidratos_g: 0, proteinas_g: 23.1, lipidios_g: 3.4, fibra_alimentar_g: 0, sodio_mg: 63, ferro_mg: 4.7, ferro_heme_mg: 2.8, vitamina_a_mcg: 7380, vitamina_c_mg: 8.3, calcio_mg: 5, magnesio_mg: 16, zinco_mg: 3.1 },
    { codigo_taco: 39, nome: 'Ovo cozido', grupo: 'Carnes e ovos', medida_caseira: '1 unidade', gramas_por_medida: 50, energia_kcal: 147, carboidratos_g: 0.8, proteinas_g: 12.5, lipidios_g: 9.8, fibra_alimentar_g: 0, sodio_mg: 122, ferro_mg: 1.4, ferro_heme_mg: 0.6, vitamina_a_mcg: 189, vitamina_c_mg: 0, calcio_mg: 42, magnesio_mg: 10, zinco_mg: 1 },
    { codigo_taco: 40, nome: 'Sardinha em lata', grupo: 'Carnes e ovos', medida_caseira: '1 unidade', gramas_por_medida: 20, energia_kcal: 186, carboidratos_g: 0, proteinas_g: 20.8, lipidios_g: 10.5, fibra_alimentar_g: 0, sodio_mg: 393, ferro_mg: 1.1, ferro_heme_mg: 0.7, vitamina_a_mcg: 13, vitamina_c_mg: 0, calcio_mg: 314, magnesio_mg: 30, zinco_mg: 1.0 },
    { codigo_taco: 41, nome: 'Peixe tilápia grelhado', grupo: 'Carnes e ovos', medida_caseira: '1 filé', gramas_por_medida: 100, energia_kcal: 128, carboidratos_g: 0, proteinas_g: 25.6, lipidios_g: 2.1, fibra_alimentar_g: 0, sodio_mg: 54, ferro_mg: 0.4, ferro_heme_mg: 0.2, vitamina_a_mcg: 8, vitamina_c_mg: 0, calcio_mg: 9, magnesio_mg: 28, zinco_mg: 0.5 },

    // ── Leite e derivados ─────────────────────────────────────
    { codigo_taco: 42, nome: 'Leite integral', grupo: 'Leite e derivados', medida_caseira: '1 copo', gramas_por_medida: 240, energia_kcal: 61, carboidratos_g: 4.7, proteinas_g: 3.2, lipidios_g: 3.3, fibra_alimentar_g: 0, sodio_mg: 38, ferro_mg: 0, vitamina_a_mcg: 34, vitamina_c_mg: 1.5, calcio_mg: 118, magnesio_mg: 11, zinco_mg: 0.4 },
    { codigo_taco: 43, nome: 'Leite em pó integral', grupo: 'Leite e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 10, energia_kcal: 496, carboidratos_g: 38.1, proteinas_g: 25.8, lipidios_g: 26.7, fibra_alimentar_g: 0, sodio_mg: 320, ferro_mg: 0.3, vitamina_a_mcg: 172, vitamina_c_mg: 5.3, calcio_mg: 920, magnesio_mg: 78, zinco_mg: 3.2 },
    { codigo_taco: 44, nome: 'Queijo muçarela', grupo: 'Leite e derivados', medida_caseira: '1 fatia', gramas_por_medida: 20, energia_kcal: 333, carboidratos_g: 2.8, proteinas_g: 21.8, lipidios_g: 25.6, fibra_alimentar_g: 0, sodio_mg: 573, ferro_mg: 0.3, vitamina_a_mcg: 200, vitamina_c_mg: 0, calcio_mg: 672, magnesio_mg: 22, zinco_mg: 2.4 },
    { codigo_taco: 45, nome: 'Iogurte natural', grupo: 'Leite e derivados', medida_caseira: '1 pote', gramas_por_medida: 170, energia_kcal: 51, carboidratos_g: 3.8, proteinas_g: 4.1, lipidios_g: 2.2, fibra_alimentar_g: 0, sodio_mg: 41, ferro_mg: 0, vitamina_a_mcg: 19, vitamina_c_mg: 0.6, calcio_mg: 134, magnesio_mg: 11, zinco_mg: 0.4 },

    // ── Óleos e gorduras ──────────────────────────────────────
    { codigo_taco: 46, nome: 'Óleo de soja', grupo: 'Óleos e gorduras', medida_caseira: '1 colher de sopa', gramas_por_medida: 12, energia_kcal: 884, carboidratos_g: 0, proteinas_g: 0, lipidios_g: 100, fibra_alimentar_g: 0, sodio_mg: 0, ferro_mg: 0, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 0, magnesio_mg: 0, zinco_mg: 0 },
    { codigo_taco: 47, nome: 'Manteiga', grupo: 'Óleos e gorduras', medida_caseira: '1 colher de chá', gramas_por_medida: 4, energia_kcal: 717, carboidratos_g: 0.1, proteinas_g: 0.8, lipidios_g: 80.7, fibra_alimentar_g: 0, sodio_mg: 536, ferro_mg: 0, vitamina_a_mcg: 671, vitamina_c_mg: 0, calcio_mg: 20, magnesio_mg: 2, zinco_mg: 0 },

    // ── Açúcares e doces ──────────────────────────────────────
    { codigo_taco: 48, nome: 'Açúcar refinado', grupo: 'Açúcares e doces', medida_caseira: '1 colher de sopa', gramas_por_medida: 10, energia_kcal: 387, carboidratos_g: 99.5, proteinas_g: 0, lipidios_g: 0, fibra_alimentar_g: 0, sodio_mg: 0, ferro_mg: 0, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 1, magnesio_mg: 0, zinco_mg: 0, acucar_adicionado_g: 99.5 },
    { codigo_taco: 49, nome: 'Mel', grupo: 'Açúcares e doces', medida_caseira: '1 colher de sopa', gramas_por_medida: 15, energia_kcal: 321, carboidratos_g: 81.8, proteinas_g: 0.3, lipidios_g: 0, fibra_alimentar_g: 0.2, sodio_mg: 3, ferro_mg: 0.2, vitamina_a_mcg: 0, vitamina_c_mg: 0.9, calcio_mg: 5, magnesio_mg: 2, zinco_mg: 0.1, acucar_adicionado_g: 81.8 },

    // ── Bebidas ───────────────────────────────────────────────
    { codigo_taco: 50, nome: 'Café infusão', grupo: 'Bebidas', medida_caseira: '1 xícara', gramas_por_medida: 50, energia_kcal: 1, carboidratos_g: 0.1, proteinas_g: 0.1, lipidios_g: 0, fibra_alimentar_g: 0, sodio_mg: 1, ferro_mg: 0, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 1, magnesio_mg: 1, zinco_mg: 0 },
    { codigo_taco: 51, nome: 'Suco de laranja natural', grupo: 'Bebidas', medida_caseira: '1 copo', gramas_por_medida: 200, energia_kcal: 40, carboidratos_g: 9.2, proteinas_g: 0.6, lipidios_g: 0.1, fibra_alimentar_g: 0.2, sodio_mg: 1, ferro_mg: 0.1, vitamina_a_mcg: 11, vitamina_c_mg: 38.3, calcio_mg: 7, magnesio_mg: 8, zinco_mg: 0.1 },
    { codigo_taco: 52, nome: 'Suco de abacaxi natural', grupo: 'Bebidas', medida_caseira: '1 copo', gramas_por_medida: 200, energia_kcal: 46, carboidratos_g: 11.3, proteinas_g: 0.4, lipidios_g: 0.1, fibra_alimentar_g: 0.2, sodio_mg: 1, ferro_mg: 0.2, vitamina_a_mcg: 2, vitamina_c_mg: 24.5, calcio_mg: 7, magnesio_mg: 6, zinco_mg: 0.1 },
    { codigo_taco: 53, nome: 'Chá mate infusão', grupo: 'Bebidas', medida_caseira: '1 xícara', gramas_por_medida: 50, energia_kcal: 1, carboidratos_g: 0.2, proteinas_g: 0, lipidios_g: 0, fibra_alimentar_g: 0, sodio_mg: 3, ferro_mg: 0, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 2, magnesio_mg: 2, zinco_mg: 0 },

    // ── Outros ────────────────────────────────────────────────
    { codigo_taco: 54, nome: 'Sal', grupo: 'Outros', medida_caseira: '1 pitada', gramas_por_medida: 1, energia_kcal: 0, carboidratos_g: 0, proteinas_g: 0, lipidios_g: 0, fibra_alimentar_g: 0, sodio_mg: 387500, ferro_mg: 0, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 24, magnesio_mg: 1, zinco_mg: 0.1 },
    { codigo_taco: 55, nome: 'Caldo de galinha', grupo: 'Outros', medida_caseira: '1 cubo', gramas_por_medida: 5, energia_kcal: 52, carboidratos_g: 4.2, proteinas_g: 2.2, lipidios_g: 2.8, fibra_alimentar_g: 0, sodio_mg: 19200, ferro_mg: 0.1, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 8, magnesio_mg: 3, zinco_mg: 0 },

    // ── Mais Cereais / Tuberosos ──────────────────────────────
    { codigo_taco: 56, nome: 'Batata doce cozida', grupo: 'Cereais e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 20, energia_kcal: 78, carboidratos_g: 18.1, proteinas_g: 0.8, lipidios_g: 0.1, fibra_alimentar_g: 1.2, sodio_mg: 16, ferro_mg: 0.3, vitamina_a_mcg: 468, vitamina_c_mg: 11, calcio_mg: 19, magnesio_mg: 11, zinco_mg: 0.2 },
    { codigo_taco: 57, nome: 'Batata inglesa cozida', grupo: 'Cereais e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 20, energia_kcal: 72, carboidratos_g: 16.3, proteinas_g: 1.8, lipidios_g: 0.1, fibra_alimentar_g: 1.0, sodio_mg: 3, ferro_mg: 0.3, vitamina_a_mcg: 0, vitamina_c_mg: 8.5, calcio_mg: 5, magnesio_mg: 17, zinco_mg: 0.2 },
    { codigo_taco: 58, nome: 'Inhame cozido', grupo: 'Cereais e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 20, energia_kcal: 96, carboidratos_g: 22.4, proteinas_g: 1.4, lipidios_g: 0.1, fibra_alimentar_g: 1.5, sodio_mg: 2, ferro_mg: 0.4, vitamina_a_mcg: 2, vitamina_c_mg: 5.7, calcio_mg: 9, magnesio_mg: 14, zinco_mg: 0.2 },

    // ── Mais Carnes ───────────────────────────────────────────
    { codigo_taco: 59, nome: 'Salsicha', grupo: 'Carnes e ovos', medida_caseira: '1 unidade', gramas_por_medida: 35, energia_kcal: 290, carboidratos_g: 2.3, proteinas_g: 12.2, lipidios_g: 26.7, fibra_alimentar_g: 0, sodio_mg: 856, ferro_mg: 0.7, ferro_heme_mg: 0.3, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 7, magnesio_mg: 8, zinco_mg: 0.9 },
    { codigo_taco: 60, nome: 'Presunto', grupo: 'Carnes e ovos', medida_caseira: '1 fatia', gramas_por_medida: 15, energia_kcal: 145, carboidratos_g: 1.7, proteinas_g: 17.4, lipidios_g: 7.6, fibra_alimentar_g: 0, sodio_mg: 1012, ferro_mg: 0.5, ferro_heme_mg: 0.2, vitamina_a_mcg: 0, vitamina_c_mg: 9.5, calcio_mg: 5, magnesio_mg: 14, zinco_mg: 1.4 },
    { codigo_taco: 61, nome: 'Mortadela', grupo: 'Carnes e ovos', medida_caseira: '1 fatia', gramas_por_medida: 15, energia_kcal: 284, carboidratos_g: 3.3, proteinas_g: 11.7, lipidios_g: 25.3, fibra_alimentar_g: 0, sodio_mg: 817, ferro_mg: 0.7, ferro_heme_mg: 0.2, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 6, magnesio_mg: 9, zinco_mg: 0.9 },

    // ── Mais Verduras / Legumes ───────────────────────────────
    { codigo_taco: 62, nome: 'Tomate', grupo: 'Verduras e hortaliças', medida_caseira: '1 fatia', gramas_por_medida: 15, energia_kcal: 17, carboidratos_g: 3.5, proteinas_g: 0.8, lipidios_g: 0.2, fibra_alimentar_g: 0.9, sodio_mg: 3, ferro_mg: 0.2, vitamina_a_mcg: 55, vitamina_c_mg: 12.7, calcio_mg: 6, magnesio_mg: 8, zinco_mg: 0.1 },
    { codigo_taco: 63, nome: 'Pepino', grupo: 'Verduras e hortaliças', medida_caseira: '1 fatia', gramas_por_medida: 10, energia_kcal: 13, carboidratos_g: 2.8, proteinas_g: 0.5, lipidios_g: 0.2, fibra_alimentar_g: 0.4, sodio_mg: 1, ferro_mg: 0.2, vitamina_a_mcg: 9, vitamina_c_mg: 3.5, calcio_mg: 12, magnesio_mg: 8, zinco_mg: 0.1 },
    { codigo_taco: 64, nome: 'Abobrinha cozida', grupo: 'Verduras e hortaliças', medida_caseira: '1 colher de sopa', gramas_por_medida: 18, energia_kcal: 14, carboidratos_g: 2.6, proteinas_g: 0.8, lipidios_g: 0.2, fibra_alimentar_g: 0.9, sodio_mg: 2, ferro_mg: 0.2, vitamina_a_mcg: 22, vitamina_c_mg: 8.7, calcio_mg: 13, magnesio_mg: 10, zinco_mg: 0.1 },
    { codigo_taco: 65, nome: 'Vagem cozida', grupo: 'Verduras e hortaliças', medida_caseira: '1 colher de sopa', gramas_por_medida: 15, energia_kcal: 24, carboidratos_g: 4.8, proteinas_g: 1.6, lipidios_g: 0.2, fibra_alimentar_g: 1.8, sodio_mg: 2, ferro_mg: 0.5, vitamina_a_mcg: 25, vitamina_c_mg: 6.5, calcio_mg: 24, magnesio_mg: 13, zinco_mg: 0.2 },
    { codigo_taco: 66, nome: 'Cebola crua', grupo: 'Verduras e hortaliças', medida_caseira: '1 fatia', gramas_por_medida: 10, energia_kcal: 36, carboidratos_g: 8.0, proteinas_g: 1.0, lipidios_g: 0.1, fibra_alimentar_g: 1.4, sodio_mg: 3, ferro_mg: 0.2, vitamina_a_mcg: 1, vitamina_c_mg: 5.4, calcio_mg: 20, magnesio_mg: 9, zinco_mg: 0.2 },
    { codigo_taco: 67, nome: 'Alho cru', grupo: 'Verduras e hortaliças', medida_caseira: '1 dente', gramas_por_medida: 3, energia_kcal: 149, carboidratos_g: 33.0, proteinas_g: 6.4, lipidios_g: 0.5, fibra_alimentar_g: 2.1, sodio_mg: 17, ferro_mg: 1.2, vitamina_a_mcg: 0, vitamina_c_mg: 31.2, calcio_mg: 181, magnesio_mg: 25, zinco_mg: 1.2 },

    // ── Mais Frutas ──────────────────────────────────────────
    { codigo_taco: 68, nome: 'Pera', grupo: 'Frutas', medida_caseira: '1 unidade', gramas_por_medida: 130, energia_kcal: 53, carboidratos_g: 13.1, proteinas_g: 0.4, lipidios_g: 0.1, fibra_alimentar_g: 2.2, sodio_mg: 1, ferro_mg: 0.1, vitamina_a_mcg: 1, vitamina_c_mg: 3.4, calcio_mg: 7, magnesio_mg: 6, zinco_mg: 0 },
    { codigo_taco: 69, nome: 'Uva', grupo: 'Frutas', medida_caseira: '1 cacho pequeno', gramas_por_medida: 80, energia_kcal: 67, carboidratos_g: 16.8, proteinas_g: 0.6, lipidios_g: 0.2, fibra_alimentar_g: 0.6, sodio_mg: 1, ferro_mg: 0.2, vitamina_a_mcg: 3, vitamina_c_mg: 2.9, calcio_mg: 5, magnesio_mg: 5, zinco_mg: 0 },
    { codigo_taco: 70, nome: 'Caqui', grupo: 'Frutas', medida_caseira: '1 unidade', gramas_por_medida: 100, energia_kcal: 70, carboidratos_g: 17.6, proteinas_g: 0.5, lipidios_g: 0.2, fibra_alimentar_g: 1.5, sodio_mg: 1, ferro_mg: 0.1, vitamina_a_mcg: 275, vitamina_c_mg: 7.5, calcio_mg: 6, magnesio_mg: 7, zinco_mg: 0 },
    { codigo_taco: 71, nome: 'Maracujá', grupo: 'Frutas', medida_caseira: '1 unidade', gramas_por_medida: 30, energia_kcal: 68, carboidratos_g: 14.6, proteinas_g: 1.8, lipidios_g: 0.7, fibra_alimentar_g: 3.1, sodio_mg: 4, ferro_mg: 0.4, vitamina_a_mcg: 42, vitamina_c_mg: 19.8, calcio_mg: 6, magnesio_mg: 16, zinco_mg: 0.2 },

    // ── Mais Leite / Derivados ────────────────────────────────
    { codigo_taco: 72, nome: 'Queijo prato', grupo: 'Leite e derivados', medida_caseira: '1 fatia', gramas_por_medida: 20, energia_kcal: 345, carboidratos_g: 1.8, proteinas_g: 22.7, lipidios_g: 27.1, fibra_alimentar_g: 0, sodio_mg: 610, ferro_mg: 0.2, vitamina_a_mcg: 293, vitamina_c_mg: 0, calcio_mg: 648, magnesio_mg: 19, zinco_mg: 2.5 },
    { codigo_taco: 73, nome: 'Requeijão', grupo: 'Leite e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 15, energia_kcal: 296, carboidratos_g: 4.2, proteinas_g: 10.2, lipidios_g: 27.5, fibra_alimentar_g: 0, sodio_mg: 478, ferro_mg: 0.1, vitamina_a_mcg: 200, vitamina_c_mg: 0, calcio_mg: 364, magnesio_mg: 12, zinco_mg: 1.2 },
    { codigo_taco: 74, nome: 'Leite em pó desnatado', grupo: 'Leite e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 10, energia_kcal: 358, carboidratos_g: 51.3, proteinas_g: 35.5, lipidios_g: 0.7, fibra_alimentar_g: 0, sodio_mg: 410, ferro_mg: 0.2, vitamina_a_mcg: 2, vitamina_c_mg: 4.7, calcio_mg: 1238, magnesio_mg: 99, zinco_mg: 3.6 },

    // ── Farinhas e derivados ──────────────────────────────────
    { codigo_taco: 75, nome: 'Farinha de milho (fubá)', grupo: 'Cereais e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 8, energia_kcal: 355, carboidratos_g: 74.6, proteinas_g: 7.3, lipidios_g: 2.1, fibra_alimentar_g: 2.8, sodio_mg: 1, ferro_mg: 1.3, vitamina_a_mcg: 30, vitamina_c_mg: 0, calcio_mg: 4, magnesio_mg: 40, zinco_mg: 0.9 },
    { codigo_taco: 76, nome: 'Farinha de mandioca', grupo: 'Cereais e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 8, energia_kcal: 343, carboidratos_g: 85.2, proteinas_g: 1.2, lipidios_g: 0.4, fibra_alimentar_g: 2.6, sodio_mg: 3, ferro_mg: 0.7, vitamina_a_mcg: 0, vitamina_c_mg: 4.3, calcio_mg: 24, magnesio_mg: 20, zinco_mg: 0.3 },
    { codigo_taco: 77, nome: 'Polenta cozida', grupo: 'Cereais e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 20, energia_kcal: 84, carboidratos_g: 17.7, proteinas_g: 1.7, lipidios_g: 0.5, fibra_alimentar_g: 0.7, sodio_mg: 163, ferro_mg: 0.3, vitamina_a_mcg: 7, vitamina_c_mg: 0, calcio_mg: 1, magnesio_mg: 10, zinco_mg: 0.2 },

    // ── Proteína vegetal ──────────────────────────────────────
    { codigo_taco: 78, nome: 'Soja grão cozido', grupo: 'Leguminosas e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 15, energia_kcal: 172, carboidratos_g: 8.5, proteinas_g: 16.6, lipidios_g: 8.6, fibra_alimentar_g: 5.5, sodio_mg: 1, ferro_mg: 5.1, vitamina_a_mcg: 1, vitamina_c_mg: 0, calcio_mg: 102, magnesio_mg: 74, zinco_mg: 1.2 },
    { codigo_taco: 79, nome: 'Proteína texturizada de soja', grupo: 'Leguminosas e derivados', medida_caseira: '1 colher de sopa', gramas_por_medida: 12, energia_kcal: 333, carboidratos_g: 29.6, proteinas_g: 52.0, lipidios_g: 1.2, fibra_alimentar_g: 7.3, sodio_mg: 5, ferro_mg: 7.8, vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 210, magnesio_mg: 140, zinco_mg: 3.5 },
    { codigo_taco: 80, nome: 'Tofu', grupo: 'Leguminosas e derivados', medida_caseira: '1 fatia', gramas_por_medida: 30, energia_kcal: 72, carboidratos_g: 1.2, proteinas_g: 7.0, lipidios_g: 4.1, fibra_alimentar_g: 0.3, sodio_mg: 4, ferro_mg: 1.2, vitamina_a_mcg: 0, vitamina_c_mg: 0.1, calcio_mg: 117, magnesio_mg: 23, zinco_mg: 0.5 },
  ]

  let alimentosCount = 0
  for (const alimento of alimentos) {
    await upsertAlimento(alimento)
    alimentosCount++
  }
  console.log(`    ✓ ${alimentosCount} alimentos`)

  // ════════════════════════════════════════════════════════════
  // 4. META NUTRICIONAL PNAE
  // ════════════════════════════════════════════════════════════
  console.log('  → MetaNutricional...')

  // Macro % ranges (same for all categories per PNAE guidelines)
  const carbPctMin = 55
  const carbPctMax = 75
  const protPctMin = 10
  const protPctMax = 15
  const lipPctMin = 15
  const lipPctMax = 30

  const metasNutricionaisData = [
    // ── REGULAR (LANCHE — 1 refeição, ~20% energia diária) ────
    {
      tipo_refeicao_codigo: 'LANCHE' as const,
      categoria_escola: 'REGULAR',
      energia_kcal_min: 350,
      energia_kcal_max: 550,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 400,
      ferro_mg_min: 1.2,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 120,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 8,
      acucar_pct_max: 7,
      acucar_proibido_menor3: true,
    },

    // ── INTEGRAL (LANCHE_1 + LANCHE_2, cada ~15-20%) ──────────
    {
      tipo_refeicao_codigo: 'LANCHE_1' as const,
      categoria_escola: 'INTEGRAL',
      energia_kcal_min: 250,
      energia_kcal_max: 400,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 300,
      ferro_mg_min: 1.0,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 80,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 6,
      acucar_pct_max: 7,
      acucar_proibido_menor3: true,
    },
    {
      tipo_refeicao_codigo: 'LANCHE_2' as const,
      categoria_escola: 'INTEGRAL',
      energia_kcal_min: 250,
      energia_kcal_max: 400,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 300,
      ferro_mg_min: 1.0,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 80,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 6,
      acucar_pct_max: 7,
      acucar_proibido_menor3: true,
    },

    // ── CRECHE (5 refeições) ──────────────────────────────────
    {
      tipo_refeicao_codigo: 'CAFE_MANHA' as const,
      categoria_escola: 'CRECHE',
      energia_kcal_min: 150,
      energia_kcal_max: 250,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 200,
      ferro_mg_min: 0.8,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 80,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 5,
      acucar_pct_max: 0,
      acucar_proibido_menor3: true,
    },
    {
      tipo_refeicao_codigo: 'FRUTA_MANHA' as const,
      categoria_escola: 'CRECHE',
      energia_kcal_min: 60,
      energia_kcal_max: 120,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 50,
      ferro_mg_min: 0.3,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 50,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 15,
      acucar_pct_max: 0,
      acucar_proibido_menor3: true,
    },
    {
      tipo_refeicao_codigo: 'ALMOCO' as const,
      categoria_escola: 'CRECHE',
      energia_kcal_min: 300,
      energia_kcal_max: 500,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 400,
      ferro_mg_min: 1.5,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 150,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 10,
      acucar_pct_max: 5,
      acucar_proibido_menor3: true,
    },
    {
      tipo_refeicao_codigo: 'HIDRATACAO' as const,
      categoria_escola: 'CRECHE',
      energia_kcal_min: 30,
      energia_kcal_max: 80,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 100,
      ferro_mg_min: 0.1,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 10,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 5,
      acucar_pct_max: 0,
      acucar_proibido_menor3: true,
    },
    {
      tipo_refeicao_codigo: 'JANTAR' as const,
      categoria_escola: 'CRECHE',
      energia_kcal_min: 250,
      energia_kcal_max: 400,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 300,
      ferro_mg_min: 1.0,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 100,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 8,
      acucar_pct_max: 5,
      acucar_proibido_menor3: true,
    },

    // ── INTERIOR (2 refeições) ────────────────────────────────
    {
      tipo_refeicao_codigo: 'LANCHE' as const,
      categoria_escola: 'INTERIOR',
      energia_kcal_min: 200,
      energia_kcal_max: 350,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 300,
      ferro_mg_min: 0.8,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 80,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 6,
      acucar_pct_max: 7,
      acucar_proibido_menor3: true,
    },
    {
      tipo_refeicao_codigo: 'ALMOCO' as const,
      categoria_escola: 'INTERIOR',
      energia_kcal_min: 450,
      energia_kcal_max: 650,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 450,
      ferro_mg_min: 1.5,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 150,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 12,
      acucar_pct_max: 5,
      acucar_proibido_menor3: true,
    },

    // ── BIFÁSICA (2 lanches) ──────────────────────────────────
    {
      tipo_refeicao_codigo: 'LANCHE_1' as const,
      categoria_escola: 'BIFASICA',
      energia_kcal_min: 250,
      energia_kcal_max: 400,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 300,
      ferro_mg_min: 1.0,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 80,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 6,
      acucar_pct_max: 7,
      acucar_proibido_menor3: true,
    },
    {
      tipo_refeicao_codigo: 'LANCHE_2' as const,
      categoria_escola: 'BIFASICA',
      energia_kcal_min: 250,
      energia_kcal_max: 400,
      carboidratos_pct_min: carbPctMin,
      carboidratos_pct_max: carbPctMax,
      proteinas_pct_min: protPctMin,
      proteinas_pct_max: protPctMax,
      lipidios_pct_min: lipPctMin,
      lipidios_pct_max: lipPctMax,
      sodio_mg_max: 300,
      ferro_mg_min: 1.0,
      ferro_heme_dias_semana: 4,
      vitamina_a_mcg_min: 80,
      vitamina_a_dias_semana: 3,
      vitamina_c_mg_min: 6,
      acucar_pct_max: 7,
      acucar_proibido_menor3: true,
    },
  ]

  let metasCount = 0
  for (const meta of metasNutricionaisData) {
    const tipoRefeicaoId = tipoRefeicaoMap[meta.tipo_refeicao_codigo]
    if (!tipoRefeicaoId) {
      console.warn(`    ⚠ TipoRefeicao "${meta.tipo_refeicao_codigo}" não encontrado para meta`)
      continue
    }
    await prisma.metaNutricional.upsert({
      where: {
        tipo_refeicao_id_categoria_escola: {
          tipo_refeicao_id: tipoRefeicaoId,
          categoria_escola: meta.categoria_escola,
        },
      },
      update: {
        energia_kcal_min: meta.energia_kcal_min,
        energia_kcal_max: meta.energia_kcal_max,
        carboidratos_pct_min: meta.carboidratos_pct_min,
        carboidratos_pct_max: meta.carboidratos_pct_max,
        proteinas_pct_min: meta.proteinas_pct_min,
        proteinas_pct_max: meta.proteinas_pct_max,
        lipidios_pct_min: meta.lipidios_pct_min,
        lipidios_pct_max: meta.lipidios_pct_max,
        sodio_mg_max: meta.sodio_mg_max,
        ferro_mg_min: meta.ferro_mg_min,
        ferro_heme_dias_semana: meta.ferro_heme_dias_semana,
        vitamina_a_mcg_min: meta.vitamina_a_mcg_min,
        vitamina_a_dias_semana: meta.vitamina_a_dias_semana,
        vitamina_c_mg_min: meta.vitamina_c_mg_min,
        acucar_pct_max: meta.acucar_pct_max,
        acucar_proibido_menor3: meta.acucar_proibido_menor3,
      },
      create: {
        tipo_refeicao_id: tipoRefeicaoId,
        categoria_escola: meta.categoria_escola,
        energia_kcal_min: meta.energia_kcal_min,
        energia_kcal_max: meta.energia_kcal_max,
        carboidratos_pct_min: meta.carboidratos_pct_min,
        carboidratos_pct_max: meta.carboidratos_pct_max,
        proteinas_pct_min: meta.proteinas_pct_min,
        proteinas_pct_max: meta.proteinas_pct_max,
        lipidios_pct_min: meta.lipidios_pct_min,
        lipidios_pct_max: meta.lipidios_pct_max,
        sodio_mg_max: meta.sodio_mg_max,
        ferro_mg_min: meta.ferro_mg_min,
        ferro_heme_dias_semana: meta.ferro_heme_dias_semana,
        vitamina_a_mcg_min: meta.vitamina_a_mcg_min,
        vitamina_a_dias_semana: meta.vitamina_a_dias_semana,
        vitamina_c_mg_min: meta.vitamina_c_mg_min,
        acucar_pct_max: meta.acucar_pct_max,
        acucar_proibido_menor3: meta.acucar_proibido_menor3,
      },
    })
    metasCount++
  }
  console.log(`    ✓ ${metasCount} metas nutricionais`)

  console.log('✅ Seed-nutricao concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('Erro no seed-nutricao:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
