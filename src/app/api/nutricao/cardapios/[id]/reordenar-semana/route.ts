import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularOrdemCanonicaSlot } from '@/lib/ordenacao-preparacoes'

// ============================================================
// POST /api/nutricao/cardapios/[id]/reordenar-semana
// ============================================================
// Re-aplica a ordenação CANÔNICA em TODOS os slots de TODOS os dias
// de uma semana do cardápio, resetando qualquer ordem manual definida.
//
// Body:
//   { semana_numero: number }   // 1..22
//
// Lógica:
//   1. Encontra a semana no cardápio
//   2. Para cada dia (seg..sex) da semana:
//      - Para cada slot (dia + tipo_refeicao):
//        - Calcula ordem canônica (ignorando ordem manual)
//        - Atribui ordem=1,2,3... sequencial
//
// v6 — substitui o endpoint /reordenar-dia (que era por dia).
// Agora o botão é "Reordenar semana" no header da semana.
//
// Retorno: { success: true, dias_reordenados: N, slots_reordenados: M, itens_reordenados: K }
// ============================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await request.json()

    if (!body.semana_numero) {
      return NextResponse.json(
        { error: 'Campo obrigatório: semana_numero' },
        { status: 400 }
      )
    }

    const semanaNumero = Number(body.semana_numero)

    // Carrega todos os tipos de refeição (para detectar perfil)
    const tiposRefeicao = await db.tipoRefeicao.findMany({
      select: { id: true, codigo: true },
    })

    // Encontra a semana com todos os dias e itens
    const semana = await db.cardapioSemanaNutri.findUnique({
      where: {
        cardapio_id_numero: {
          cardapio_id: cardapioId,
          numero: semanaNumero,
        },
      },
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

    if (!semana) {
      return NextResponse.json(
        { error: `Semana ${semanaNumero} não encontrada neste cardápio` },
        { status: 404 }
      )
    }

    if (semana.dias.length === 0) {
      return NextResponse.json({
        success: true,
        dias_reordenados: 0,
        slots_reordenados: 0,
        itens_reordenados: 0,
      })
    }

    let totalSlotsReordenados = 0
    let totalItensReordenados = 0

    const result = await db.$transaction(async (tx) => {
      for (const dia of semana.dias) {
        // Agrupa itens do dia por tipo_refeicao (cada slot é independente)
        const itensPorSlot = new Map<string, typeof dia.itens>()
        for (const item of dia.itens) {
          const slotKey = item.tipo_refeicao_id
          if (!itensPorSlot.has(slotKey)) itensPorSlot.set(slotKey, [])
          itensPorSlot.get(slotKey)!.push(item)
        }

        // Re-aplica a ordem canônica em cada slot
        for (const [, itens] of itensPorSlot) {
          if (itens.length <= 1) continue

          // Calcula ordem canônica (ignorando ordem manual atual)
          const ordenados = calcularOrdemCanonicaSlot(itens, tiposRefeicao)

          // Atribui ordem=1,2,3... sequencial
          for (let i = 0; i < ordenados.length; i++) {
            await tx.cardapioItem.update({
              where: { id: ordenados[i].id },
              data: { ordem: i + 1 },
            })
            totalItensReordenados++
          }
          totalSlotsReordenados++
        }
      }

      return {
        dias_reordenados: semana.dias.length,
        slots_reordenados: totalSlotsReordenados,
        itens_reordenados: totalItensReordenados,
      }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Erro ao reordenar semana:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao reordenar semana' },
      { status: 500 }
    )
  }
}
