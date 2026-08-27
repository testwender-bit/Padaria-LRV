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
    // v9.8: validação básica do lanche_bifasica_modo (se fornecido)
    const modosValidos = ['LANCHE', 'PAO_PADRAO', 'PAO_PROTEINA', 'NENHUM']
    const modoBifasica = body.lanche_bifasica_modo || 'LANCHE'
    if (!modosValidos.includes(modoBifasica)) {
      return NextResponse.json(
        { error: `lanche_bifasica_modo inválido. Valores aceitos: ${modosValidos.join(', ')}` },
        { status: 400 }
      )
    }

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
        // v9.8: novo campo
        lanche_bifasica_modo: modoBifasica,
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
        // v9.8: novo campo
        lanche_bifasica_modo: modoBifasica,
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
// Recebe { cardapio_id?, ano?, semana?, obs?, lanche_bifasica_modo? }.
// v9.8.7: aceita cardapio_id como alternativa a ano+semana. O cardapio_id
// é mais confiável porque ano+semana da API de produção retornam o número
// ISO da semana (1-52), não a semana letiva (1-22) que é a chave única.
export async function PATCH(request: Request) {
  try {
    const body = await request.json()

    // Busca o cardápio existente — pode ser por cardapio_id (preferencial)
    // ou por ano+semana (chave composta ano_semana).
    let existente
    if (body.cardapio_id) {
      existente = await db.cardapioSemestral.findUnique({
        where: { id: body.cardapio_id },
      })
    } else if (body.ano && body.semana) {
      existente = await db.cardapioSemestral.findUnique({
        where: { ano_semana: { ano: body.ano, semana: body.semana } },
      })
    }

    if (!existente) {
      return NextResponse.json(
        { error: `Cardápio não encontrado (cardapio_id=${body.cardapio_id || 'não fornecido'}, ano=${body.ano || '?'}, semana=${body.semana || '?'})` },
        { status: 404 }
      )
    }

    // Monta apenas os campos fornecidos para atualização
    const dadosAtualizacao: Record<string, unknown> = {}
    if (typeof body.obs === 'string') {
      // vazio vira null (banner some da UI)
      dadosAtualizacao.obs = body.obs.trim() === '' ? null : body.obs.trim()
    }
    // v9.8: atualizar lanche_bifasica_modo via PATCH também
    if (typeof body.lanche_bifasica_modo === 'string') {
      const modosValidos = ['LANCHE', 'PAO_PADRAO', 'PAO_PROTEINA', 'NENHUM']
      if (!modosValidos.includes(body.lanche_bifasica_modo)) {
        return NextResponse.json(
          { error: `lanche_bifasica_modo inválido. Valores aceitos: ${modosValidos.join(', ')}` },
          { status: 400 }
        )
      }
      dadosAtualizacao.lanche_bifasica_modo = body.lanche_bifasica_modo
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
