// ============================================================
// scripts/recalcular-ordenacao-v11.ts
// ============================================================
// Re-aplica a ordenação CANÔNICA em TODOS os slots de TODAS as
// semanas de TODOS os cardápios. Usa a mesma lógica do endpoint
// /api/nutricao/cardapios/[id]/reordenar-semana, mas varre o
// banco inteiro de uma vez.
//
// MOTIVO (v8.11):
//   O perfil CUSCUZ foi alterado — agora BEBIDA/SUCO tem prioridade 0
//   (vai para o início, antes do cuscuz). Antes o suco ficava depois
//   do cuscuz e da proteína, o que era inconsistente com o PAO_LANCHE
//   (onde o suco já vinha primeiro).
//
//   Este script re-aplica a nova lógica retroativamente, resetando
//   qualquer ordem manual salva nos slots afetados.
//
// USO:
//   npx tsx scripts/recalcular-ordenacao-v11.ts          # dry-run (apenas relata)
//   npx tsx scripts/recalcular-ordenacao-v11.ts --apply   # aplica no banco
// ============================================================

import { PrismaClient } from '@prisma/client'
import { calcularOrdemCanonicaSlot } from '../src/lib/ordenacao-preparacoes'

const prisma = new PrismaClient()
const MODO_APLICAR = process.argv.includes('--apply')

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('🔢 RECALCULAR ORDENAÇÃO CANÔNICA — v8.11 (suco primeiro no CUSCUZ)')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN (use --apply para gravar)'}\n`)

  // 1. Carrega todos os tipos de refeição
  const tiposRefeicao = await prisma.tipoRefeicao.findMany({
    select: { id: true, codigo: true },
  })
  console.log(`📊 Tipos de refeição carregados: ${tiposRefeicao.length}`)

  // 2. Carrega todos os cardápios (resumo)
  const cardapios = await prisma.cardapioNutricional.findMany({
    select: {
      id: true,
      nome: true,
      escola_id: true,
      ano: true,
      semestre: true,
    },
    orderBy: { criado_em: 'desc' },
  })
  console.log(`📊 Total de cardápios: ${cardapios.length}`)

  // 3. Carrega TODAS as semanas com dias e itens
  const semanas = await prisma.cardapioSemanaNutri.findMany({
    include: {
      dias: {
        include: {
          itens: {
            include: {
              preparacao: { select: { id: true, nome: true, categoria: true } },
              tipo_refeicao: { select: { id: true, codigo: true } },
            },
          },
        },
      },
    },
  })
  console.log(`📊 Total de semanas: ${semanas.length}`)

  let totalSlots = 0
  let slotsReordenados = 0
  let itensReordenados = 0
  let slotsComCuscuz = 0
  let slotsComCuscuzESuco = 0

  // Estatística por perfil (para o relatório)
  const perfilStats: Record<string, number> = { PAO_LANCHE: 0, COMIDA: 0, CUSCUZ: 0 }

  // Acumula TODAS as atualizações em uma lista para executar em UMA transação
  // (muito mais rápido que uma query por item no Supabase free tier)
  const updatesPendentes: Array<{ id: string; ordem: number }> = []
  const exemplosLog: Array<{ cardapio: string; semana: number; dia: string; antes: string[]; depois: string[] }> = []

  for (const semana of semanas) {
    for (const dia of semana.dias) {
      // Agrupa itens por slot (tipo_refeicao_id)
      const itensPorSlot = new Map<string, typeof dia.itens>()
      for (const item of dia.itens) {
        const key = item.tipo_refeicao_id
        if (!itensPorSlot.has(key)) itensPorSlot.set(key, [])
        itensPorSlot.get(key)!.push(item)
      }

      for (const [, itens] of itensPorSlot) {
        if (itens.length <= 1) continue
        totalSlots++

        // Detecta se tem cuscuz (para estatística)
        const temCuscuz = itens.some(i =>
          /cuscuz|cuscu/i.test(i.preparacao.nome)
        )
        const temSuco = itens.some(i =>
          /suco/i.test(i.preparacao.nome) ||
          i.preparacao.categoria === 'BEBIDA' ||
          i.preparacao.categoria === 'SUCO'
        )
        if (temCuscuz) {
          slotsComCuscuz++
          if (temSuco) slotsComCuscuzESuco++
        }

        // Calcula ordem canônica (já com a regra v8.11)
        const ordenados = calcularOrdemCanonicaSlot(itens, tiposRefeicao)

        // Verifica se mudou alguma posição
        let mudou = false
        for (let i = 0; i < ordenados.length; i++) {
          if (ordenados[i].id !== itens[i].id) {
            mudou = true
            break
          }
        }
        if (!mudou) continue

        slotsReordenados++

        // Atualiza estatística de perfil
        const primeiroNome = ordenados[0]?.preparacao.nome.toLowerCase() || ''
        if (primeiroNome.includes('cuscuz')) perfilStats.CUSCUZ++
        else if (/suco|bebida|leite|vitamina|café|chá/i.test(primeiroNome)) perfilStats.PAO_LANCHE++
        else perfilStats.COMIDA++

        // Acumula atualizações (apenas itens que realmente mudaram)
        for (let i = 0; i < ordenados.length; i++) {
          const novaOrdem = i + 1
          if (ordenados[i].ordem !== novaOrdem) {
            updatesPendentes.push({ id: ordenados[i].id, ordem: novaOrdem })
            itensReordenados++
          }
        }

        // Log de exemplo (apenas os primeiros 10 com cuscuz/suco)
        if (exemplosLog.length < 10 && (temCuscuz || temSuco)) {
          const cardapio = cardapios.find(c => c.id === semana.cardapio_id)
          exemplosLog.push({
            cardapio: cardapio?.nome || '?',
            semana: semana.numero,
            dia: dia.dia_semana,
            antes: itens.map(it => `${it.ordem || 0}·${it.preparacao.nome}`),
            depois: ordenados.map(it => it.preparacao.nome),
          })
        }
      }
    }
  }

  // Log dos exemplos coletados
  for (const ex of exemplosLog) {
    console.log(`\n  📍 Cardápio "${ex.cardapio}" · Semana ${ex.semana} · ${ex.dia}:`)
    console.log(`     ANTES: ${ex.antes.join(' | ')}`)
    console.log(`     DEPOIS: ${ex.depois.join(' → ')}`)
  }

  // Aplica TODAS as atualizações em UMA transação (batch) se houver mudanças
  if (MODO_APLICAR && updatesPendentes.length > 0) {
    console.log(`\n🔄 Aplicando ${updatesPendentes.length} atualizações em batch...`)
    const batchSize = 500
    let applied = 0
    for (let i = 0; i < updatesPendentes.length; i += batchSize) {
      const batch = updatesPendentes.slice(i, i + batchSize)
      await prisma.$transaction(
        batch.map(u => prisma.cardapioItem.update({
          where: { id: u.id },
          data: { ordem: u.ordem },
        })),
        { timeout: 120000, maxWait: 10000 }
      )
      applied += batch.length
      console.log(`   ✓ ${applied}/${updatesPendentes.length} atualizados...`)
    }
    console.log(`✅ Todas as atualizações aplicadas.`)
  }

  console.log('\n' + '═'.repeat(70))
  console.log('📋 RELATÓRIO FINAL')
  console.log('═'.repeat(70))
  console.log(`Total de slots analisados:       ${totalSlots}`)
  console.log(`Slots com cuscuz:                ${slotsComCuscuz}`)
  console.log(`Slots com cuscuz E suco/bebida:  ${slotsComCuscuzESuco} ← alvo principal do v8.11`)
  console.log(`Slots que mudarão de ordem:      ${slotsReordenados}`)
  console.log(`Itens que mudarão de ordem:      ${itensReordenados}`)
  console.log(`\nDistribuição por perfil (inferido pela 1ª posição):`)
  console.log(`  PAO_LANCHE: ${perfilStats.PAO_LANCHE}`)
  console.log(`  COMIDA:     ${perfilStats.COMIDA}`)
  console.log(`  CUSCUZ:     ${perfilStats.CUSCUZ}`)
  console.log(`\n${MODO_APLICAR
    ? '✅ ALTERAÇÕES APLICADAS no banco de dados.'
    : '👁️  DRY-RUN. Para aplicar de fato, rode com --apply'}`)
  console.log('═'.repeat(70) + '\n')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
