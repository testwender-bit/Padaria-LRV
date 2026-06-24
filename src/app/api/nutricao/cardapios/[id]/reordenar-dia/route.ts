import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularOrdemCanonicaSlot } from '@/lib/ordenacao-preparacoes'

// ============================================================
// POST /api/nutricao/cardapios/[id]/reordenar-dia
// ============================================================
// Re-aplica a ordenação CANÔNICA em um slot (dia + tipo_refeicao),
// resetando qualquer ordem manual definida previamente.
//
// Body:
//   {
//     semana_numero: number,        // 1..22
//     dia_semana: "segunda"|"terca"|"quarta"|"quinta"|"sexta",
//     tipo_refeicao_id?: string     // se omitido, reordena todos os slots do dia
//   }
//
// Lógica:
//   1. Encontra a semana + dia no cardápio
//   2. Carrega os itens do slot (ou de todos os slots do dia)
//   3. Para cada slot, calcula a ordem canônica (resetando ordem manual)
//   4. Atribui ordem=1,2,3... sequencial conforme a ordem canônica
//
// Retorno: { success: true, slots_reordenados: N, itens_reordenados: M }
// ============================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await request.json()

    if (!body.semana_numero || !body.dia_semana) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: semana_numero, dia_semana' },
        { status: 400 }
      )
    }

    const semanaNumero = Number(body.semana_numero)
    const diaSemana = body.dia_semana

    // Valida dia_semana
    const diasValidos = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
    if (!diasValidos.includes(diaSemana)) {
      return NextResponse.json(
        { error: `dia_semana inválido: ${diaSemana}. Use: ${diasValidos.join(', ')}` },
        { status: 400 }
      )
    }

    // Carrega todos os tipos de refeição (para detectar perfil)
    const tiposRefeicao = await db.tipoRefeicao.findMany({
      select: { id: true, codigo: true },
    })

    // Encontra a semana + dia no cardápio
    const semana = await db.cardapioSemanaNutri.findUnique({
      where: {
        cardapio_id_numero: {
          cardapio_id: cardapioId,
          numero: semanaNumero,
        },
      },
      include: {
        dias: {
          where: { dia_semana: diaSemana },
          include: {
            itens: {
              include: {
                preparacao: { select: { id: true, nome: true } },
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
      return NextResponse.json(
        { error: `Dia ${diaSemana} não encontrado na semana ${semanaNumero}` },
        { status: 404 }
      )
    }

    const dia = semana.dias[0]

    // Agrupa itens por tipo_refeicao (cada slot é independente)
    const itensPorSlot = new Map<string, typeof dia.itens>()
    for (const item of dia.itens) {
      const slotKey = item.tipo_refeicao_id
      if (!itensPorSlot.has(slotKey)) itensPorSlot.set(slotKey, [])
      itensPorSlot.get(slotKey)!.push(item)
    }

    // Se tipo_refeicao_id foi informado, filtra só esse slot
    let slotsParaReordenar: Array<{ tipo_refeicao_id: string; itens: typeof dia.itens }>
    if (body.tipo_refeicao_id) {
      const itens = itensPorSlot.get(body.tipo_refeicao_id)
      if (!itens) {
        return NextResponse.json(
          { error: `Slot com tipo_refeicao_id=${body.tipo_refeicao_id} não tem itens neste dia` },
          { status: 404 }
        )
      }
      slotsParaReordenar = [{ tipo_refeicao_id: body.tipo_refeicao_id, itens }]
    } else {
      slotsParaReordenar = Array.from(itensPorSlot.entries()).map(
        ([tipo_refeicao_id, itens]) => ({ tipo_refeicao_id, itens })
      )
    }

    // Re-aplica a ordem canônica em cada slot
    let totalItensReordenados = 0
    const result = await db.$transaction(async (tx) => {
      for (const slot of slotsParaReordenar) {
        if (slot.itens.length <= 1) continue

        // Calcula ordem canônica (ignorando ordem manual atual)
        const ordenados = calcularOrdemCanonicaSlot(slot.itens, tiposRefeicao)

        // Atribui ordem=1,2,3... sequencial
        for (let i = 0; i < ordenados.length; i++) {
          await tx.cardapioItem.update({
            where: { id: ordenados[i].id },
            data: { ordem: i + 1 },
          })
          totalItensReordenados++
        }
      }
      return { slots_reordenados: slotsParaReordenar.length, itens_reordenados: totalItensReordenados }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Erro ao reordenar dia:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao reordenar dia' },
      { status: 500 }
    )
  }
}
