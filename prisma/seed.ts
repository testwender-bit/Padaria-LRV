// Seed script - populate database with sample data
import { PrismaClient } from '@prisma/client'
import { startOfWeek, addWeeks, addDays, getISOWeek, getYear, format } from 'date-fns'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'
import tacoData from '../taco_complete.json'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ── Limpeza prévia (seed idempotente) ─────────────────────────
  // Deletar em ordem reversa de dependência para respeitar FK
  console.log('  🧹 Limpando dados anteriores...')
  await prisma.receita.deleteMany()
  await prisma.cardapioSemestral.deleteMany()
  await prisma.lancheDistribuicao.deleteMany()
  await prisma.pfQuantidade.deleteMany()
  await prisma.pcqQuantidade.deleteMany()
  await prisma.feriado.deleteMany()
  await prisma.insumo.deleteMany()
  await prisma.lanche.deleteMany()
  await prisma.escola.deleteMany()
  console.log('  ✓ Dados anteriores removidos')

  // ── Admin User ─────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { email: 'admin@padaria.municipal' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@padaria.municipal',
      password: hashedPassword,
      role: 'admin',
      ativo: true,
      createdAt: new Date().toISOString(),
    },
  })
  console.log('  ✓ Usuário admin criado (admin@padaria.municipal / admin123)')

  // ── Escolas ──────────────────────────────────────────────────
  const escolasData = [
    { nome: 'EMEF São José', nome_curto: 'São José', categoria: 'REGULAR', rota: 'JOSE', ordem_rota: 1, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'EMEF Aroldo Lermen', nome_curto: 'Aroldo', categoria: 'REGULAR', rota: 'AROLDO', ordem_rota: 1, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'EMEF Irmã Delminda', nome_curto: 'Irmã Delminda', categoria: 'REGULAR', rota: 'JOSE', ordem_rota: 2, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'EMEF Monteiro Lobato', nome_curto: 'Monteiro L.', categoria: 'REGULAR', rota: 'AROLDO', ordem_rota: 2, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'EMEF Victor Meirelles', nome_curto: 'Victor M.', categoria: 'REGULAR', rota: 'JOSE', ordem_rota: 3, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'EMEF Vila Rica', nome_curto: 'Vila Rica', categoria: 'REGULAR', rota: 'AROLDO', ordem_rota: 3, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'CEI Tia Nena', nome_curto: 'Tia Nena', categoria: 'CRECHE', rota: 'JOSE', ordem_rota: 4, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'CEI Cantinho Feliz', nome_curto: 'Cantinho', categoria: 'CRECHE', rota: 'AROLDO', ordem_rota: 4, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'EMEF Integral Paulo Freire', nome_curto: 'P. Freire', categoria: 'INTEGRAL', rota: 'JOSE', ordem_rota: 5, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'EMEF Bifásica Chico Mendes', nome_curto: 'Chico M.', categoria: 'BIFASICA', rota: 'AROLDO', ordem_rota: 5, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'EMEB Linha Independência', nome_curto: 'L. Indep.', categoria: 'INTERIOR', rota: 'JOSE', ordem_rota: 6, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'EMEB Linha União', nome_curto: 'L. União', categoria: 'INTERIOR', rota: 'AROLDO', ordem_rota: 6, recebe_pf: true, recebe_pcq: true, recebe_lanche: true },
    { nome: 'Secretaria de Educação', nome_curto: 'SEDUC', categoria: 'OUTROS', rota: 'BUSCA_PROPRIA', ordem_rota: 1, recebe_pf: true, recebe_pcq: false, recebe_lanche: false, busca_propria: true },
    { nome: 'CRAS Municipal', nome_curto: 'CRAS', categoria: 'OUTROS', rota: 'BUSCA_PROPRIA', ordem_rota: 2, recebe_pf: true, recebe_pcq: false, recebe_lanche: false, busca_propria: true },
  ]

  const escolas: any[] = []
  for (const e of escolasData) {
    const escola = await prisma.escola.create({ data: e })
    escolas.push(escola)
    console.log(`  ✓ Escola: ${e.nome_curto}`)
  }

  // ── PF Quantidades ─────────────────────────────────────────
  const pfQuantidades = [
    { escola_curto: 'São José', tipo_pao: 'PADRAO', segunda: 200, terca: 200, quarta: 200, quinta: 200, sexta: 180 },
    { escola_curto: 'Aroldo', tipo_pao: 'PADRAO', segunda: 180, terca: 180, quarta: 180, quinta: 180, sexta: 160 },
    { escola_curto: 'Irmã Delminda', tipo_pao: 'PADRAO', segunda: 150, terca: 150, quarta: 150, quinta: 150, sexta: 130 },
    { escola_curto: 'Monteiro L.', tipo_pao: 'PADRAO', segunda: 160, terca: 160, quarta: 160, quinta: 160, sexta: 140 },
    { escola_curto: 'Victor M.', tipo_pao: 'PADRAO', segunda: 140, terca: 140, quarta: 140, quinta: 140, sexta: 120 },
    { escola_curto: 'Vila Rica', tipo_pao: 'PADRAO', segunda: 130, terca: 130, quarta: 130, quinta: 130, sexta: 110 },
    { escola_curto: 'Tia Nena', tipo_pao: 'PADRAO', segunda: 80, terca: 80, quarta: 80, quinta: 80, sexta: 60 },
    { escola_curto: 'Cantinho', tipo_pao: 'PADRAO', segunda: 70, terca: 70, quarta: 70, quinta: 70, sexta: 50 },
    { escola_curto: 'P. Freire', tipo_pao: 'PADRAO', segunda: 250, terca: 250, quarta: 250, quinta: 250, sexta: 220 },
    { escola_curto: 'Chico M.', tipo_pao: 'PADRAO', segunda: 180, terca: 180, quarta: 180, quinta: 180, sexta: 160 },
    { escola_curto: 'L. Indep.', tipo_pao: 'PADRAO', segunda: 60, terca: 60, quarta: 60, quinta: 60, sexta: 50 },
    { escola_curto: 'L. União', tipo_pao: 'PADRAO', segunda: 50, terca: 50, quarta: 50, quinta: 50, sexta: 40 },
    { escola_curto: 'SEDUC', tipo_pao: 'PADRAO', segunda: 30, terca: 30, quarta: 30, quinta: 30, sexta: 20 },
    { escola_curto: 'CRAS', tipo_pao: 'PADRAO', segunda: 20, terca: 20, quarta: 20, quinta: 20, sexta: 15 },
  ]

  for (const pfq of pfQuantidades) {
    const escola = escolas.find((e) => e.nome_curto === pfq.escola_curto)
    if (escola) {
      await prisma.pfQuantidade.create({
        data: {
          escola_id: escola.id,
          tipo_pao: pfq.tipo_pao,
          segunda: pfq.segunda,
          terca: pfq.terca,
          quarta: pfq.quarta,
          quinta: pfq.quinta,
          sexta: pfq.sexta,
        },
      })
    }
  }
  console.log('  ✓ PF Quantidades criadas')

  // ── PCQ Quantidades ─────────────────────────────────────────
  const pcqQuantidades = [
    { escola_curto: 'São José', prod_segunda: 20, prod_quarta: 20, prod_sexta: 15, pf_comp_segunda: 10, pf_comp_quarta: 10, pf_comp_sexta: 8 },
    { escola_curto: 'Aroldo', prod_segunda: 18, prod_quarta: 18, prod_sexta: 14, pf_comp_segunda: 8, pf_comp_quarta: 8, pf_comp_sexta: 6 },
    { escola_curto: 'Irmã Delminda', prod_segunda: 15, prod_quarta: 15, prod_sexta: 12, pf_comp_segunda: 6, pf_comp_quarta: 6, pf_comp_sexta: 5 },
    { escola_curto: 'Monteiro L.', prod_segunda: 16, prod_quarta: 16, prod_sexta: 13, pf_comp_segunda: 7, pf_comp_quarta: 7, pf_comp_sexta: 5 },
    { escola_curto: 'Victor M.', prod_segunda: 14, prod_quarta: 14, prod_sexta: 11, pf_comp_segunda: 0, pf_comp_quarta: 0, pf_comp_sexta: 0 },
    { escola_curto: 'Vila Rica', prod_segunda: 13, prod_quarta: 13, prod_sexta: 10, pf_comp_segunda: 0, pf_comp_quarta: 0, pf_comp_sexta: 0 },
    { escola_curto: 'Tia Nena', prod_segunda: 10, prod_quarta: 10, prod_sexta: 8, pf_comp_segunda: 10, pf_comp_quarta: 10, pf_comp_sexta: 8 },
    { escola_curto: 'Cantinho', prod_segunda: 8, prod_quarta: 8, prod_sexta: 6, pf_comp_segunda: 8, pf_comp_quarta: 8, pf_comp_sexta: 6 },
    { escola_curto: 'P. Freire', prod_segunda: 25, prod_quarta: 25, prod_sexta: 20, pf_comp_segunda: 0, pf_comp_quarta: 0, pf_comp_sexta: 0 },
    { escola_curto: 'Chico M.', prod_segunda: 18, prod_quarta: 18, prod_sexta: 14, pf_comp_segunda: 0, pf_comp_quarta: 0, pf_comp_sexta: 0 },
    { escola_curto: 'L. Indep.', prod_segunda: 6, prod_quarta: 6, prod_sexta: 5, pf_comp_segunda: 0, pf_comp_quarta: 0, pf_comp_sexta: 0 },
    { escola_curto: 'L. União', prod_segunda: 5, prod_quarta: 5, prod_sexta: 4, pf_comp_segunda: 0, pf_comp_quarta: 0, pf_comp_sexta: 0 },
  ]

  for (const pcqq of pcqQuantidades) {
    const escola = escolas.find((e) => e.nome_curto === pcqq.escola_curto)
    if (escola) {
      await prisma.pcqQuantidade.create({
        data: {
          escola_id: escola.id,
          prod_segunda: pcqq.prod_segunda,
          prod_quarta: pcqq.prod_quarta,
          prod_sexta: pcqq.prod_sexta,
          pf_comp_segunda: pcqq.pf_comp_segunda,
          pf_comp_quarta: pcqq.pf_comp_quarta,
          pf_comp_sexta: pcqq.pf_comp_sexta,
        },
      })
    }
  }
  console.log('  ✓ PCQ Quantidades criadas')

  // ── Lanches ──────────────────────────────────────────────────
  const lancheBiscoito = await prisma.lanche.create({
    data: { nome: 'Biscoito Maizena', unidade: 'un', ativo: true },
  })
  const lancheBolo = await prisma.lanche.create({
    data: { nome: 'Bolo de Cenoura', unidade: 'fatia', ativo: true },
  })
  const lanchePaoQueijo = await prisma.lanche.create({
    data: { nome: 'Pão de Queijo', unidade: 'un', ativo: true },
  })
  console.log('  ✓ Lanches criados')

  // ── Lanche Distribuição ──────────────────────────────────────
  const diasSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
  for (const escola of escolas.filter((e) => e.recebe_lanche)) {
    const baseQtd = escola.categoria === 'CRECHE' ? 40 : escola.categoria === 'INTEGRAL' ? 80 : escola.categoria === 'BIFASICA' ? 60 : 50
    for (const dia of diasSemana) {
      await prisma.lancheDistribuicao.create({
        data: {
          lanche_id: lancheBiscoito.id,
          escola_id: escola.id,
          dia_semana: dia,
          quantidade: baseQtd,
        },
      })
      if (escola.categoria === 'BIFASICA') {
        await prisma.lancheDistribuicao.create({
          data: {
            lanche_id: lancheBolo.id,
            escola_id: escola.id,
            dia_semana: dia,
            quantidade: baseQtd,
          },
        })
      }
    }
  }
  console.log('  ✓ Lanche Distribuição criada')

  // ── Cardápio Semestral (22 semanas) ──────────────────────────
  // Use date-fns to calculate proper ISO week numbers
  const ano = new Date().getFullYear()
  // Start from the first Monday of the school year (typically February)
  // For Brazil, school year starts in February
  const fevFirst = new Date(ano, 1, 1) // Feb 1
  const firstMonday = startOfWeek(fevFirst, { weekStartsOn: 1 })
  // If first Monday is before Feb 1, advance one week
  const schoolStart = firstMonday < fevFirst ? addWeeks(firstMonday, 1) : firstMonday

  for (let s = 0; s < 22; s++) {
    const weekMonday = addWeeks(schoolStart, s)
    const weekFriday = addDays(weekMonday, 4)
    const isoWeek = getISOWeek(weekMonday)
    const isoYear = getYear(weekMonday)

    const tipoPao = (s + 1) % 4 === 0 ? 'PROTEINA' : 'PADRAO'
    const nomePao = tipoPao === 'PROTEINA' ? 'Pão Proteína' : 'Pão Francês'

    await prisma.cardapioSemestral.create({
      data: {
        ano: isoYear,
        semana: s + 1,
        numero_semana_iso: isoWeek,
        data_inicio: format(weekMonday, 'yyyy-MM-dd'),
        data_fim: format(weekFriday, 'yyyy-MM-dd'),
        tipo_pao: tipoPao,
        nome_pao: nomePao,
        lanche_regular_id: lancheBiscoito.id,
        lanche_bifasica_id: lancheBolo.id,
      },
    })
  }
  console.log('  ✓ Cardápio Semestral (22 semanas) criado')

  // ── Feriados ─────────────────────────────────────────────────
  const feriados = [
    { data: `${ano}-01-01`, nome: 'Confraternização Universal', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-02-28`, nome: 'Carnaval', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-03-01`, nome: 'Carnaval (2º dia)', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-04-07`, nome: 'Paixão de Cristo', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-04-21`, nome: 'Tiradentes', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-05-01`, nome: 'Dia do Trabalho', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-06-05`, nome: 'Aniversário Lucas do Rio Verde', tipo: 'MUNICIPAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-06-19`, nome: 'Corpus Christi', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-07-20`, nome: 'Dia do Colono', tipo: 'MUNICIPAL', escolas_afetadas: 'INTERIOR', acao: 'zerar_lanche' },
    { data: `${ano}-09-07`, nome: 'Independência do Brasil', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-10-12`, nome: 'Nossa Senhora Aparecida', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-11-02`, nome: 'Finados', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-11-15`, nome: 'Proclamação da República', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
    { data: `${ano}-12-25`, nome: 'Natal', tipo: 'NACIONAL', escolas_afetadas: 'TODAS', acao: 'zerar_dia' },
  ]

  for (const f of feriados) {
    await prisma.feriado.create({ data: f })
  }
  console.log('  ✓ Feriados criados')

  // ── Insumos ──────────────────────────────────────────────────
  const insumos = [
    { nome: 'Farinha de Trigo', unidade: 'kg', preco_unitario: 5.5, estoque_atual: 500, estoque_minimo: 200, fornecedor: 'Moinho Central' },
    { nome: 'Fermento Biológico', unidade: 'kg', preco_unitario: 18.0, estoque_atual: 20, estoque_minimo: 10, fornecedor: 'Fleischmann' },
    { nome: 'Açúcar', unidade: 'kg', preco_unitario: 4.8, estoque_atual: 100, estoque_minimo: 50, fornecedor: 'Usina Solar' },
    { nome: 'Sal', unidade: 'kg', preco_unitario: 2.0, estoque_atual: 50, estoque_minimo: 20, fornecedor: 'Cisne' },
    { nome: 'Óleo de Soja', unidade: 'L', preco_unitario: 7.5, estoque_atual: 40, estoque_minimo: 20, fornecedor: 'Liza' },
    { nome: 'Ovos', unidade: 'un', preco_unitario: 0.65, estoque_atual: 1000, estoque_minimo: 500, fornecedor: 'Granja local' },
    { nome: 'Leite em Pó', unidade: 'kg', preco_unitario: 28.0, estoque_atual: 30, estoque_minimo: 15, fornecedor: 'Nestlé' },
    { nome: 'Margarina', unidade: 'kg', preco_unitario: 9.0, estoque_atual: 25, estoque_minimo: 10, fornecedor: 'Qualy' },
    { nome: 'Queijo Ralado', unidade: 'kg', preco_unitario: 35.0, estoque_atual: 5, estoque_minimo: 3, fornecedor: 'Presunto Lei' },
    { nome: 'Polvilho Doce', unidade: 'kg', preco_unitario: 8.0, estoque_atual: 15, estoque_minimo: 8, fornecedor: 'Yoki' },
  ]

  for (const ins of insumos) {
    await prisma.insumo.create({ data: { ...ins, ativo: true } })
  }
  console.log('  ✓ Insumos criados')

  // ── Receitas ─────────────────────────────────────────────────
  const farinha = await prisma.insumo.findFirst({ where: { nome: 'Farinha de Trigo' } })
  const fermento = await prisma.insumo.findFirst({ where: { nome: 'Fermento Biológico' } })
  const acucar = await prisma.insumo.findFirst({ where: { nome: 'Açúcar' } })
  const salIns = await prisma.insumo.findFirst({ where: { nome: 'Sal' } })
  const oleo = await prisma.insumo.findFirst({ where: { nome: 'Óleo de Soja' } })
  const ovos = await prisma.insumo.findFirst({ where: { nome: 'Ovos' } })
  const leite = await prisma.insumo.findFirst({ where: { nome: 'Leite em Pó' } })
  const margarina = await prisma.insumo.findFirst({ where: { nome: 'Margarina' } })
  const queijo = await prisma.insumo.findFirst({ where: { nome: 'Queijo Ralado' } })
  const polvilho = await prisma.insumo.findFirst({ where: { nome: 'Polvilho Doce' } })

  if (farinha && fermento && salIns && acucar && oleo && ovos && leite && margarina) {
    // Receita PF
    await prisma.receita.createMany({
      data: [
        { produto_tipo: 'PF', insumo_id: farinha.id, quantidade_por_unidade: 0.05 },
        { produto_tipo: 'PF', insumo_id: fermento.id, quantidade_por_unidade: 0.001 },
        { produto_tipo: 'PF', insumo_id: salIns.id, quantidade_por_unidade: 0.001 },
        { produto_tipo: 'PF', insumo_id: acucar.id, quantidade_por_unidade: 0.001 },
        { produto_tipo: 'PF', insumo_id: oleo.id, quantidade_por_unidade: 0.0005 },
      ],
    })

    // Receita PCQ
    await prisma.receita.createMany({
      data: [
        { produto_tipo: 'PCQ', insumo_id: farinha.id, quantidade_por_unidade: 0.06 },
        { produto_tipo: 'PCQ', insumo_id: fermento.id, quantidade_por_unidade: 0.001 },
        { produto_tipo: 'PCQ', insumo_id: salIns.id, quantidade_por_unidade: 0.001 },
        { produto_tipo: 'PCQ', insumo_id: acucar.id, quantidade_por_unidade: 0.002 },
        { produto_tipo: 'PCQ', insumo_id: margarina.id, quantidade_por_unidade: 0.001 },
        { produto_tipo: 'PCQ', insumo_id: leite.id, quantidade_por_unidade: 0.001 },
      ],
    })

    // Receita Lanche (Biscoito)
    await prisma.receita.createMany({
      data: [
        { produto_tipo: 'LANCHE', insumo_id: farinha.id, quantidade_por_unidade: 0.03 },
        { produto_tipo: 'LANCHE', insumo_id: acucar.id, quantidade_por_unidade: 0.01 },
        { produto_tipo: 'LANCHE', insumo_id: margarina.id, quantidade_por_unidade: 0.005 },
        { produto_tipo: 'LANCHE', insumo_id: ovos.id, quantidade_por_unidade: 0.2 },
      ],
    })
  }
  console.log('  ✓ Receitas criadas')

  // ── Importar TODOS os 597 alimentos da TACO ──────────────────
  console.log(`\n🍲 Importando ${tacoData.length} alimentos da TACO...`)
  let created = 0
  let updated = 0
  let errors = 0

  const batchSize = 50
  for (let i = 0; i < tacoData.length; i += batchSize) {
    const batch = tacoData.slice(i, i + batchSize) as any[]
    for (const item of batch) {
      try {
        const existing = await prisma.alimento.findFirst({
          where: { codigo_taco: item.codigo_taco },
        })
        const data = {
          codigo_taco: item.codigo_taco,
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
          ferro_heme_mg: 0,
          vitamina_a_mcg: item.vitamina_a_mcg,
          vitamina_c_mg: item.vitamina_c_mg,
          calcio_mg: item.calcio_mg,
          magnesio_mg: item.magnesio_mg,
          zinco_mg: item.zinco_mg,
          acucar_adicionado_g: item.acucar_adicionado_g ?? 0,
          ativo: true,
        }
        if (existing) {
          await prisma.alimento.update({ where: { id: existing.id }, data })
          updated++
        } else {
          await prisma.alimento.create({ data })
          created++
        }
      } catch (err: any) {
        errors++
        console.error(`  ✗ Erro #${item.codigo_taco} "${item.nome}": ${err.message}`)
      }
    }
    process.stdout.write(`  → ${Math.min(i + batchSize, tacoData.length)}/${tacoData.length} processados\r`)
  }

  console.log('')
  console.log(`  ✓ ${created} criados, ${updated} atualizados, ${errors} erros`)

  const totalAlimentos = await prisma.alimento.count()
  console.log(`  ✓ Total no banco: ${totalAlimentos} alimentos`)

  console.log('✅ Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
