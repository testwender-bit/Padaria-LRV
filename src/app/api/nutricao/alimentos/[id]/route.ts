import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.alimento.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Alimento não encontrado' }, { status: 404 })
    }

    const alimento = await db.alimento.update({
      where: { id },
      data: {
        codigo_taco: body.codigo_taco !== undefined ? body.codigo_taco : undefined,
        nome: body.nome !== undefined ? body.nome : undefined,
        grupo: body.grupo !== undefined ? body.grupo : undefined,
        medida_caseira: body.medida_caseira !== undefined ? body.medida_caseira : undefined,
        gramas_por_medida: body.gramas_por_medida !== undefined ? body.gramas_por_medida : undefined,
        energia_kcal: body.energia_kcal !== undefined ? body.energia_kcal : undefined,
        carboidratos_g: body.carboidratos_g !== undefined ? body.carboidratos_g : undefined,
        proteinas_g: body.proteinas_g !== undefined ? body.proteinas_g : undefined,
        lipidios_g: body.lipidios_g !== undefined ? body.lipidios_g : undefined,
        fibra_alimentar_g: body.fibra_alimentar_g !== undefined ? body.fibra_alimentar_g : undefined,
        sodio_mg: body.sodio_mg !== undefined ? body.sodio_mg : undefined,
        ferro_mg: body.ferro_mg !== undefined ? body.ferro_mg : undefined,
        ferro_heme_mg: body.ferro_heme_mg !== undefined ? body.ferro_heme_mg : undefined,
        vitamina_a_mcg: body.vitamina_a_mcg !== undefined ? body.vitamina_a_mcg : undefined,
        vitamina_c_mg: body.vitamina_c_mg !== undefined ? body.vitamina_c_mg : undefined,
        calcio_mg: body.calcio_mg !== undefined ? body.calcio_mg : undefined,
        magnesio_mg: body.magnesio_mg !== undefined ? body.magnesio_mg : undefined,
        zinco_mg: body.zinco_mg !== undefined ? body.zinco_mg : undefined,
        acucar_adicionado_g: body.acucar_adicionado_g !== undefined ? body.acucar_adicionado_g : undefined,
        ativo: body.ativo !== undefined ? body.ativo : undefined,
      },
    })

    return NextResponse.json(alimento)
  } catch (error) {
    console.error('Erro ao atualizar alimento:', error)
    return NextResponse.json({ error: 'Erro ao atualizar alimento' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.alimento.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Alimento não encontrado' }, { status: 404 })
    }

    await db.alimento.update({
      where: { id },
      data: { ativo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar alimento:', error)
    return NextResponse.json({ error: 'Erro ao deletar alimento' }, { status: 500 })
  }
}
