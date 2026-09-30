import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// POST /api/nutricao/cardapios/[id]/trocar-itens          v9.10.2
// ============================================================
// Troca DUAS preparações de lugar no cardápio (Modo Troca do editor).
// O usuário clica na 1ª preparação e depois na 2ª — elas trocam de posição.
//
// Body:
//   { item_a_id: string, item_b_id: string }
//
// Semântica ("trocar de lugar" do ponto de vista do usuário):
//   Caso 1 — slots DIFERENTES (dias e/ou refeições distintos):
//     A preparação A passa a ocupar o slot de B e vice-versa.
//     Implementação por TROCA DE CONTEÚDO (não move as linhas):
//       item B recebe preparacao_id + porcoes de A
//       item A recebe preparacao_id + porcoes de B
//     Vantagens: ids preservados, ordem de cada slot preservada,
//     vezes_usada das preparações não muda (cada uma continua usada 1×),
//     e NENHUM delete/create (zero risco de perda).
//
//   Caso 2 — MESMO slot (mesmo dia e mesma refeição):
//     Troca apenas o campo `ordem` entre os dois itens (reordenação).
//     (Não troca conteúdo: violaria a unique (dia, tipo, preparacao).)
//
// Constraint unique CardapioItem (dia_id, tipo_refeicao_id, preparacao_id):
//   Antes de trocar conteúdo, verificamos se a preparação de A já existe
//   no slot de B (via item TERCEIRO) — se existir, a troca duplicaria a
//   preparação na mesma refeição → erro 409 amigável, nada é alterado.
//   (Se for a própria B que tem a mesma preparação de A, não há conflito:
//   a troca apenas realoca porções.)
//
// PGBOUNCER (lição v9.10.1): a transação aqui é CURTA (2 updates em
// registros já carregados, chaves únicas indexadas) — mesmo padrão das
// rotas curtas mover-item/trocar-dia, seguras no pooler transaction mode.
// NÃO usar este padrão em loops longos (ver gerar-ciclo/replicar).
// ============================================================

