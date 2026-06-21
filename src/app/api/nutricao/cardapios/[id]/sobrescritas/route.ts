import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/nutricao/cardapios/[id]/sobrescritas
// Lista todas as sobrescritas de um cardápio (instância escola)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sobrescritas = await db.sobrescritaCardapio.findMany({
      where: { cardapio_id: id },
      include: {
        tipo_refeicao: true,
        preparacao_substituta: { select: { id: true, nome: true } },
      },
      orderBy: [{ semana_numero: 'asc' }, { dia_semana: 'asc' }],
    })
    return NextResponse.json(sobrescritas)
  } catch (error) {
    console.error('Erro ao buscar sobrescritas:', error)
    return NextResponse.json({ error: 'Erro ao buscar sobrescritas' }, { status: 500 })
  }
}

// POST /api/nutricao/cardapios/[id]/sobrescritas
// Body: {
//   semana_numero: number,
//   dia_semana: string,
//   tipo_refeicao_id: string,
//   preparacao_substituta_id: string,
//   motivo?: string
// }
// Cria ou atualiza uma sobrescrita para uma escola.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await request.json()

    if (!body.semana_numero || !body.dia_semana || !body.tipo_refeicao_id || !body.preparacao_substituta_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: semana_numero, dia_semana, tipo_refeicao_id, preparacao_substituta_id' },
        { status: 400 }
      )
    }

    const criadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)

    const sobrescrita = await db.sobrescritaCardapio.upsert({
      where: {
        cardapio_id_semana_numero_dia_semana_tipo_refeicao_id: {
          cardapio_id: cardapioId,
          semana_numero: body.semana_numero,
          dia_semana: body.dia_semana,
          tipo_refeicao_id: body.tipo_refeicao_id,
        },
      },
      update: {
        preparacao_substituta_id: body.preparacao_substituta_id,
        motivo: body.motivo || null,
      },
      create: {
        cardapio_id: cardapioId,
        semana_numero: body.semana_numero,
        dia_semana: body.dia_semana,
        tipo_refeicao_id: body.tipo_refeicao_id,
        preparacao_substituta_id: body.preparacao_substituta_id,
        motivo: body.motivo || null,
        criado_em: criadoEm,
      },
    })

    // Atualiza data de alteração do cardápio
    await db.cardapioNutricional.update({
      where: { id: cardapioId },
      data: { atualizado_em: criadoEm },
    })

    return NextResponse.json(sobrescrita, { status: 201 })
  } catch (error) {
    console.error('Erro ao salvar sobrescrita:', error)
    return NextResponse.json({ error: 'Erro ao salvar sobrescrita' }, { status: 500 })
  }
}

// DELETE /api/nutricao/cardapios/[id]/sobrescritas?sobrescrita_id=xxx
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const { searchParams } = new URL(request.url)
    const sobrescritaId = searchParams.get('sobrescrita_id')

    if (sobrescritaId) {
      await db.sobrescritaCardapio.delete({
        where: { id: sobrescritaId, cardapio_id: cardapioId },
      })
    } else {
      // Limpa todas as sobrescritas do cardápio
      await db.sobrescritaCardapio.deleteMany({
        where: { cardapio_id: cardapioId },
      })
    }

    const criadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)
    await db.cardapioNutricional.update({
      where: { id: cardapioId },
      data: { atualizado_em: criadoEm },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar sobrescrita:', error)
    return NextResponse.json({ error: 'Erro ao deletar sobrescrita' }, { status: 500 })
  }
}
