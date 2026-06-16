import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const busca = searchParams.get('busca')
    const grupo = searchParams.get('grupo')

    const where: Record<string, unknown> = {
      ativo: true,
    }

    if (busca) {
      where.nome = { contains: busca }
    }

    if (grupo) {
      where.grupo = grupo
    }

    const alimentos = await db.alimento.findMany({
      where,
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json(alimentos)
  } catch (error) {
    console.error('Erro ao buscar alimentos:', error)
    return NextResponse.json({ error: 'Erro ao buscar alimentos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.nome || !body.grupo || !body.medida_caseira) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome, grupo, medida_caseira' },
        { status: 400 }
      )
    }

    const alimento = await db.alimento.create({
      data: {
        codigo_taco: body.codigo_taco || null,
        nome: body.nome,
        grupo: body.grupo,
        medida_caseira: body.medida_caseira,
        gramas_por_medida: body.gramas_por_medida || 0,
        energia_kcal: body.energia_kcal || 0,
        carboidratos_g: body.carboidratos_g || 0,
        proteinas_g: body.proteinas_g || 0,
        lipidios_g: body.lipidios_g || 0,
        fibra_alimentar_g: body.fibra_alimentar_g || 0,
        sodio_mg: body.sodio_mg || 0,
        ferro_mg: body.ferro_mg || 0,
        ferro_heme_mg: body.ferro_heme_mg || 0,
        vitamina_a_mcg: body.vitamina_a_mcg || 0,
        vitamina_c_mg: body.vitamina_c_mg || 0,
        calcio_mg: body.calcio_mg || 0,
        magnesio_mg: body.magnesio_mg || 0,
        zinco_mg: body.zinco_mg || 0,
        acucar_adicionado_g: body.acucar_adicionado_g || 0,
        ativo: body.ativo !== false,
      },
    })

    return NextResponse.json(alimento, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar alimento:', error)
    return NextResponse.json({ error: 'Erro ao criar alimento' }, { status: 500 })
  }
}