const DIAS_LABEL: Record<string, string> = {
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await request.json()

    if (!body.item_a_id || !body.item_b_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: item_a_id, item_b_id' },
        { status: 400 }
      )
    }

    if (body.item_a_id === body.item_b_id) {
      return NextResponse.json(
        { error: 'Selecione duas preparações diferentes para trocar' },
        { status: 400 }
      )
    }

    // 1. Carrega os dois itens (com dia → semana e refeição para mensagens)
    const itemA = await db.cardapioItem.findUnique({
      where: { id: body.item_a_id },
      include: {
        dia: { include: { semana: true } },
        tipo_refeicao: true,
        preparacao: true,
      },
    })

    if (!itemA) {
      return NextResponse.json({ error: '1ª preparação não encontrada (item_a_id inválido)' }, { status: 404 })
    }

    const itemB = await db.cardapioItem.findUnique({
      where: { id: body.item_b_id },
      include: {
        dia: { include: { semana: true } },
        tipo_refeicao: true,
        preparacao: true,
      },
    })

    if (!itemB) {
      return NextResponse.json({ error: '2ª preparação não encontrada (item_b_id inválido)' }, { status: 404 })
    }

    // 2. Ambos os itens devem pertencer a ESTE cardápio (segurança multi-cardápio)
    if (itemA.dia.semana.cardapio_id !== cardapioId || itemB.dia.semana.cardapio_id !== cardapioId) {
      return NextResponse.json(
        { error: 'Item não pertence a este cardápio' },
        { status: 400 }
      )
    }

    const labelA = `${DIAS_LABEL[itemA.dia.dia_semana] || itemA.dia.dia_semana}/${itemA.tipo_refeicao.nome}`
    const labelB = `${DIAS_LABEL[itemB.dia.dia_semana] || itemB.dia.dia_semana}/${itemB.tipo_refeicao.nome}`

    // ── CASO 1: MESMO slot (mesmo dia + mesma refeição) → troca `ordem` ──
    if (itemA.dia_id === itemB.dia_id && itemA.tipo_refeicao_id === itemB.tipo_refeicao_id) {
      // Guarda ordem antiga para o retorno (item A assume a de B e vice-versa)
      const novaOrdemA = itemB.ordem
      const novaOrdemB = itemA.ordem

      if (novaOrdemA === novaOrdemB) {
        return NextResponse.json({
          success: true,
          action: 'ordem',
          ordem_a: novaOrdemA,
          ordem_b: novaOrdemB,
          noop: true,
          message: 'As duas preparações já estão na mesma ordem',
        })
      }

      // Transação CURTA (2 updates pontuais — padrão das rotas curtas)
      await db.$transaction(async (tx) => {
        await tx.cardapioItem.update({
          where: { id: itemA.id },
          data: { ordem: novaOrdemA },
        })
        await tx.cardapioItem.update({
          where: { id: itemB.id },
          data: { ordem: novaOrdemB },
        })
      })

      return NextResponse.json({
        success: true,
        action: 'ordem',
        ordem_a: novaOrdemA,
        ordem_b: novaOrdemB,
      })
    }

    // ── CASO 2: slots DIFERENTES → troca de conteúdo (preparacao_id + porcoes) ──
    // Pre-checa conflito de unique: existe um TERCEIRO item no slot de destino
    // que já tem a preparação que vai entrar? (excluímos os próprios A e B)
    const conflitoEmB = await db.cardapioItem.findFirst({
      where: {
        dia_id: itemB.dia_id,
        tipo_refeicao_id: itemB.tipo_refeicao_id,
        preparacao_id: itemA.preparacao_id,
        id: { notIn: [itemA.id, itemB.id] },
      },
    })
    if (conflitoEmB) {
      return NextResponse.json(
        {
          error: `"${itemA.preparacao.nome}" já existe em ${labelB} — a troca duplicaria a preparação na mesma refeição. Remova a repetição primeiro.`,
        },
        { status: 409 }
      )
    }

    const conflitoEmA = await db.cardapioItem.findFirst({
      where: {
        dia_id: itemA.dia_id,
        tipo_refeicao_id: itemA.tipo_refeicao_id,
        preparacao_id: itemB.preparacao_id,
        id: { notIn: [itemA.id, itemB.id] },
      },
    })
    if (conflitoEmA) {
      return NextResponse.json(
        {
          error: `"${itemB.preparacao.nome}" já existe em ${labelA} — a troca duplicaria a preparação na mesma refeição. Remova a repetição primeiro.`,
        },
        { status: 409 }
      )
    }

    // Troca de conteúdo em transação CURTA (2 updates pontuais):
    // ordem 1: B recebe a preparação de A (A ainda está em outro slot — sem colisão)
    // ordem 2: A recebe a preparação de B (B já não ocupa mais a sua antiga)
    await db.$transaction(async (tx) => {
      await tx.cardapioItem.update({
        where: { id: itemB.id },
        data: {
          preparacao_id: itemA.preparacao_id,
          porcoes: itemA.porcoes,
        },
      })
      await tx.cardapioItem.update({
        where: { id: itemA.id },
        data: {
          preparacao_id: itemB.preparacao_id,
          porcoes: itemB.porcoes,
        },
      })
    })

    return NextResponse.json({
      success: true,
      action: 'swapped',
      item_a: {
        id: itemA.id,
        preparacao_id: itemB.preparacao_id,
        porcoes: itemB.porcoes,
      },
      item_b: {
        id: itemB.id,
        preparacao_id: itemA.preparacao_id,
        porcoes: itemA.porcoes,
      },
    })
  } catch (error) {
    console.error('Erro ao trocar preparações:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao trocar preparações' },
      { status: 500 }
    )
  }
}
