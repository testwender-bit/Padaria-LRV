import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// POST /api/nutricao/cardapios/[id]/clonar
// ============================================================
// Clona um cardápio (de escola ou base) para uma escola de destino.
// Se já existe cardápio da mesma escola + ano + semestre, SOBRESCREVE.
//
// Body: { escola_id_destino: string, nutricionista_id?: string }
//
// Nome do clone: "Cardápio {semestre}º semestre — {nome_escola}"
// ============================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Aceita tanto escola_id_destino quanto escola_id (compatibilidade)
    const escolaIdDestino = body.escola_id_destino || body.escola_id

    if (!escolaIdDestino) {
      return NextResponse.json(
        { error: 'Campo obrigatório: escola_id_destino' },
        { status: 400 }
      )
    }

    // Buscar cardápio original com todos os dados aninhados
    const original = await db.cardapioNutricional.findUnique({
      where: { id },
      include: {
        semanas: {
          include: {
            dias: {
              include: {
                itens: true,
              },
            },
          },
          orderBy: { numero: 'asc' },
        },
      },
    })

    if (!original) {
      return NextResponse.json({ error: 'Cardápio original não encontrado' }, { status: 404 })
    }

    // Buscar escola de destino para gerar o nome
    const escolaDestino = await db.escola.findUnique({
      where: { id: escolaIdDestino },
      select: { id: true, nome: true, nome_curto: true },
    })

    if (!escolaDestino) {
      return NextResponse.json({ error: 'Escola de destino não encontrada' }, { status: 404 })
    }

    const criadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)

    // Nome no formato: "Cardápio 2º semestre — Anjo da Guarda"
    const semestreExtenso = original.semestre === 1 ? '1º semestre' : '2º semestre'
    const nomeClone = `Cardápio ${semestreExtenso} — ${escolaDestino.nome_curto || escolaDestino.nome}`

    // Deep clone em transação
    const novoCardapio = await db.$transaction(async (tx) => {
      // Verifica se já existe cardápio para esta escola + ano + semestre
      const existente = await tx.cardapioNutricional.findFirst({
        where: {
          escola_id: escolaIdDestino,
          ano: original.ano,
          semestre: original.semestre,
        },
      })

      if (existente) {
        // Sobrescreve: deleta o anterior (cascade deleta semanas → dias → itens)
        await tx.cardapioNutricional.delete({ where: { id: existente.id } })
      }

      // Criar novo cardápio
      const card = await tx.cardapioNutricional.create({
        data: {
          nome: nomeClone,
          escola_id: escolaIdDestino,
          nutricionista_id: body.nutricionista_id || original.nutricionista_id,
          categoria_escola: original.categoria_escola,
          fase_escolar: original.fase_escolar,
          ano: original.ano,
          semestre: original.semestre,
          status: 'RASCUNHO',
          origem_id: original.id,
          cardapio_base_id: original.cardapio_base_id || original.id,
          ciclo_semanas: original.ciclo_semanas,
          repetir_ciclo: original.repetir_ciclo,
          dia_pao_frances: original.dia_pao_frances,
          dia_lanche: original.dia_lanche,
          criado_em: criadoEm,
          atualizado_em: criadoEm,
        },
      })

      // Clonar semanas, dias e itens
      for (const semana of original.semanas) {
        const novaSemana = await tx.cardapioSemanaNutri.create({
          data: {
            cardapio_id: card.id,
            numero: semana.numero,
            data_inicio: semana.data_inicio,
            data_fim: semana.data_fim,
            diferenciada: semana.diferenciada,
          },
        })

        for (const dia of semana.dias) {
          const novoDia = await tx.cardapioDiaNutri.create({
            data: {
              semana_id: novaSemana.id,
              dia_semana: dia.dia_semana,
            },
          })

          for (const item of dia.itens) {
            await tx.cardapioItem.create({
              data: {
                dia_id: novoDia.id,
                tipo_refeicao_id: item.tipo_refeicao_id,
                preparacao_id: item.preparacao_id,
                porcoes: item.porcoes,
                ordem: item.ordem || 0,
              },
            })
          }
        }
      }

      // Retornar cardápio completo
      return tx.cardapioNutricional.findUnique({
        where: { id: card.id },
        include: {
          escola: true,
          nutricionista: true,
        },
      })
    }, {
      timeout: 30000,
      maxWait: 10000,
    })

    return NextResponse.json(novoCardapio, { status: 201 })
  } catch (error) {
    console.error('Erro ao clonar cardápio:', error)
    return NextResponse.json({ error: 'Erro ao clonar cardápio' }, { status: 500 })
  }
}
