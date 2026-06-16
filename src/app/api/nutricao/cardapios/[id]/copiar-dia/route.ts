import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST — Copy items from one or more days to corresponding target days
// Supports two modes:
//   1) Single: { origem_semana, origem_dia, destino_semana, destino_dia }
//   2) Batch:  { origens: [{ origem_semana, origem_dia, destino_semana, destino_dia }, ...] }

interface CopyItem {
  origem_semana: number
  origem_dia: string
  destino_semana: number
  destino_dia: string
}

async function copySingleDay(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  cardapioId: string,
  item: CopyItem,
  limparDestino: boolean
) {
  // Find source day
  const semanaOrigem = await tx.cardapioSemanaNutri.findUnique({
    where: { cardapio_id_numero: { cardapio_id: cardapioId, numero: item.origem_semana } },
  })
  if (!semanaOrigem) throw new Error(`Semana origem ${item.origem_semana} não encontrada`)

  const diaOrigem = await tx.cardapioDiaNutri.findUnique({
    where: { semana_id_dia_semana: { semana_id: semanaOrigem.id, dia_semana: item.origem_dia } },
    include: { itens: true },
  })
  if (!diaOrigem) throw new Error(`Dia origem ${item.origem_dia} não encontrado na semana ${item.origem_semana}`)

  // Find target day
  const semanaDestino = await tx.cardapioSemanaNutri.findUnique({
    where: { cardapio_id_numero: { cardapio_id: cardapioId, numero: item.destino_semana } },
  })
  if (!semanaDestino) throw new Error(`Semana destino ${item.destino_semana} não encontrada`)

  const diaDestino = await tx.cardapioDiaNutri.findUnique({
    where: { semana_id_dia_semana: { semana_id: semanaDestino.id, dia_semana: item.destino_dia } },
  })
  if (!diaDestino) throw new Error(`Dia destino ${item.destino_dia} não encontrado na semana ${item.destino_semana}`)

  // Optionally clear target day first
  if (limparDestino) {
    await tx.cardapioItem.deleteMany({
      where: { dia_id: diaDestino.id },
    })
  }

  // Copy all items from source to target
  let copiedCount = 0
  for (const srcItem of diaOrigem.itens) {
    await tx.cardapioItem.upsert({
      where: {
        dia_id_tipo_refeicao_id_preparacao_id: {
          dia_id: diaDestino.id,
          tipo_refeicao_id: srcItem.tipo_refeicao_id,
          preparacao_id: srcItem.preparacao_id,
        },
      },
      update: {
        porcoes: srcItem.porcoes,
      },
      create: {
        dia_id: diaDestino.id,
        tipo_refeicao_id: srcItem.tipo_refeicao_id,
        preparacao_id: srcItem.preparacao_id,
        porcoes: srcItem.porcoes,
      },
    })
    copiedCount++
  }

  return { origem: { semana: item.origem_semana, dia: item.origem_dia }, destino: { semana: item.destino_semana, dia: item.destino_dia }, itens_copiados: copiedCount }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const limparDestino = body.limpar_destino !== false // default true

    // Verify cardápio exists
    const cardapio = await db.cardapioNutricional.findUnique({ where: { id } })
    if (!cardapio) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    // Determine if single or batch mode
    let copyItems: CopyItem[] = []

    if (body.origens && Array.isArray(body.origens) && body.origens.length > 0) {
      // Batch mode
      copyItems = body.origens
    } else if (body.origem_semana && body.origem_dia && body.destino_semana && body.destino_dia) {
      // Single mode (backwards compatible)
      copyItems = [{
        origem_semana: body.origem_semana,
        origem_dia: body.origem_dia,
        destino_semana: body.destino_semana,
        destino_dia: body.destino_dia,
      }]
    } else {
      return NextResponse.json(
        { error: 'Envie origem_semana/origem_dia/destino_semana/destino_dia ou array origens[]' },
        { status: 400 }
      )
    }

    // Validate no duplicate destinations
    const destKeys = copyItems.map(i => `${i.destino_semana}-${i.destino_dia}`)
    const uniqueDestKeys = new Set(destKeys)
    if (uniqueDestKeys.size < destKeys.length) {
      return NextResponse.json(
        { error: 'Há destinos duplicados na lista de cópia' },
        { status: 400 }
      )
    }

    // Validate no source == destination
    for (const item of copyItems) {
      if (item.origem_semana === item.destino_semana && item.origem_dia === item.destino_dia) {
        return NextResponse.json(
          { error: `Origem e destino são iguais: semana ${item.origem_semana} ${item.origem_dia}` },
          { status: 400 }
        )
      }
    }

    const result = await db.$transaction(async (tx) => {
      const results: Array<{ origem: { semana: number; dia: string }; destino: { semana: number; dia: string }; itens_copiados: number }> = []
      let totalCopied = 0
      for (const item of copyItems) {
        const res = await copySingleDay(tx, id, item, limparDestino)
        results.push(res)
        totalCopied += res.itens_copiados
      }
      return { copias: results, total_itens_copiados: totalCopied, dias_copiados: results.length }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao copiar dia:', error)
    const message = error instanceof Error ? error.message : 'Erro ao copiar dia'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
