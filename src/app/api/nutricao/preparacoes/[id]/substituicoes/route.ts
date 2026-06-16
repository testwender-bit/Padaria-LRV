import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/nutricao/preparacoes/[id]/substituicoes
// Lista substituições equivalentes para uma preparação
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Buscar substituições em ambos os sentidos (origem→destino OU destino→origem)
    const [comoOrigem, comoDestino] = await Promise.all([
      db.preparacaoSubstituicao.findMany({
        where: { preparacao_origem_id: id },
        include: {
          preparacao_destino: {
            select: {
              id: true, nome: true, descricao: true, favorita: true, vezes_usada: true,
              ingredientes: { include: { alimento: { select: { id: true, nome: true, grupo: true } } } },
            },
          },
        },
      }),
      db.preparacaoSubstituicao.findMany({
        where: { preparacao_destino_id: id },
        include: {
          preparacao_origem: {
            select: {
              id: true, nome: true, descricao: true, favorita: true, vezes_usada: true,
              ingredientes: { include: { alimento: { select: { id: true, nome: true, grupo: true } } } },
            },
          },
        },
      }),
    ])

    const substituicoes = [
      ...comoOrigem.map((s) => ({ ...s.preparacao_destino, motivo: s.motivo, direcao: 'origem→destino' })),
      ...comoDestino.map((s) => ({ ...s.preparacao_origem, motivo: s.motivo, direcao: 'destino→origem' })),
    ]

    return NextResponse.json(substituicoes)
  } catch (error) {
    console.error('Erro ao buscar substituições:', error)
    return NextResponse.json({ error: 'Erro ao buscar substituições' }, { status: 500 })
  }
}

// POST /api/nutricao/preparacoes/[id]/substituicoes
// Body: { preparacao_substituta_id: string, motivo?: string }
// Cria uma relação de equivalência entre duas preparações (bidirecional logicamente)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: preparacaoId } = await params
    const body = await request.json()

    if (!body.preparacao_substituta_id) {
      return NextResponse.json(
        { error: 'Campo obrigatório: preparacao_substituta_id' },
        { status: 400 }
      )
    }

    if (body.preparacao_substituta_id === preparacaoId) {
      return NextResponse.json(
        { error: 'Não é possível criar substituição com a mesma preparação' },
        { status: 400 }
      )
    }

    const criadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)

    // Criar ambas as direções para facilitar consulta
    const [rel1, rel2] = await db.$transaction(async (tx) => {
      const a = await tx.preparacaoSubstituicao.upsert({
        where: {
          preparacao_origem_id_preparacao_destino_id: {
            preparacao_origem_id: preparacaoId,
            preparacao_destino_id: body.preparacao_substituta_id,
          },
        },
        update: { motivo: body.motivo || 'MESMO_GRUPO' },
        create: {
          preparacao_origem_id: preparacaoId,
          preparacao_destino_id: body.preparacao_substituta_id,
          motivo: body.motivo || 'MESMO_GRUPO',
          criado_em: criadoEm,
        },
      })
      const b = await tx.preparacaoSubstituicao.upsert({
        where: {
          preparacao_origem_id_preparacao_destino_id: {
            preparacao_origem_id: body.preparacao_substituta_id,
            preparacao_destino_id: preparacaoId,
          },
        },
        update: { motivo: body.motivo || 'MESMO_GRUPO' },
        create: {
          preparacao_origem_id: body.preparacao_substituta_id,
          preparacao_destino_id: preparacaoId,
          motivo: body.motivo || 'MESMO_GRUPO',
          criado_em: criadoEm,
        },
      })
      return [a, b]
    })

    return NextResponse.json({ rel1, rel2 }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar substituição:', error)
    return NextResponse.json({ error: 'Erro ao criar substituição' }, { status: 500 })
  }
}

// DELETE /api/nutricao/preparacoes/[id]/substituicoes?substituta_id=xxx
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: preparacaoId } = await params
    const { searchParams } = new URL(request.url)
    const substitutaId = searchParams.get('substituta_id')

    if (!substitutaId) {
      return NextResponse.json(
        { error: 'Query param obrigatório: substituta_id' },
        { status: 400 }
      )
    }

    await db.preparacaoSubstituicao.deleteMany({
      where: {
        OR: [
          { preparacao_origem_id: preparacaoId, preparacao_destino_id: substitutaId },
          { preparacao_origem_id: substitutaId, preparacao_destino_id: preparacaoId },
        ],
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar substituição:', error)
    return NextResponse.json({ error: 'Erro ao deletar substituição' }, { status: 500 })
  }
}
