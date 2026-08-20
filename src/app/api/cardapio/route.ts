import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const cardapio = await db.cardapioSemestral.findMany({
      include: { lanche_regular: true, lanche_bifasica: true },
      orderBy: [{ ano: 'asc' }, { semana: 'asc' }],
    })
    return NextResponse.json(cardapio)
  } catch (error) {
    console.error('Erro ao buscar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao buscar cardápio' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const cardapio = await db.cardapioSemestral.upsert({
      where: { ano_semana: { ano: body.ano, semana: body.semana } },
      update: {
        numero_semana_iso: body.numero_semana_iso,
        data_inicio: body.data_inicio,
        data_fim: body.data_fim,
        tipo_pao: body.tipo_pao || 'PADRAO',
        nome_pao: body.nome_pao || 'Pão Francês',
        lanche_regular_id: body.lanche_regular_id,
        lanche_bifasica_id: body.lanche_bifasica_id,
        obs: body.obs,
      },
      create: {
        ano: body.ano,
        semana: body.semana,
        numero_semana_iso: body.numero_semana_iso,
        data_inicio: body.data_inicio,
        data_fim: body.data_fim,
        tipo_pao: body.tipo_pao || 'PADRAO',
        nome_pao: body.nome_pao || 'Pão Francês',
        lanche_regular_id: body.lanche_regular_id,
        lanche_bifasica_id: body.lanche_bifasica_id,
        obs: body.obs,
      },
    })
    return NextResponse.json(cardapio)
  } catch (error) {
    console.error('Erro ao criar/atualizar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao criar cardápio' }, { status: 500 })
  }
}

// v9.7.5: PATCH para atualizar campos parciais do cardápio semestral.
// Usado pela edição inline do "Aviso da Semana" (obs) na página de Produção.
// Recebe { ano, semana, obs? } e atualiza apenas os campos fornecidos.
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    if (!body.ano || !body.semana) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: ano, semana' },
        { status: 400 }
      )
    }

    // Busca o cardápio existente
    const existente = await db.cardapioSemestral.findUnique({
      where: { ano_semana: { ano: body.ano, semana: body.semana } },
    })
    if (!existente) {
      return NextResponse.json(
        { error: `Cardápio da semana ${body.semana}/${body.ano} não encontrado` },
        { status: 404 }
      )
    }

    // Monta apenas os campos fornecidos para atualização
    const dadosAtualizacao: Record<string, unknown> = {}
    if (typeof body.obs === 'string') {
      // vazio vira null (banner some da UI)
      dadosAtualizacao.obs = body.obs.trim() === '' ? null : body.obs.trim()
    }

    if (Object.keys(dadosAtualizacao).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo fornecido para atualização' },
        { status: 400 }
      )
    }

    const atualizado = await db.cardapioSemestral.update({
      where: { id: existente.id },
      data: dadosAtualizacao,
    })
    return NextResponse.json(atualizado)
  } catch (error) {
    console.error('Erro ao atualizar cardápio (PATCH):', error)
    return NextResponse.json({ error: 'Erro ao atualizar cardápio' }, { status: 500 })
  }
}
