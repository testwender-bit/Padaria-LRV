import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// /api/nutricao/cardapios/[id]/localizar-substituir
// ============================================================
// Ferramenta "Localizar e Substituir" preparação no cardápio.
//
// GET ?q=Suco
//   → lista todas as ocorrências da preparação no cardápio
//   → retorna: [{ item_id, semana_num, dia_semana, tipo_refeicao_codigo, preparacao_id, preparacao_nome }]
//
// POST { acao: 'substituir_um', item_id, preparacao_id_nova }
//   → substitui 1 ocorrência específica
//
// POST { acao: 'substituir_todos', preparacao_id_antiga, preparacao_id_nova }
//   → substitui todas as ocorrências no cardápio
// ============================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()

    if (!q || q.length < 2) {
      return NextResponse.json({ error: 'Digite ao menos 2 caracteres' }, { status: 400 })
    }

    // Busca todos os itens do cardápio com a preparação que contém o termo
    const itens = await db.cardapioItem.findMany({
      where: {
        dia: {
          semana: { cardapio_id: cardapioId },
        },
        preparacao: {
          nome: { contains: q, mode: 'insensitive' },
        },
      },
      include: {
        preparacao: { select: { id: true, nome: true, categoria: true } },
        tipo_refeicao: { select: { id: true, codigo: true, nome: true } },
        dia: {
          include: {
            semana: { select: { numero: true } },
          },
        },
      },
      orderBy: [
        { dia: { semana: { numero: 'asc' } } },
      ],
    })

    // Agrupa por preparação para facilitar a UI
    const porPreparacao = new Map<string, {
      preparacao_id: string
      preparacao_nome: string
      categoria: string | null
      ocorrencias: Array<{
        item_id: string
        semana_num: number
        dia_semana: string
        tipo_refeicao_codigo: string
        tipo_refeicao_nome: string
      }>
    }>()

    for (const item of itens) {
      const pid = item.preparacao_id
      if (!porPreparacao.has(pid)) {
        porPreparacao.set(pid, {
          preparacao_id: pid,
          preparacao_nome: item.preparacao.nome,
          categoria: item.preparacao.categoria,
          ocorrencias: [],
        })
      }
      porPreparacao.get(pid)!.ocorrencias.push({
        item_id: item.id,
        semana_num: item.dia.semana.numero,
        dia_semana: item.dia.dia_semana,
        tipo_refeicao_codigo: item.tipo_refeicao.codigo,
        tipo_refeicao_nome: item.tipo_refeicao.nome,
      })
    }

    return NextResponse.json({
      total_ocorrencias: itens.length,
      preparacoes: Array.from(porPreparacao.values()),
    })
  } catch (error) {
    console.error('Erro ao localizar preparação:', error)
    return NextResponse.json({ error: 'Erro ao localizar preparação' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await request.json()

    // ── AÇÃO: substituir_um ──
    // Substitui 1 ocorrência específica (por item_id)
    if (body.acao === 'substituir_um') {
      if (!body.item_id || !body.preparacao_id_nova) {
        return NextResponse.json({ error: 'Campos obrigatórios: item_id, preparacao_id_nova' }, { status: 400 })
      }

      // Busca o item original
      const item = await db.cardapioItem.findUnique({
        where: { id: body.item_id },
        include: { dia: { include: { semana: { select: { cardapio_id: true } } } } },
      })

      if (!item || item.dia.semana.cardapio_id !== cardapioId) {
        return NextResponse.json({ error: 'Item não encontrado neste cardápio' }, { status: 404 })
      }

      // Verifica se a nova preparação já existe neste slot (dia + tipo_refeicao)
      // Se sim, deleta o item atual (não pode ter duplicata)
      const existente = await db.cardapioItem.findUnique({
        where: {
          dia_id_tipo_refeicao_id_preparacao_id: {
            dia_id: item.dia_id,
            tipo_refeicao_id: item.tipo_refeicao_id,
            preparacao_id: body.preparacao_id_nova,
          },
        },
      })

      if (existente) {
        // Já existe — deleta o item atual (substituição efetiva: o novo já está lá)
        await db.cardapioItem.delete({ where: { id: item.id } })
        return NextResponse.json({ success: true, acao: 'deletado_duplicata', item_id: item.id })
      }

      // Não existe — atualiza o preparacao_id do item
      await db.cardapioItem.update({
        where: { id: item.id },
        data: { preparacao_id: body.preparacao_id_nova },
      })
      return NextResponse.json({ success: true, acao: 'atualizado', item_id: item.id })
    }

    // ── AÇÃO: substituir_todos ──
    // Substitui todas as ocorrências de preparacao_id_antiga por preparacao_id_nova
    if (body.acao === 'substituir_todos') {
      if (!body.preparacao_id_antiga || !body.preparacao_id_nova) {
        return NextResponse.json({ error: 'Campos obrigatórios: preparacao_id_antiga, preparacao_id_nova' }, { status: 400 })
      }

      if (body.preparacao_id_antiga === body.preparacao_id_nova) {
        return NextResponse.json({ error: 'Preparação de origem e destino são iguais' }, { status: 400 })
      }

      // Busca todos os itens com a preparação antiga neste cardápio
      const itens = await db.cardapioItem.findMany({
        where: {
          preparacao_id: body.preparacao_id_antiga,
          dia: { semana: { cardapio_id: cardapioId } },
        },
        include: { dia: { include: { semana: { select: { numero: true } } } } },
      })

      let atualizados = 0
      let duplicatasRemovidas = 0

      for (const item of itens) {
        // Verifica se a nova preparação já existe neste slot
        const existente = await db.cardapioItem.findUnique({
          where: {
            dia_id_tipo_refeicao_id_preparacao_id: {
              dia_id: item.dia_id,
              tipo_refeicao_id: item.tipo_refeicao_id,
              preparacao_id: body.preparacao_id_nova,
            },
          },
        })

        if (existente) {
          // Já existe — deleta o item atual
          await db.cardapioItem.delete({ where: { id: item.id } })
          duplicatasRemovidas++
        } else {
          // Não existe — atualiza
          await db.cardapioItem.update({
            where: { id: item.id },
            data: { preparacao_id: body.preparacao_id_nova },
          })
          atualizados++
        }
      }

      return NextResponse.json({
        success: true,
        acao: 'substituir_todos',
        total_encontrados: itens.length,
        atualizados,
        duplicatas_removidas: duplicatasRemovidas,
      })
    }

    return NextResponse.json({ error: 'Ação inválida. Use: substituir_um ou substituir_todos' }, { status: 400 })
  } catch (error) {
    console.error('Erro ao substituir preparação:', error)
    return NextResponse.json({ error: 'Erro ao substituir preparação' }, { status: 500 })
  }
}
