import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.user_id || !body.nome || !body.crn) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: user_id, nome, crn' },
        { status: 400 }
      )
    }

    // Upsert por user_id
    const nutricionista = await db.nutricionista.upsert({
      where: { user_id: body.user_id },
      update: {
        nome: body.nome,
        crn: body.crn,
      },
      create: {
        user_id: body.user_id,
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
