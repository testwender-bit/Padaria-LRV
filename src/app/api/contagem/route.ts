import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Helper: check if ContagemEstoque table exists
function isTableMissingError(error: any): boolean {
  return error?.code === 'P2021'
}

// GET /api/contagem?data=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dataParam = searchParams.get('data')

    if (dataParam && !/^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
      return NextResponse.json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' }, { status: 400 })
    }

    // If a specific date is provided, fetch counts for that date
    // Otherwise, fetch the latest date that has counts
    let dataContagem = dataParam

    if (!dataContagem) {
      const latestContagem = await db.contagemEstoque.findFirst({
        orderBy: { data_contagem: 'desc' },
        select: { data_contagem: true },
      })
      dataContagem = latestContagem?.data_contagem || null
    }

    if (!dataContagem) {
      return NextResponse.json({ data: null, contagens: [], historico: [] })
    }

    // Fetch contagens for the specified date
    const contagens = await db.contagemEstoque.findMany({
      where: { data_contagem: dataContagem },
      include: {
        insumo: {
          select: {
            id: true,
            nome: true,
            unidade: true,
            estoque_atual: true,
            preco_unitario: true,
          },
        },
      },
      orderBy: { insumo: { nome: 'asc' } },
    })

    // Fetch historical contagens (last 5 distinct dates)
    const datasDistintas = await db.contagemEstoque.findMany({
      select: { data_contagem: true },
      distinct: ['data_contagem'],
      orderBy: { data_contagem: 'desc' },
      take: 5,
    })

    const historico: {
      data: string
      total_itens: number
      total_diferenca: number
      itens_com_desvio: number
      itens: { insumo_nome: string; insumo_unidade: string; quantidade: number; estoque_sistema: number; diferenca: number }[]
    }[] = []
    for (const d of datasDistintas) {
      const countItens = await db.contagemEstoque.findMany({
        where: { data_contagem: d.data_contagem },
        include: {
          insumo: {
            select: { nome: true, unidade: true },
          },
        },
        orderBy: { insumo: { nome: 'asc' } },
      })

      const totalDiferenca = countItens.reduce((s, c) => s + c.diferenca, 0)
      const itensComDesvio = countItens.filter((c) => {
        if (c.estoque_sistema === 0) return c.quantidade !== 0
        return Math.abs(c.diferenca / c.estoque_sistema) > 0.05
      }).length

      historico.push({
        data: d.data_contagem,
        total_itens: countItens.length,
        total_diferenca: Math.round(totalDiferenca * 1000) / 1000,
        itens_com_desvio: itensComDesvio,
        itens: countItens.map((c) => ({
          insumo_nome: c.insumo.nome,
          insumo_unidade: c.insumo.unidade,
          quantidade: c.quantidade,
          estoque_sistema: c.estoque_sistema,
          diferenca: c.diferenca,
        })),
      })
    }

    return NextResponse.json({
      data: dataContagem,
      contagens: contagens.map((c) => ({
        id: c.id,
        insumo_id: c.insumo_id,
        insumo_nome: c.insumo.nome,
        insumo_unidade: c.insumo.unidade,
        estoque_sistema: c.estoque_sistema,
        quantidade: c.quantidade,
        diferenca: c.diferenca,
        obs: c.obs,
        criado_em: c.criado_em,
      })),
      historico,
    })
  } catch (error) {
    if (isTableMissingError(error)) {
      console.warn('[contagem] Tabela ContagemEstoque não encontrada. Execute: npx prisma db push')
      return NextResponse.json({ data: null, contagens: [], historico: [], warning: 'Tabela de contagem não criada. Execute npx prisma db push no terminal.' })
    }
    console.error('Erro ao buscar contagens:', error)
    return NextResponse.json({ error: 'Erro ao buscar contagens' }, { status: 500 })
  }
}

// POST /api/contagem — create a batch of physical counts
// Body: { data_contagem, itens: [{insumo_id, quantidade, obs?}], reconciliar?: boolean }
// Se reconciliar=true, atualiza Insumo.estoque_atual para cada insumo
// (cria MovimentacaoEstoque de ajuste para registrar a mudança).
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data_contagem, itens, reconciliar } = body

    if (!data_contagem || !/^\d{4}-\d{2}-\d{2}$/.test(data_contagem)) {
      return NextResponse.json({ error: 'Data de contagem inválida. Use YYYY-MM-DD.' }, { status: 400 })
    }

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'Itens da contagem são obrigatórios.' }, { status: 400 })
    }

    const now = new Date()
    const criadoEm = `${data_contagem} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // v9.6.8: Transação ATÔMICA — cria contagens + snapshot do estoque + (opcional) reconcilia
    const result = await db.$transaction(async (tx) => {
      // 1. Buscar estoque_atual de todos os insumos de uma vez (evita N+1)
      const insumoIds = itens.map((i: { insumo_id: string }) => i.insumo_id)
      const insumos = await tx.insumo.findMany({
        where: { id: { in: insumoIds } },
        select: { id: true, estoque_atual: true, nome: true, unidade: true, preco_unitario: true },
      })
      const insumoMap = new Map(insumos.map((i) => [i.id, i]))

      // 2. Criar todas as contagens com snapshot correto
      const created = []
      const ajustes = []  // para reconciliação
      for (const item of itens) {
        const insumo = insumoMap.get(item.insumo_id)
        if (!insumo) continue  // insumo não encontrado — pula

        const estoqueSistema = insumo.estoque_atual
        const diferenca = Math.round((estoqueSistema - item.quantidade) * 1000) / 1000

        const contagem = await tx.contagemEstoque.create({
          data: {
            data_contagem,
            insumo_id: item.insumo_id,
            quantidade: item.quantidade,
            estoque_sistema: estoqueSistema,
            diferenca,
            obs: item.obs || null,
            criado_em: criadoEm,
          },
        })
        created.push(contagem)

        // Se for reconciliar e houver diferença, prepara ajuste
        if (reconciliar && diferenca !== 0) {
          ajustes.push({
            insumo_id: item.insumo_id,
            insumo,
            diferenca,
            quantidadeFisica: item.quantidade,
          })
        }
      }

      // 3. Se reconciliar=true, ajustar estoque e criar movimentações
      let ajustesFeitos = 0
      for (const ajuste of ajustes) {
        const delta = ajuste.quantidadeFisica - ajuste.insumo.estoque_atual
        if (delta === 0) continue

        // Criar movimentação de ajuste
        await tx.movimentacaoEstoque.create({
          data: {
            insumo_id: ajuste.insumo_id,
            tipo: delta > 0 ? 'ENTRADA' : 'SAIDA',
            quantidade: Math.abs(delta),
            preco_unitario: ajuste.insumo.preco_unitario,
            preco_total: Math.abs(delta) * ajuste.insumo.preco_unitario,
            data: data_contagem,
            obs: `Ajuste de contagem física — ${data_contagem}`,
          },
        })

        // Atualizar estoque
        await tx.insumo.update({
          where: { id: ajuste.insumo_id },
          data: { estoque_atual: ajuste.quantidadeFisica },
        })
        ajustesFeitos++
      }

      return { created, ajustesFeitos }
    })

    return NextResponse.json({
      success: true,
      count: result.created.length,
      data: data_contagem,
      ajustes: reconciliar ? result.ajustesFeitos : 0,
      reconciliado: reconciliar || false,
    }, { status: 201 })
  } catch (error) {
    console.error('Erro ao salvar contagem:', error)
    return NextResponse.json({ error: 'Erro ao salvar contagem' }, { status: 500 })
  }
}
