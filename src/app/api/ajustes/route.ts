import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString())
    const semana = parseInt(searchParams.get('semana') || '0')

    if (semana > 0) {
      const ajustes = await db.ajuste.findMany({
        where: { ano, semana },
        include: { escola: true },
        orderBy: [{ escola_id: 'asc' }, { dia_semana: 'asc' }],
      })
      return NextResponse.json(ajustes)
    }

    const ajustes = await db.ajuste.findMany({
      where: { ano },
      include: { escola: true },
      orderBy: [{ semana: 'asc' }, { escola_id: 'asc' }],
    })
    return NextResponse.json(ajustes)
  } catch (error) {
    console.error('Erro ao buscar ajustes:', error)
    return NextResponse.json({ error: 'Erro ao buscar ajustes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Validate required fields
    if (!body.ano || !body.semana || !body.escola_id || !body.dia_semana || !body.produto) {
      return NextResponse.json({ error: 'Campos obrigatórios: ano, semana, escola_id, dia_semana, produto' }, { status: 400 })
    }
    if (typeof body.qtd_final !== 'number' || body.qtd_final < 0) {
      return NextResponse.json({ error: 'qtd_final deve ser um número não negativo' }, { status: 400 })
    }
    // v9.10.6: valida a existência da escola ANTES do upsert — evita o erro
    // P2003 "Foreign key constraint violated: Ajuste_escola_id_fkey" quando a
    // UI manda um id que não existe na tabela Escola (ex.: pseudo-escola
    // "extra_..." do Inst. Extra clicada por engano, ou escola removida com a
    // tela desatualizada). Resposta amigável em vez de 500 no console.
    const escolaExiste = await db.escola.findUnique({
      where: { id: body.escola_id },
      select: { id: true },
    })
    if (!escolaExiste) {
      return NextResponse.json(
        { error: 'Escola não encontrada para este ajuste. Atualize a página e tente de novo. (Instituições cadastradas no "Inst. Extra" não usam ajuste — edite pelo botão "Inst. Extra" na Produção.)' },
        { status: 400 }
      )
    }
    const ajuste = await db.ajuste.upsert({
      where: {
        ano_semana_escola_id_dia_semana_produto: {
          ano: body.ano,
          semana: body.semana,
          escola_id: body.escola_id,
          dia_semana: body.dia_semana,
          produto: body.produto,
        },
      },
      update: {
        qtd_original: body.qtd_original,
        ajuste: body.ajuste,
        qtd_final: body.qtd_final,
        motivo: body.motivo,
      },
      create: {
        ano: body.ano,
        semana: body.semana,
        escola_id: body.escola_id,
        dia_semana: body.dia_semana,
        produto: body.produto,
        qtd_original: body.qtd_original,
        ajuste: body.ajuste,
        qtd_final: body.qtd_final,
        motivo: body.motivo,
      },
    })
    return NextResponse.json(ajuste)
  } catch (error) {
    console.error('Erro ao criar/atualizar ajuste:', error)
    return NextResponse.json({ error: 'Erro ao criar ajuste' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ano = parseInt(searchParams.get('ano') || '0')
    const semana = parseInt(searchParams.get('semana') || '0')
    const escola_id = searchParams.get('escola_id') || ''
    const dia_semana = searchParams.get('dia_semana') || ''
    const produto = searchParams.get('produto') || ''

    if (ano && semana && escola_id && dia_semana && produto) {
      try {
        await db.ajuste.delete({
          where: {
            ano_semana_escola_id_dia_semana_produto: {
              ano, semana, escola_id, dia_semana, produto,
            },
          },
        })
      } catch (err: any) {
        // v9.10.6: P2025 (ajuste já não existe) — remoção idempotente, não é erro
        if (err?.code === 'P2025') {
          return NextResponse.json({ success: true })
        }
        throw err
      }
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'Parâmetros insuficientes' }, { status: 400 })
  } catch (error) {
    console.error('Erro ao deletar ajuste:', error)
    return NextResponse.json({ error: 'Erro ao deletar ajuste' }, { status: 500 })
  }
}
