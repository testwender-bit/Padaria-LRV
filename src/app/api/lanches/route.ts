import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    // v9.8: por padrão, retorna apenas lanches ativos (bugfix SD-1).
    // Use ?inativos=true para incluir inativos (necessário para página de
    // lanches exibir badge "Inativo" e permitir reativar).
    const { searchParams } = new URL(request.url)
    const incluirInativos = searchParams.get('inativos') === 'true'

    const lanches = await db.lanche.findMany({
      where: incluirInativos ? {} : { ativo: true },
      include: { distribuicao: { include: { escola: true } } },
      orderBy: { nome: 'asc' },
    })
    return NextResponse.json(lanches)
  } catch (error) {
    console.error('Erro ao buscar lanches:', error)
    return NextResponse.json({ error: 'Erro ao buscar lanches' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const lanche = await db.lanche.create({
      data: {
        nome: body.nome,
        unidade: body.unidade || 'un',
        ativo: body.ativo !== false,
        obs: body.obs,
      },
    })
    return NextResponse.json(lanche, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar lanche:', error)
    return NextResponse.json({ error: 'Erro ao criar lanche' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const lanche = await db.lanche.update({
      where: { id: body.id },
      data: {
        nome: body.nome,
        unidade: body.unidade,
        ativo: body.ativo,
        obs: body.obs,
      },
    })
    return NextResponse.json(lanche)
  } catch (error) {
    console.error('Erro ao atualizar lanche:', error)
    return NextResponse.json({ error: 'Erro ao atualizar lanche' }, { status: 500 })
  }
}

// v9.8: DELETE lanche.
// - Padrão: soft delete (ativo = false) — preserva histórico de produção.
// - Com ?force=true: hard delete — remove fisicamente (cascade também remove
//   LancheDistribuicao, Receita relacionada via schema).
// - Sempre verifica se o lanche está em uso no cardápio semestral antes de
//   hard delete (não podemos quebrar referências FK).
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const force = searchParams.get('force') === 'true'

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    }

    // Verifica se existe
    const lanche = await db.lanche.findUnique({ where: { id } })
    if (!lanche) {
      return NextResponse.json({ error: 'Lanche não encontrado' }, { status: 404 })
    }

    if (force) {
      // Hard delete: verifica se está em uso no cardápio semestral antes
      const emUsoRegular = await db.cardapioSemestral.findFirst({
        where: { lanche_regular_id: id },
        select: { id: true, semana: true, ano: true },
        take: 1,
      })
      const emUsoBifasica = await db.cardapioSemestral.findFirst({
        where: { lanche_bifasica_id: id },
        select: { id: true, semana: true, ano: true },
        take: 1,
      })
      if (emUsoRegular || emUsoBifasica) {
        const onde = [emUsoRegular && `regular (semana ${emUsoRegular.semana}/${emUsoRegular.ano})`,
                      emUsoBifasica && `bifásica (semana ${emUsoBifasica.semana}/${emUsoBifasica.ano})`]
                       .filter(Boolean).join(', ')
        return NextResponse.json({
          error: `Não é possível excluir: lanche está em uso no cardápio ${onde}. Remova a referência no cardápio antes ou use soft-delete (padrão).`,
        }, { status: 409 })
      }
      // Hard delete — cascade em LancheDistribuicao e Receita (configurado no schema)
      await db.lanche.delete({ where: { id } })
      return NextResponse.json({ success: true, mode: 'hard_delete' })
    }

    // Soft delete padrão
    await db.lanche.update({ where: { id }, data: { ativo: false } })
    return NextResponse.json({ success: true, mode: 'soft_delete' })
  } catch (error) {
    console.error('Erro ao excluir lanche:', error)
    return NextResponse.json({ error: 'Erro ao excluir lanche' }, { status: 500 })
  }
}
