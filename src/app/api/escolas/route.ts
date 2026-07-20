import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const incluirInativas = searchParams.get('incluir_inativas') === 'true'

    const escolas = await db.escola.findMany({
      where: incluirInativas ? {} : { ativo: true },
      include: { pf_quantidades: true, pcq_quantidades: true },
      // v9.5.7: ordem puramente SEQUENCIAL — sem agrupar por rota.
      // Apenas ordem_rota → nome_curto. Isso garante que a configuração
      // mostre as escolas na mesma ordem que aparecem na produção.
      orderBy: [{ ordem_rota: 'asc' }, { nome_curto: 'asc' }],
    })
    return NextResponse.json(escolas)
  } catch (error) {
    console.error('Erro ao buscar escolas:', error)
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.nome || typeof body.nome !== 'string' || body.nome.trim().length < 2) {
      return NextResponse.json({ error: 'Nome da escola é obrigatório (mínimo 2 caracteres)' }, { status: 400 })
    }
    const escola = await db.escola.create({
      data: {
        nome: body.nome,
        nome_curto: body.nome_curto || body.nome.substring(0, 20),
        categoria: body.categoria || 'REGULAR',
        rota: body.rota || 'JOSE',
        busca_propria: body.busca_propria || false,
        recebe_pf: body.recebe_pf !== false,
        recebe_pcq: body.recebe_pcq !== false,
        recebe_lanche: body.recebe_lanche !== false,
        ativo: body.ativo !== false,
        ordem_rota: body.ordem_rota || 0,
        obs: body.obs,
        // v9.5.7: pao_fixo — sempre usar quantidade padrão de PF
        pao_fixo: body.pao_fixo === true,
        // ── Novos campos v6 ──
        segmento: body.segmento || 'REGULAR',
        alunos_parcial: body.alunos_parcial || 0,
        alunos_integral: body.alunos_integral || 0,
        dia_pao_frances: body.dia_pao_frances || null,
        dia_lanche: body.dia_lanche || null,
        mescla_parcial_integral: body.mescla_parcial_integral || false,
      },
    })

    // Create default PF quantities
    await db.pfQuantidade.create({
      data: {
        escola_id: escola.id,
        tipo_pao: 'PADRAO',
        segunda: 0, terca: 0, quarta: 0, quinta: 0, sexta: 0,
      },
    })

    // Create default PCQ quantities if school receives PCQ
    if (escola.recebe_pcq) {
      await db.pcqQuantidade.create({
        data: {
          escola_id: escola.id,
          prod_segunda: 0, prod_quarta: 0, prod_sexta: 0,
          pf_comp_segunda: 0, pf_comp_quarta: 0, pf_comp_sexta: 0,
        },
      })
    }

    return NextResponse.json(escola, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar escola:', error)
    return NextResponse.json({ error: 'Erro ao criar escola' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    if (body.nome !== undefined && (typeof body.nome !== 'string' || body.nome.trim().length < 2)) {
      return NextResponse.json({ error: 'Nome deve ter no mínimo 2 caracteres' }, { status: 400 })
    }

    const escola = await db.escola.update({
      where: { id: body.id },
      data: {
        nome: body.nome,
        nome_curto: body.nome_curto,
        categoria: body.categoria,
        rota: body.rota,
        busca_propria: body.busca_propria,
        recebe_pf: body.recebe_pf,
        recebe_pcq: body.recebe_pcq,
        recebe_lanche: body.recebe_lanche,
        ativo: body.ativo,
        ordem_rota: body.ordem_rota,
        obs: body.obs,
        // v9.5.7: pao_fixo — sempre usar quantidade padrão de PF
        pao_fixo: body.pao_fixo,
        // ── Novos campos v6 ──
        segmento: body.segmento,
        alunos_parcial: body.alunos_parcial,
        alunos_integral: body.alunos_integral,
        dia_pao_frances: body.dia_pao_frances,
        dia_lanche: body.dia_lanche,
        mescla_parcial_integral: body.mescla_parcial_integral,
      },
    })
    return NextResponse.json(escola)
  } catch (error) {
    console.error('Erro ao atualizar escola:', error)
    return NextResponse.json({ error: 'Erro ao atualizar escola' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    
    await db.escola.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar escola:', error)
    return NextResponse.json({ error: 'Erro ao deletar escola' }, { status: 500 })
  }
}
