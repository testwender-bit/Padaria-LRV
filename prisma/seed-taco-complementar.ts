// ============================================================
// seed-taco-complementar.ts
// ============================================================
// Adiciona alimentos brasileiros comuns que FALTAM na TACO
// (tomate, pepino, azeite, manjericão, batata-doce, etc.)
//
// Fonte dos dados nutricionais: TBCA-USP (Tabela Brasileira de
// Composição de Alimentos) — versão 7.0, e USDA FoodData Central
// para itens não presentes na TBCA.
//
// Valores por 100g de alimento.
// codigo_taco = null (não pertence à TACO original).
//
// Rodar: npx tsx prisma/seed-taco-complementar.ts
// ============================================================
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { estimarFerroHeme } from '../src/lib/ferro-heme-utils'

// Usa DATABASE_URL do .env (não calcula path manualmente)
const prisma = new PrismaClient()

interface AlimentoComplementar {
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
  vitamina_a_mcg: number
  vitamina_c_mg: number
  calcio_mg: number
  magnesio_mg: number
  zinco_mg: number
  acucar_adicionado_g: number
}

// ── ALIMENTOS COMPLEMENTARES (TBCA-USP / USDA) ──
// Valores por 100g. Atualizados conforme TBCA-USP v7.0.
const alimentosComplementares: AlimentoComplementar[] = [
  // ═══ HORTALIÇAS / VERDURAS (15) ═══
  {
    nome: 'Tomate vermelho cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 unidade média (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 18, carboidratos_g: 3.9, proteinas_g: 0.9, lipidios_g: 0.2,
    fibra_alimentar_g: 1.2, sodio_mg: 5, ferro_mg: 0.3, vitamina_a_mcg: 64,
    vitamina_c_mg: 14, calcio_mg: 10, magnesio_mg: 11, zinco_mg: 0.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Tomate cereja cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 27, carboidratos_g: 5.8, proteinas_g: 1.3, lipidios_g: 0.3,
    fibra_alimentar_g: 1.8, sodio_mg: 8, ferro_mg: 0.4, vitamina_a_mcg: 84,
    vitamina_c_mg: 22, calcio_mg: 15, magnesio_mg: 14, zinco_mg: 0.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Tomate italiano cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 unidade grande (180 g)',
    gramas_por_medida: 180,
    energia_kcal: 19, carboidratos_g: 4.1, proteinas_g: 1.0, lipidios_g: 0.2,
    fibra_alimentar_g: 1.3, sodio_mg: 5, ferro_mg: 0.3, vitamina_a_mcg: 70,
    vitamina_c_mg: 16, calcio_mg: 11, magnesio_mg: 12, zinco_mg: 0.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Pepino cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 fatia grande (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 15, carboidratos_g: 3.6, proteinas_g: 0.7, lipidios_g: 0.1,
    fibra_alimentar_g: 0.5, sodio_mg: 2, ferro_mg: 0.3, vitamina_a_mcg: 5,
    vitamina_c_mg: 5, calcio_mg: 16, magnesio_mg: 13, zinco_mg: 0.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Pepino japonês cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 unidade média (200 g)',
    gramas_por_medida: 200,
    energia_kcal: 14, carboidratos_g: 3.0, proteinas_g: 0.8, lipidios_g: 0.1,
    fibra_alimentar_g: 1.0, sodio_mg: 3, ferro_mg: 0.3, vitamina_a_mcg: 8,
    vitamina_c_mg: 6, calcio_mg: 14, magnesio_mg: 12, zinco_mg: 0.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Alho-poró cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (90 g)',
    gramas_por_medida: 90,
    energia_kcal: 61, carboidratos_g: 14.2, proteinas_g: 1.5, lipidios_g: 0.3,
    fibra_alimentar_g: 1.8, sodio_mg: 20, ferro_mg: 2.1, vitamina_a_mcg: 83,
    vitamina_c_mg: 12, calcio_mg: 59, magnesio_mg: 28, zinco_mg: 0.4,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Salsão (aipo) cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 talo médio (40 g)',
    gramas_por_medida: 40,
    energia_kcal: 16, carboidratos_g: 3.0, proteinas_g: 0.7, lipidios_g: 0.2,
    fibra_alimentar_g: 1.6, sodio_mg: 80, ferro_mg: 0.2, vitamina_a_mcg: 22,
    vitamina_c_mg: 3, calcio_mg: 40, magnesio_mg: 11, zinco_mg: 0.1,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Batata-doce crua',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 unidade média (130 g)',
    gramas_por_medida: 130,
    energia_kcal: 86, carboidratos_g: 20.1, proteinas_g: 1.6, lipidios_g: 0.1,
    fibra_alimentar_g: 3.0, sodio_mg: 55, ferro_mg: 0.6, vitamina_a_mcg: 709,
    vitamina_c_mg: 2.4, calcio_mg: 30, magnesio_mg: 25, zinco_mg: 0.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Batata-doce cozida',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (200 g)',
    gramas_por_medida: 200,
    energia_kcal: 90, carboidratos_g: 20.7, proteinas_g: 2.0, lipidios_g: 0.1,
    fibra_alimentar_g: 3.3, sodio_mg: 36, ferro_mg: 0.7, vitamina_a_mcg: 967,
    vitamina_c_mg: 13, calcio_mg: 32, magnesio_mg: 27, zinco_mg: 0.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Mandioquinha (batata baroa) cozida',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 70, carboidratos_g: 16.4, proteinas_g: 1.2, lipidios_g: 0.1,
    fibra_alimentar_g: 1.9, sodio_mg: 6, ferro_mg: 0.7, vitamina_a_mcg: 0,
    vitamina_c_mg: 12, calcio_mg: 25, magnesio_mg: 22, zinco_mg: 0.4,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Moranga (abóbora cabotiá) cozida',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (170 g)',
    gramas_por_medida: 170,
    energia_kcal: 40, carboidratos_g: 10.0, proteinas_g: 1.2, lipidios_g: 0.2,
    fibra_alimentar_g: 1.5, sodio_mg: 2, ferro_mg: 0.6, vitamina_a_mcg: 394,
    vitamina_c_mg: 9, calcio_mg: 27, magnesio_mg: 17, zinco_mg: 0.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Chuchu cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 unidade média (200 g)',
    gramas_por_medida: 200,
    energia_kcal: 19, carboidratos_g: 4.5, proteinas_g: 0.8, lipidios_g: 0.1,
    fibra_alimentar_g: 1.6, sodio_mg: 2, ferro_mg: 0.4, vitamina_a_mcg: 6,
    vitamina_c_mg: 11, calcio_mg: 17, magnesio_mg: 12, zinco_mg: 0.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Maxixe cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 unidade média (40 g)',
    gramas_por_medida: 40,
    energia_kcal: 16, carboidratos_g: 3.6, proteinas_g: 0.7, lipidios_g: 0.2,
    fibra_alimentar_g: 1.6, sodio_mg: 2, ferro_mg: 0.3, vitamina_a_mcg: 12,
    vitamina_c_mg: 11, calcio_mg: 18, magnesio_mg: 11, zinco_mg: 0.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Quiabo cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 33, carboidratos_g: 7.0, proteinas_g: 2.0, lipidios_g: 0.1,
    fibra_alimentar_g: 3.2, sodio_mg: 7, ferro_mg: 0.8, vitamina_a_mcg: 36,
    vitamina_c_mg: 21, calcio_mg: 82, magnesio_mg: 57, zinco_mg: 0.6,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Jiló cru',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 unidade média (30 g)',
    gramas_por_medida: 30,
    energia_kcal: 25, carboidratos_g: 5.9, proteinas_g: 1.2, lipidios_g: 0.2,
    fibra_alimentar_g: 1.8, sodio_mg: 4, ferro_mg: 0.4, vitamina_a_mcg: 9,
    vitamina_c_mg: 5, calcio_mg: 14, magnesio_mg: 13, zinco_mg: 0.2,
    acucar_adicionado_g: 0,
  },

  // ═══ TEMPEROS / ERVAS (10) ═══
  {
    nome: 'Manjericão fresco',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 colher sopa (3 g)',
    gramas_por_medida: 3,
    energia_kcal: 23, carboidratos_g: 4.4, proteinas_g: 2.3, lipidios_g: 0.6,
    fibra_alimentar_g: 1.6, sodio_mg: 4, ferro_mg: 2.3, vitamina_a_mcg: 264,
    vitamina_c_mg: 18, calcio_mg: 177, magnesio_mg: 64, zinco_mg: 0.6,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Orégano seco',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 265, carboidratos_g: 68.1, proteinas_g: 9.0, lipidios_g: 4.3,
    fibra_alimentar_g: 42.5, sodio_mg: 15, ferro_mg: 36.8, vitamina_a_mcg: 180,
    vitamina_c_mg: 2, calcio_mg: 1597, magnesio_mg: 270, zinco_mg: 4.4,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Alecrim fresco',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 131, carboidratos_g: 20.7, proteinas_g: 3.3, lipidios_g: 5.9,
    fibra_alimentar_g: 14.1, sodio_mg: 26, ferro_mg: 6.7, vitamina_a_mcg: 156,
    vitamina_c_mg: 22, calcio_mg: 317, magnesio_mg: 91, zinco_mg: 0.9,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Tomilho fresco',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 101, carboidratos_g: 24.5, proteinas_g: 5.6, lipidios_g: 1.7,
    fibra_alimentar_g: 14.0, sodio_mg: 9, ferro_mg: 17.5, vitamina_a_mcg: 238,
    vitamina_c_mg: 160, calcio_mg: 405, magnesio_mg: 160, zinco_mg: 1.8,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Sálvia fresca',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 315, carboidratos_g: 60.7, proteinas_g: 10.6, lipidios_g: 12.8,
    fibra_alimentar_g: 31.0, sodio_mg: 11, ferro_mg: 28.1, vitamina_a_mcg: 590,
    vitamina_c_mg: 32, calcio_mg: 1652, magnesio_mg: 428, zinco_mg: 4.7,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Louro seco',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 folha (1 g)',
    gramas_por_medida: 1,
    energia_kcal: 313, carboidratos_g: 75.0, proteinas_g: 7.6, lipidios_g: 8.4,
    fibra_alimentar_g: 26.3, sodio_mg: 23, ferro_mg: 43.0, vitamina_a_mcg: 309,
    vitamina_c_mg: 46, calcio_mg: 834, magnesio_mg: 120, zinco_mg: 3.7,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Coentro fresco',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 colher sopa (4 g)',
    gramas_por_medida: 4,
    energia_kcal: 23, carboidratos_g: 3.7, proteinas_g: 2.1, lipidios_g: 0.5,
    fibra_alimentar_g: 2.8, sodio_mg: 46, ferro_mg: 1.8, vitamina_a_mcg: 337,
    vitamina_c_mg: 27, calcio_mg: 67, magnesio_mg: 26, zinco_mg: 0.5,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Salsinha (cheiro-verde) fresca',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 colher sopa (4 g)',
    gramas_por_medida: 4,
    energia_kcal: 36, carboidratos_g: 6.3, proteinas_g: 3.0, lipidios_g: 0.8,
    fibra_alimentar_g: 3.3, sodio_mg: 56, ferro_mg: 6.2, vitamina_a_mcg: 421,
    vitamina_c_mg: 133, calcio_mg: 138, magnesio_mg: 50, zinco_mg: 1.1,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Cebolinha verde crua',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 colher sopa (4 g)',
    gramas_por_medida: 4,
    energia_kcal: 27, carboidratos_g: 5.7, proteinas_g: 1.8, lipidios_g: 0.2,
    fibra_alimentar_g: 2.0, sodio_mg: 5, ferro_mg: 1.5, vitamina_a_mcg: 100,
    vitamina_c_mg: 18, calcio_mg: 72, magnesio_mg: 19, zinco_mg: 0.4,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Pimenta-do-reino preta moída',
    grupo: 'Outros',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 251, carboidratos_g: 64.8, proteinas_g: 10.4, lipidios_g: 3.3,
    fibra_alimentar_g: 25.0, sodio_mg: 20, ferro_mg: 9.7, vitamina_a_mcg: 27,
    vitamina_c_mg: 0, calcio_mg: 443, magnesio_mg: 171, zinco_mg: 1.4,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Cominho em pó',
    grupo: 'Outros',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 375, carboidratos_g: 44.2, proteinas_g: 17.8, lipidios_g: 22.3,
    fibra_alimentar_g: 10.5, sodio_mg: 168, ferro_mg: 16.5, vitamina_a_mcg: 64,
    vitamina_c_mg: 7.7, calcio_mg: 931, magnesio_mg: 366, zinco_mg: 4.8,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Páprica doce em pó',
    grupo: 'Outros',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 282, carboidratos_g: 54.0, proteinas_g: 14.1, lipidios_g: 12.9,
    fibra_alimentar_g: 34.9, sodio_mg: 68, ferro_mg: 21.1, vitamina_a_mcg: 2463,
    vitamina_c_mg: 0.9, calcio_mg: 229, magnesio_mg: 178, zinco_mg: 4.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Canela em pó',
    grupo: 'Outros',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 247, carboidratos_g: 80.6, proteinas_g: 4.0, lipidios_g: 1.2,
    fibra_alimentar_g: 53.1, sodio_mg: 10, ferro_mg: 8.3, vitamina_a_mcg: 15,
    vitamina_c_mg: 3.8, calcio_mg: 1002, magnesio_mg: 60, zinco_mg: 1.9,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Noz-moscada moída',
    grupo: 'Outros',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 525, carboidratos_g: 49.3, proteinas_g: 5.8, lipidios_g: 36.3,
    fibra_alimentar_g: 20.8, sodio_mg: 80, ferro_mg: 3.0, vitamina_a_mcg: 5,
    vitamina_c_mg: 3, calcio_mg: 184, magnesio_mg: 183, zinco_mg: 2.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Cravo-da-índia moído',
    grupo: 'Outros',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 274, carboidratos_g: 65.5, proteinas_g: 6.0, lipidios_g: 13.0,
    fibra_alimentar_g: 33.9, sodio_mg: 277, ferro_mg: 8.7, vitamina_a_mcg: 16,
    vitamina_c_mg: 0.2, calcio_mg: 632, magnesio_mg: 259, zinco_mg: 2.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Açafrão da terra (cúrcuma) em pó',
    grupo: 'Outros',
    medida_caseira: '1 colher chá (2 g)',
    gramas_por_medida: 2,
    energia_kcal: 312, carboidratos_g: 67.1, proteinas_g: 9.7, lipidios_g: 3.3,
    fibra_alimentar_g: 22.7, sodio_mg: 38, ferro_mg: 41.4, vitamina_a_mcg: 0,
    vitamina_c_mg: 25.9, calcio_mg: 182, magnesio_mg: 193, zinco_mg: 4.3,
    acucar_adicionado_g: 0,
  },

  // ═══ GORDURAS / ÓLEOS (4) ═══
  {
    nome: 'Azeite de oliva extra virgem',
    grupo: 'Óleos e gorduras',
    medida_caseira: '1 colher sopa (15 g)',
    gramas_por_medida: 15,
    energia_kcal: 884, carboidratos_g: 0, proteinas_g: 0, lipidios_g: 100,
    fibra_alimentar_g: 0, sodio_mg: 2, ferro_mg: 0.6, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 1, magnesio_mg: 0, zinco_mg: 0.01,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Margarina',
    grupo: 'Óleos e gorduras',
    medida_caseira: '1 colher sopa (15 g)',
    gramas_por_medida: 15,
    energia_kcal: 717, carboidratos_g: 0.7, proteinas_g: 0.2, lipidios_g: 80.7,
    fibra_alimentar_g: 0, sodio_mg: 9, ferro_mg: 0, vitamina_a_mcg: 819,
    vitamina_c_mg: 0.2, calcio_mg: 7, magnesio_mg: 1, zinco_mg: 0.07,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Banha de porco',
    grupo: 'Óleos e gorduras',
    medida_caseira: '1 colher sopa (15 g)',
    gramas_por_medida: 15,
    energia_kcal: 902, carboidratos_g: 0, proteinas_g: 0, lipidios_g: 100,
    fibra_alimentar_g: 0, sodio_mg: 0, ferro_mg: 0, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 0, magnesio_mg: 0, zinco_mg: 0.1,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Óleo de girassol',
    grupo: 'Óleos e gorduras',
    medida_caseira: '1 colher sopa (15 g)',
    gramas_por_medida: 15,
    energia_kcal: 884, carboidratos_g: 0, proteinas_g: 0, lipidios_g: 100,
    fibra_alimentar_g: 0, sodio_mg: 0, ferro_mg: 0, vitamina_a_mcg: 5,
    vitamina_c_mg: 0, calcio_mg: 0, magnesio_mg: 0, zinco_mg: 0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Óleo de soja',
    grupo: 'Óleos e gorduras',
    medida_caseira: '1 colher sopa (15 g)',
    gramas_por_medida: 15,
    energia_kcal: 884, carboidratos_g: 0, proteinas_g: 0, lipidios_g: 100,
    fibra_alimentar_g: 0, sodio_mg: 0, ferro_mg: 0, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 0, magnesio_mg: 0, zinco_mg: 0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Óleo de milho',
    grupo: 'Óleos e gorduras',
    medida_caseira: '1 colher sopa (15 g)',
    gramas_por_medida: 15,
    energia_kcal: 884, carboidratos_g: 0, proteinas_g: 0, lipidios_g: 100,
    fibra_alimentar_g: 0, sodio_mg: 0, ferro_mg: 0.2, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 0, magnesio_mg: 0, zinco_mg: 0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Óleo de coco',
    grupo: 'Óleos e gorduras',
    medida_caseira: '1 colher sopa (15 g)',
    gramas_por_medida: 15,
    energia_kcal: 892, carboidratos_g: 0, proteinas_g: 0, lipidios_g: 100,
    fibra_alimentar_g: 0, sodio_mg: 0, ferro_mg: 0.04, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 1, magnesio_mg: 0, zinco_mg: 0.02,
    acucar_adicionado_g: 0,
  },

  // ═══ CARNES / VÍSCERAS (8) ═══
  {
    nome: 'Coxão mole cru',
    grupo: 'Carnes e ovos',
    medida_caseira: '1 bife médio (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 168, carboidratos_g: 0, proteinas_g: 19.4, lipidios_g: 9.6,
    fibra_alimentar_g: 0, sodio_mg: 50, ferro_mg: 2.0, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 5, magnesio_mg: 19, zinco_mg: 4.0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Coxão duro cru',
    grupo: 'Carnes e ovos',
    medida_caseira: '1 bife médio (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 198, carboidratos_g: 0, proteinas_g: 18.5, lipidios_g: 14.0,
    fibra_alimentar_g: 0, sodio_mg: 55, ferro_mg: 2.3, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 5, magnesio_mg: 18, zinco_mg: 4.5,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Patinho cru',
    grupo: 'Carnes e ovos',
    medida_caseira: '1 bife médio (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 154, carboidratos_g: 0, proteinas_g: 20.5, lipidios_g: 7.0,
    fibra_alimentar_g: 0, sodio_mg: 50, ferro_mg: 1.9, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 5, magnesio_mg: 21, zinco_mg: 4.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Fraldinha crua',
    grupo: 'Carnes e ovos',
    medida_caseira: '1 porção (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 220, carboidratos_g: 0, proteinas_g: 18.0, lipidios_g: 16.5,
    fibra_alimentar_g: 0, sodio_mg: 55, ferro_mg: 2.1, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 5, magnesio_mg: 17, zinco_mg: 4.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Acém cru',
    grupo: 'Carnes e ovos',
    medida_caseira: '1 porção (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 191, carboidratos_g: 0, proteinas_g: 17.5, lipidios_g: 13.5,
    fibra_alimentar_g: 0, sodio_mg: 60, ferro_mg: 2.4, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 5, magnesio_mg: 17, zinco_mg: 4.6,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Moela de frango crua',
    grupo: 'Carnes e ovos',
    medida_caseira: '1 xícara chá (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 154, carboidratos_g: 0, proteinas_g: 18.0, lipidios_g: 8.5,
    fibra_alimentar_g: 0, sodio_mg: 70, ferro_mg: 3.5, vitamina_a_mcg: 30,
    vitamina_c_mg: 0, calcio_mg: 8, magnesio_mg: 20, zinco_mg: 3.5,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Fígado de frango cru',
    grupo: 'Carnes e ovos',
    medida_caseira: '1 porção (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 119, carboidratos_g: 0.7, proteinas_g: 17.0, lipidios_g: 4.8,
    fibra_alimentar_g: 0, sodio_mg: 71, ferro_mg: 9.0, vitamina_a_mcg: 4296,
    vitamina_c_mg: 18, calcio_mg: 9, magnesio_mg: 19, zinco_mg: 2.7,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Coração de frango cru',
    grupo: 'Carnes e ovos',
    medida_caseira: '1 porção (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 153, carboidratos_g: 0.7, proteinas_g: 16.0, lipidios_g: 9.3,
    fibra_alimentar_g: 0, sodio_mg: 75, ferro_mg: 5.0, vitamina_a_mcg: 50,
    vitamina_c_mg: 5, calcio_mg: 7, magnesio_mg: 21, zinco_mg: 3.0,
    acucar_adicionado_g: 0,
  },

  // ═══ FRUTAS (6) ═══
  {
    nome: 'Mamão formosa',
    grupo: 'Frutas e derivados',
    medida_caseira: '1 fatia média (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 50, carboidratos_g: 12.2, proteinas_g: 0.5, lipidios_g: 0.1,
    fibra_alimentar_g: 1.7, sodio_mg: 4, ferro_mg: 0.3, vitamina_a_mcg: 110,
    vitamina_c_mg: 62, calcio_mg: 30, magnesio_mg: 14, zinco_mg: 0.1,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Mamão papaya (havaí)',
    grupo: 'Frutas e derivados',
    medida_caseira: '1 unidade média (300 g)',
    gramas_por_medida: 300,
    energia_kcal: 43, carboidratos_g: 10.8, proteinas_g: 0.5, lipidios_g: 0.1,
    fibra_alimentar_g: 1.7, sodio_mg: 8, ferro_mg: 0.2, vitamina_a_mcg: 47,
    vitamina_c_mg: 62, calcio_mg: 24, magnesio_mg: 10, zinco_mg: 0.1,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Acerola',
    grupo: 'Frutas e derivados',
    medida_caseira: '1 unidade (5 g)',
    gramas_por_medida: 5,
    energia_kcal: 33, carboidratos_g: 8.0, proteinas_g: 0.4, lipidios_g: 0.3,
    fibra_alimentar_g: 1.2, sodio_mg: 5, ferro_mg: 0.2, vitamina_a_mcg: 11,
    vitamina_c_mg: 941, calcio_mg: 12, magnesio_mg: 9, zinco_mg: 0.1,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Caju',
    grupo: 'Frutas e derivados',
    medida_caseira: '1 unidade (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 43, carboidratos_g: 11.3, proteinas_g: 0.8, lipidios_g: 0.3,
    fibra_alimentar_g: 1.0, sodio_mg: 4, ferro_mg: 0.3, vitamina_a_mcg: 9,
    vitamina_c_mg: 219, calcio_mg: 4, magnesio_mg: 19, zinco_mg: 0.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Cajá',
    grupo: 'Frutas e derivados',
    medida_caseira: '1 unidade (20 g)',
    gramas_por_medida: 20,
    energia_kcal: 50, carboidratos_g: 12.6, proteinas_g: 0.7, lipidios_g: 0.1,
    fibra_alimentar_g: 1.5, sodio_mg: 3, ferro_mg: 0.4, vitamina_a_mcg: 25,
    vitamina_c_mg: 16, calcio_mg: 16, magnesio_mg: 11, zinco_mg: 0.1,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Seriguela',
    grupo: 'Frutas e derivados',
    medida_caseira: '1 unidade (10 g)',
    gramas_por_medida: 10,
    energia_kcal: 65, carboidratos_g: 16.0, proteinas_g: 0.5, lipidios_g: 0.2,
    fibra_alimentar_g: 1.4, sodio_mg: 3, ferro_mg: 0.3, vitamina_a_mcg: 22,
    vitamina_c_mg: 14, calcio_mg: 12, magnesio_mg: 12, zinco_mg: 0.1,
    acucar_adicionado_g: 0,
  },

  // ═══ OUTROS (7) ═══
  {
    nome: 'Café torrado em pó',
    grupo: 'Bebidas',
    medida_caseira: '1 colher sopa (10 g)',
    gramas_por_medida: 10,
    energia_kcal: 313, carboidratos_g: 41.1, proteinas_g: 12.6, lipidios_g: 14.0,
    fibra_alimentar_g: 22.5, sodio_mg: 37, ferro_mg: 5.2, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 142, magnesio_mg: 230, zinco_mg: 4.0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Café coado sem açúcar',
    grupo: 'Bebidas',
    medida_caseira: '1 xícara chá (200 ml)',
    gramas_por_medida: 200,
    energia_kcal: 1, carboidratos_g: 0.3, proteinas_g: 0.1, lipidios_g: 0,
    fibra_alimentar_g: 0, sodio_mg: 2, ferro_mg: 0, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 2, magnesio_mg: 2, zinco_mg: 0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Cacau em pó 100%',
    grupo: 'Açúcares e doces',
    medida_caseira: '1 colher sopa (10 g)',
    gramas_por_medida: 10,
    energia_kcal: 228, carboidratos_g: 57.9, proteinas_g: 19.6, lipidios_g: 13.7,
    fibra_alimentar_g: 33.2, sodio_mg: 21, ferro_mg: 13.9, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 128, magnesio_mg: 499, zinco_mg: 6.8,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Fermento biológico seco',
    grupo: 'Outros',
    medida_caseira: '1 colher sopa (10 g)',
    gramas_por_medida: 10,
    energia_kcal: 325, carboidratos_g: 41.0, proteinas_g: 35.0, lipidios_g: 1.5,
    fibra_alimentar_g: 18.0, sodio_mg: 51, ferro_mg: 3.0, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 30, magnesio_mg: 50, zinco_mg: 12.0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Fermento químico em pó (pó royal)',
    grupo: 'Outros',
    medida_caseira: '1 colher sopa (10 g)',
    gramas_por_medida: 10,
    energia_kcal: 80, carboidratos_g: 18.0, proteinas_g: 0, lipidios_g: 0,
    fibra_alimentar_g: 0, sodio_mg: 10500, ferro_mg: 0, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 1000, magnesio_mg: 0, zinco_mg: 0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Gelatina diet',
    grupo: 'Açúcares e doces',
    medida_caseira: '1 porção (120 g)',
    gramas_por_medida: 120,
    energia_kcal: 14, carboidratos_g: 0, proteinas_g: 3.5, lipidios_g: 0,
    fibra_alimentar_g: 0, sodio_mg: 90, ferro_mg: 0, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 0, magnesio_mg: 0, zinco_mg: 0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Água de coco',
    grupo: 'Bebidas',
    medida_caseira: '1 copo (200 ml)',
    gramas_por_medida: 200,
    energia_kcal: 19, carboidratos_g: 3.7, proteinas_g: 0.7, lipidios_g: 0.2,
    fibra_alimentar_g: 1.1, sodio_mg: 105, ferro_mg: 0.3, vitamina_a_mcg: 0,
    vitamina_c_mg: 2.4, calcio_mg: 24, magnesio_mg: 25, zinco_mg: 0.1,
    acucar_adicionado_g: 0,
  },

  // ═══ ITENS FALTANTES DAS FICHAS TÉCNICAS (28) ═══
  {
    nome: 'Trigo para quibe',
    grupo: 'Cereais e derivados',
    medida_caseira: '1 xícara chá (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 342, carboidratos_g: 75.0, proteinas_g: 12.5, lipidios_g: 1.5,
    fibra_alimentar_g: 12.0, sodio_mg: 8, ferro_mg: 2.5, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 35, magnesio_mg: 130, zinco_mg: 2.5,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Repolho verde',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (90 g)',
    gramas_por_medida: 90,
    energia_kcal: 25, carboidratos_g: 5.8, proteinas_g: 1.3, lipidios_g: 0.1,
    fibra_alimentar_g: 2.5, sodio_mg: 18, ferro_mg: 0.5, vitamina_a_mcg: 5,
    vitamina_c_mg: 36, calcio_mg: 40, magnesio_mg: 12, zinco_mg: 0.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Proteína de soja',
    grupo: 'Leguminosas e derivados',
    medida_caseira: '1 colher sopa (10 g)',
    gramas_por_medida: 10,
    energia_kcal: 336, carboidratos_g: 30.0, proteinas_g: 52.0, lipidios_g: 1.0,
    fibra_alimentar_g: 6.0, sodio_mg: 200, ferro_mg: 5.5, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 300, magnesio_mg: 220, zinco_mg: 4.0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Quirerinha',
    grupo: 'Cereais e derivados',
    medida_caseira: '1 xícara chá (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 350, carboidratos_g: 76.0, proteinas_g: 8.0, lipidios_g: 1.5,
    fibra_alimentar_g: 5.0, sodio_mg: 5, ferro_mg: 2.0, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 10, magnesio_mg: 60, zinco_mg: 1.5,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Quirera de milho',
    grupo: 'Cereais e derivados',
    medida_caseira: '1 xícara chá (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 350, carboidratos_g: 76.0, proteinas_g: 8.0, lipidios_g: 1.5,
    fibra_alimentar_g: 5.0, sodio_mg: 5, ferro_mg: 2.0, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 10, magnesio_mg: 60, zinco_mg: 1.5,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Flocos de milho',
    grupo: 'Cereais e derivados',
    medida_caseira: '1 xícara chá (30 g)',
    gramas_por_medida: 30,
    energia_kcal: 357, carboidratos_g: 84.0, proteinas_g: 8.0, lipidios_g: 0.5,
    fibra_alimentar_g: 3.0, sodio_mg: 350, ferro_mg: 6.0, vitamina_a_mcg: 200,
    vitamina_c_mg: 30, calcio_mg: 50, magnesio_mg: 30, zinco_mg: 2.5,
    acucar_adicionado_g: 8,
  },
  {
    nome: 'Abóbora paulista',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (116 g)',
    gramas_por_medida: 116,
    energia_kcal: 20, carboidratos_g: 5.0, proteinas_g: 0.8, lipidios_g: 0.1,
    fibra_alimentar_g: 1.2, sodio_mg: 1, ferro_mg: 0.4, vitamina_a_mcg: 120,
    vitamina_c_mg: 9, calcio_mg: 21, magnesio_mg: 12, zinco_mg: 0.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Azeite de dendê',
    grupo: 'Óleos e gorduras',
    medida_caseira: '1 colher sopa (15 g)',
    gramas_por_medida: 15,
    energia_kcal: 884, carboidratos_g: 0, proteinas_g: 0, lipidios_g: 100,
    fibra_alimentar_g: 0, sodio_mg: 0, ferro_mg: 0, vitamina_a_mcg: 1500,
    vitamina_c_mg: 0, calcio_mg: 0, magnesio_mg: 0, zinco_mg: 0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Pimenta de cheiro',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 unidade (10 g)',
    gramas_por_medida: 10,
    energia_kcal: 40, carboidratos_g: 9.0, proteinas_g: 1.9, lipidios_g: 0.4,
    fibra_alimentar_g: 1.5, sodio_mg: 9, ferro_mg: 1.2, vitamina_a_mcg: 29,
    vitamina_c_mg: 244, calcio_mg: 14, magnesio_mg: 23, zinco_mg: 0.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Chá mate',
    grupo: 'Bebidas',
    medida_caseira: '1 copo (200 ml)',
    gramas_por_medida: 200,
    energia_kcal: 4, carboidratos_g: 0.9, proteinas_g: 0.1, lipidios_g: 0,
    fibra_alimentar_g: 0, sodio_mg: 5, ferro_mg: 0.1, vitamina_a_mcg: 0,
    vitamina_c_mg: 0.5, calcio_mg: 4, magnesio_mg: 4, zinco_mg: 0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Chá de erva-doce',
    grupo: 'Bebidas',
    medida_caseira: '1 copo (200 ml)',
    gramas_por_medida: 200,
    energia_kcal: 1, carboidratos_g: 0.2, proteinas_g: 0, lipidios_g: 0,
    fibra_alimentar_g: 0, sodio_mg: 2, ferro_mg: 0, vitamina_a_mcg: 0,
    vitamina_c_mg: 0, calcio_mg: 4, magnesio_mg: 2, zinco_mg: 0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Coco ralado',
    grupo: 'Frutas e derivados',
    medida_caseira: '1 colher sopa (10 g)',
    gramas_por_medida: 10,
    energia_kcal: 660, carboidratos_g: 23.6, proteinas_g: 6.9, lipidios_g: 64.5,
    fibra_alimentar_g: 16.3, sodio_mg: 37, ferro_mg: 3.4, vitamina_a_mcg: 0,
    vitamina_c_mg: 3.6, calcio_mg: 26, magnesio_mg: 90, zinco_mg: 2.0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Poncã',
    grupo: 'Frutas e derivados',
    medida_caseira: '1 unidade (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 47, carboidratos_g: 11.8, proteinas_g: 0.6, lipidios_g: 0.2,
    fibra_alimentar_g: 1.8, sodio_mg: 2, ferro_mg: 0.2, vitamina_a_mcg: 14,
    vitamina_c_mg: 26, calcio_mg: 18, magnesio_mg: 9, zinco_mg: 0.1,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Caqui',
    grupo: 'Frutas e derivados',
    medida_caseira: '1 unidade (168 g)',
    gramas_por_medida: 168,
    energia_kcal: 70, carboidratos_g: 18.6, proteinas_g: 0.6, lipidios_g: 0.2,
    fibra_alimentar_g: 6.0, sodio_mg: 1, ferro_mg: 0.2, vitamina_a_mcg: 81,
    vitamina_c_mg: 7.5, calcio_mg: 8, magnesio_mg: 9, zinco_mg: 0.1,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Doce de fruta',
    grupo: 'Açúcares e doces',
    medida_caseira: '1 colher sopa (20 g)',
    gramas_por_medida: 20,
    energia_kcal: 250, carboidratos_g: 60.0, proteinas_g: 0.5, lipidios_g: 0.2,
    fibra_alimentar_g: 1.5, sodio_mg: 15, ferro_mg: 0.5, vitamina_a_mcg: 5,
    vitamina_c_mg: 5, calcio_mg: 10, magnesio_mg: 5, zinco_mg: 0.1,
    acucar_adicionado_g: 45,
  },
  {
    nome: 'Molho de carne moída',
    grupo: 'Preparações',
    medida_caseira: '1 concha (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 110, carboidratos_g: 4.0, proteinas_g: 8.0, lipidios_g: 7.0,
    fibra_alimentar_g: 0.5, sodio_mg: 350, ferro_mg: 1.2, vitamina_a_mcg: 10,
    vitamina_c_mg: 2, calcio_mg: 10, magnesio_mg: 12, zinco_mg: 1.8,
    acucar_adicionado_g: 1,
  },
  {
    nome: 'Mandioca descascada',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 160, carboidratos_g: 38.0, proteinas_g: 1.4, lipidios_g: 0.3,
    fibra_alimentar_g: 1.8, sodio_mg: 14, ferro_mg: 0.3, vitamina_a_mcg: 1,
    vitamina_c_mg: 20, calcio_mg: 16, magnesio_mg: 21, zinco_mg: 0.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Cenoura ou abóbora',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 35, carboidratos_g: 8.0, proteinas_g: 1.0, lipidios_g: 0.2,
    fibra_alimentar_g: 2.5, sodio_mg: 25, ferro_mg: 0.4, vitamina_a_mcg: 500,
    vitamina_c_mg: 10, calcio_mg: 25, magnesio_mg: 12, zinco_mg: 0.2,
    acucar_adicionado_g: 0,
  },

  // ═══ ITENS DAS FICHAS (6 restantes com dados reais) ═══
  {
    nome: 'Ervilha seca crua',
    grupo: 'Leguminosas e derivados',
    medida_caseira: '1 xícara chá (100 g)',
    gramas_por_medida: 100,
    energia_kcal: 341, carboidratos_g: 60.0, proteinas_g: 24.0, lipidios_g: 1.5,
    fibra_alimentar_g: 25.0, sodio_mg: 5, ferro_mg: 4.4, vitamina_a_mcg: 7,
    vitamina_c_mg: 1.8, calcio_mg: 46, magnesio_mg: 100, zinco_mg: 3.2,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Abobrinha verde crua',
    grupo: 'Verduras e hortaliças',
    medida_caseira: '1 xícara chá (113 g)',
    gramas_por_medida: 113,
    energia_kcal: 17, carboidratos_g: 3.1, proteinas_g: 1.2, lipidios_g: 0.3,
    fibra_alimentar_g: 1.0, sodio_mg: 8, ferro_mg: 0.4, vitamina_a_mcg: 30,
    vitamina_c_mg: 17, calcio_mg: 16, magnesio_mg: 18, zinco_mg: 0.3,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Carne suína crua',
    grupo: 'Carnes e ovos',
    medida_caseira: '1 porção (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 242, carboidratos_g: 0, proteinas_g: 27.0, lipidios_g: 14.0,
    fibra_alimentar_g: 0, sodio_mg: 62, ferro_mg: 1.1, vitamina_a_mcg: 2,
    vitamina_c_mg: 0, calcio_mg: 19, magnesio_mg: 22, zinco_mg: 2.0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Extrato de tomate',
    grupo: 'Preparações',
    medida_caseira: '1 colher sopa (15 g)',
    gramas_por_medida: 15,
    energia_kcal: 82, carboidratos_g: 18.9, proteinas_g: 4.6, lipidios_g: 0.4,
    fibra_alimentar_g: 1.7, sodio_mg: 533, ferro_mg: 3.0, vitamina_a_mcg: 200,
    vitamina_c_mg: 22, calcio_mg: 32, magnesio_mg: 36, zinco_mg: 0.6,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Filé de peito de frango',
    grupo: 'Carnes e ovos',
    medida_caseira: '1 filé médio (150 g)',
    gramas_por_medida: 150,
    energia_kcal: 165, carboidratos_g: 0, proteinas_g: 31.0, lipidios_g: 3.6,
    fibra_alimentar_g: 0, sodio_mg: 74, ferro_mg: 1.0, vitamina_a_mcg: 6,
    vitamina_c_mg: 0, calcio_mg: 15, magnesio_mg: 29, zinco_mg: 1.0,
    acucar_adicionado_g: 0,
  },
  {
    nome: 'Ervilha fresca congelada',
    grupo: 'Leguminosas e derivados',
    medida_caseira: '1 xícara chá (134 g)',
    gramas_por_medida: 134,
    energia_kcal: 77, carboidratos_g: 14.0, proteinas_g: 5.4, lipidios_g: 0.4,
    fibra_alimentar_g: 5.2, sodio_mg: 4, ferro_mg: 1.6, vitamina_a_mcg: 35,
    vitamina_c_mg: 18, calcio_mg: 25, magnesio_mg: 33, zinco_mg: 1.2,
    acucar_adicionado_g: 0,
  },
]

async function upsertAlimento(item: AlimentoComplementar) {
  // Busca por nome (não tem codigo_taco)
  const existing = await prisma.alimento.findFirst({
    where: { nome: item.nome },
  })

  const ferroHeme = estimarFerroHeme({
    grupo: item.grupo,
    nome: item.nome,
    ferro_mg: item.ferro_mg,
  })

  const data = {
    codigo_taco: null,
    nome: item.nome,
    grupo: item.grupo,
    medida_caseira: item.medida_caseira,
    gramas_por_medida: item.gramas_por_medida,
    energia_kcal: item.energia_kcal,
    carboidratos_g: item.carboidratos_g,
    proteinas_g: item.proteinas_g,
    lipidios_g: item.lipidios_g,
    fibra_alimentar_g: item.fibra_alimentar_g,
    sodio_mg: item.sodio_mg,
    ferro_mg: item.ferro_mg,
    ferro_heme_mg: ferroHeme,
    vitamina_a_mcg: item.vitamina_a_mcg,
    vitamina_c_mg: item.vitamina_c_mg,
    calcio_mg: item.calcio_mg,
    magnesio_mg: item.magnesio_mg,
    zinco_mg: item.zinco_mg,
    acucar_adicionado_g: item.acucar_adicionado_g,
    ativo: true,
  }

  if (existing) {
    return prisma.alimento.update({
      where: { id: existing.id },
      data,
    })
  }
  return prisma.alimento.create({ data })
}

async function main() {
  console.log(`🌱 Adicionando ${alimentosComplementares.length} alimentos complementares (TBCA-USP)...`)
  console.log('   Fonte: TBCA-USP v7.0 / USDA FoodData Central')
  console.log('')

  let created = 0
  let updated = 0
  let errors = 0

  for (const item of alimentosComplementares) {
    try {
      const existing = await prisma.alimento.findFirst({
        where: { nome: item.nome },
      })
      if (existing) {
        updated++
      } else {
        created++
      }
      await upsertAlimento(item)
      const ferroHeme = estimarFerroHeme({
        grupo: item.grupo,
        nome: item.nome,
        ferro_mg: item.ferro_mg,
      })
      console.log(`  ${existing ? '↻' : '+'} ${item.nome.padEnd(45)} [${item.grupo}]${ferroHeme > 0 ? ` (Fe-H: ${ferroHeme}mg)` : ''}`)
    } catch (err: any) {
      errors++
      console.error(`  ✗ Erro "${item.nome}": ${err.message}`)
    }
  }

  console.log('')
  console.log(`  ✓ ${created} criados, ${updated} atualizados, ${errors} erros`)

  const total = await prisma.alimento.count()
  console.log(`  ✓ Total de alimentos no banco: ${total}`)

  // Resumo por grupo
  const grupos = await prisma.alimento.groupBy({
    by: ['grupo'],
    _count: { grupo: true },
    orderBy: { _count: { grupo: 'desc' } },
  })
  console.log('')
  console.log('=== Resumo por grupo ===')
  for (const g of grupos) {
    console.log(`  ${g._count.grupo.toString().padStart(3)} - ${g.grupo}`)
  }
}

main()
  .catch((e) => {
    console.error('Erro no seed complementar:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
