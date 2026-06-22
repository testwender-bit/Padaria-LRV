import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// /api/nutricao/cardapios/[id]/horarios
// ============================================================
// CRUD para horários customizados de refeições por cardápio.
// Permite que cada cardápio sobrescreva o horário default de
// cada tipo de refeição (ex: "Lanche 09h00 / 15h00").
//
// GET    /api/nutricao/cardapios/[id]/horarios
//   → retorna todos os horários customizados do cardápio
//   → array de { id, tipo_refeicao_id, horario, multiplicador }
//
// POST   /api/nutricao/cardapios/[id]/horarios
//   body: { tipo_refeicao_id, horario, multiplicador? }
//   → cria ou atualiza (upsert baseado em [cardapio_id, tipo_refeicao_id])
//
// DELETE /api/nutricao/cardapios/[id]/horarios?tipo_refeicao_id=xxx
//   → remove o override (volta a usar o default de TipoRefeicao)
// ============================================================

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params

    const horarios = await db.cardapioHorarioRefeicao.findMany({
      where: { cardapio_id: cardapioId },
      include: {
        tipo_refeicao: {
          select: { id: true, codigo: true, nome: true, horario: true, ordem: true },
        },
      },
      orderBy: { tipo_refeicao: { ordem: 'asc' } },
    })

    return NextResponse.json(horarios)
  } catch (error) {
    console.error('Erro ao buscar horários:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar horários' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await req.json()

    if (!body.tipo_refeicao_id || !body.horario) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: tipo_refeicao_id, horario' },
        { status: 400 }
      )
    }

    // Validação: cardápio existe?
    const cardapio = await db.cardapioNutricional.findUnique({
      where: { id: cardapioId },
      select: { id: true },
    })
    if (!cardapio) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    // Validação: tipo_refeicao existe?
    const tipoRefeicao = await db.tipoRefeicao.findUnique({
      where: { id: body.tipo_refeicao_id },
      select: { id: true },
    })
    if (!tipoRefeicao) {
      return NextResponse.json({ error: 'Tipo de refeição não encontrado' }, { status: 404 })
    }

    // Conta quantos horários separados por "/" existem na string
    // ex: "09h00 / 15h00" → 2 horários → multiplicador = 2
    const multiplicador = body.multiplicador
      ? Number(body.multiplicador)
      : (String(body.horario).split('/').length || 1)

    // Upsert baseado na combinação única [cardapio_id, tipo_refeicao_id]
    const horario = await db.cardapioHorarioRefeicao.upsert({
      where: {
        cardapio_id_tipo_refeicao_id: {
          cardapio_id: cardapioId,
          tipo_refeicao_id: body.tipo_refeicao_id,
        },
      },
      update: {
        horario: String(body.horario).trim(),
        multiplicador,
      },
      create: {
        cardapio_id: cardapioId,
        tipo_refeicao_id: body.tipo_refeicao_id,
        horario: String(body.horario).trim(),
        multiplicador,
      },
      include: {
        tipo_refeicao: {
          select: { id: true, codigo: true, nome: true, horario: true, ordem: true },
        },
      },
    })

    return NextResponse.json(horario)
  } catch (error) {
    console.error('Erro ao salvar horário:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao salvar horário' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const { searchParams } = new URL(req.url)
    const tipoRefeicaoId = searchParams.get('tipo_refeicao_id')

    if (!tipoRefeicaoId) {
      return NextResponse.json(
        { error: 'Parâmetro obrigatório: tipo_refeicao_id' },
        { status: 400 }
      )
    }

    await db.cardapioHorarioRefeicao.deleteMany({
      where: {
        cardapio_id: cardapioId,
        tipo_refeicao_id: tipoRefeicaoId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao remover horário:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover horário' },
      { status: 500 }
    )
  }
}
