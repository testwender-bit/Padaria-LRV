import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// GET /api/nutricao/nutricionistas
// Lista todos os nutricionistas ativos (inclui user somente se vinculado)
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const nutricionistas = await db.nutricionista.findMany({
      where: { ativo: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json(nutricionistas)
  } catch (error) {
    console.error('Erro ao buscar nutricionistas:', error)
    return NextResponse.json({ error: 'Erro ao buscar nutricionistas' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/nutricao/nutricionistas
// Cria ou atualiza um nutricionista.
// user_id é OPCIONAL — pode cadastrar apenas nome + CRN, sem vínculo de login.
// Se user_id fornecido, faz upsert por user_id; senão, cria novo registro.
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.nome || !body.crn) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome, crn' },
        { status: 400 }
      )
    }

    const userId = body.user_id || null

    // Se user_id fornecido: upsert por user_id
    if (userId) {
      const nutricionista = await db.nutricionista.upsert({
        where: { user_id: userId },
        update: {
          nome: body.nome,
          crn: body.crn,
        },
        create: {
          user_id: userId,
          nome: body.nome,
          crn: body.crn,
          ativo: true,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })
      return NextResponse.json(nutricionista, { status: 201 })
    }

    // Sem user_id: cria novo registro isolado (sem login vinculado)
    const nutricionista = await db.nutricionista.create({
      data: {
        user_id: null,
        nome: body.nome,
        crn: body.crn,
        ativo: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
    return NextResponse.json(nutricionista, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar/atualizar nutricionista:', error)
    return NextResponse.json({ error: 'Erro ao criar/atualizar nutricionista' }, { status: 500 })
  }
}
