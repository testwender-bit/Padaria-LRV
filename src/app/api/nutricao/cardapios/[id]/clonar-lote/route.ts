import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SEMANAS_SEMESTRE } from '@/lib/cardapio-base-utils'

// POST /api/nutricao/cardapios/[id]/clonar-lote
// Body: { escolas_ids: string[], nutricionista_id?: string }
// Cria uma instância do cardápio base para cada escola informada.
// Resolve o problema "lançar 24 cardápios": a nutricionista monta 1 cardápio
// base (5 semanas) por segmento e instancia para as 24 escolas de uma vez.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioBaseId } = await params
    const body = await request.json()

    if (!Array.isArray(body.escolas_ids) || body.escolas_ids.length === 0) {
      return NextResponse.json(
        { error: 'Informe ao menos uma escola de destino (escolas_ids: string[])' },
        { status: 400 }
      )
    }

    // Buscar cardápio base
    const original = await db.cardapioNutricional.findUnique({
      where: { id: cardapioBaseId },
      include: {
        semanas: {
          include: {
            dias: {
              include: { itens: true },
            },
          },
          orderBy: { numero: 'asc' },
        },
      },
    })

    if (!original) {
      return NextResponse.json({ error: 'Cardápio base não encontrado' }, { status: 404 })
    }

    if (original.escola_id !== null) {
      return NextResponse.json(
        { error: 'Cardápio de origem deve ser um MODELO BASE (escola_id = null)' },
        { status: 400 }
      )
    }

    // Buscar escolas destino
    const escolas = await db.escola.findMany({
      where: { id: { in: body.escolas_ids }, ativo: true },
    })

    if (escolas.length === 0) {
      return NextResponse.json({ error: 'Nenhuma escola ativa encontrada' }, { status: 404 })
    }

    const criadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)
    const nutricionistaId = body.nutricionista_id || original.nutricionista_id

    // v9.10.1: SEM $transaction — o pgbouncer do Supabase (pooler 6543, modo
    // transaction) mata transações longas (P2028 "Transaction not found") e
    // clonar N escolas × semanas × itens gera milhares de INSERTs. Mesmo
    // padrão do /clonar (v8.14): escritas sequenciais com db. direto +
    // createMany para itens. `tx` vira alias de db — corpo preservado.
    // Se uma escola falhar no meio, o cardápio parcial dela é removido
    // (cascade) e ela entra em `erros`.
    const tx = db

    const criados: { escola_id: string; escola_nome: string; cardapio_id: string }[] = []
      const erros: { escola_id: string; motivo: string }[] = []

      for (const escola of escolas) {
        // v9.10.1: rastreia o cardápio desta escola p/ remover parcial em erro
        let cardParcialId: string | null = null
        try {
          // Verificar se já existe cardápio para esta escola + ano + semestre
          const existente = await tx.cardapioNutricional.findFirst({
            where: {
              escola_id: escola.id,
              ano: original.ano,
              semestre: original.semestre,
            },
          })
          if (existente && !body.sobrescrever_existente) {
            erros.push({
              escola_id: escola.id,
              motivo: `Já existe cardápio ${original.ano}/${original.semestre} (id: ${existente.id})`,
            })
            continue
          }
          if (existente) {
            // Deleta o anterior (cascade semanas/dias/itens)
            await tx.cardapioNutricional.delete({ where: { id: existente.id } })
          }

          const nomeInstancia = `${original.nome} — ${escola.nome_curto || escola.nome}`

          const card = await tx.cardapioNutricional.create({
            data: {
              nome: nomeInstancia,
              escola_id: escola.id,
              nutricionista_id: nutricionistaId,
              categoria_escola: original.categoria_escola,
              fase_escolar: original.fase_escolar,
              ano: original.ano,
              semestre: original.semestre,
              status: 'RASCUNHO',
              origem_id: original.id,
              cardapio_base_id: original.id,
              ciclo_semanas: original.ciclo_semanas,
              repetir_ciclo: original.repetir_ciclo,
              criado_em: criadoEm,
              atualizado_em: criadoEm,
            },
          })
          cardParcialId = card.id  // v9.10.1: criado — habilita cleanup em erro

          // Clonar semanas e dias (com itens)
          for (const semana of original.semanas) {
            const novaSemana = await tx.cardapioSemanaNutri.create({
              data: {
                cardapio_id: card.id,
                numero: semana.numero,
                data_inicio: semana.data_inicio,
                data_fim: semana.data_fim,
              },
            })

            for (const dia of semana.dias) {
              const novoDia = await tx.cardapioDiaNutri.create({
                data: {
                  semana_id: novaSemana.id,
                  dia_semana: dia.dia_semana,
                },
              })

              // v9.10.1: createMany (1 query) em vez de create item a item
              if (dia.itens.length > 0) {
                await tx.cardapioItem.createMany({
                  data: dia.itens.map(item => ({
                    dia_id: novoDia.id,
                    tipo_refeicao_id: item.tipo_refeicao_id,
                    preparacao_id: item.preparacao_id,
                    porcoes: item.porcoes,
                    ordem: item.ordem || 0,  // v5: PROPAGAR ordem (era perdida)
                  })),
                })
              }
            }
          }

          criados.push({
            escola_id: escola.id,
            escola_nome: escola.nome,
            cardapio_id: card.id,
          })
        } catch (err) {
          // v9.10.1: sem transação — remove cardápio parcial da escola com erro
          if (cardParcialId) {
            await db.cardapioNutricional.delete({ where: { id: cardParcialId } }).catch(() => {})
          }
          erros.push({
            escola_id: escola.id,
            motivo: err instanceof Error ? err.message : 'Erro ao clonar',
          })
        }
      }

    const result = { criados, erros }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Erro ao clonar cardápio em lote:', error)
    return NextResponse.json({ error: 'Erro ao clonar cardápio em lote' }, { status: 500 })
  }
}
