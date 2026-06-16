import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/nutricao/lista-compras-snapshots?cardapio_id=xxx
// Lista snapshots salvos (apenas metadados, sem itens_json)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cardapioId = searchParams.get('cardapio_id')

    const where = cardapioId ? { cardapio_id: cardapioId } : {}

    const listas = await db.listaCompras.findMany({
      where,
      orderBy: { gerada_em: 'desc' },
      take: 50,
      select: {
        id: true,
        nome: true,
        cardapio_id: true,
        gerada_em: true,
        status: true,
        // Não trazer escolas_snapshot/itens_json para não inflar a resposta
      },
    })

    return NextResponse.json(listas)
  } catch (error) {
    console.error('Erro ao listar snapshots de listas de compras:', error)
    return NextResponse.json({ error: 'Erro ao listar snapshots' }, { status: 500 })
  }
}
