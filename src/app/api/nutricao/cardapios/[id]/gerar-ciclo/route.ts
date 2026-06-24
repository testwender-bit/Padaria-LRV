import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  SEMANAS_SEMESTRE,
  gerarDatasSemanasSemestre,
} from '@/lib/cardapio-base-utils'

// POST /api/nutricao/cardapios/[id]/gerar-ciclo
// Body: { data_inicio?: string (YYYY-MM-DD), total_semanas?: number }
//
// A partir de um cardápio base já com as primeiras N semanas preenchidas
// (default 5 — ciclo PNAE), gera as semanas restantes (até 22) como
// réplicas automáticas da semana correspondente do ciclo.
//
// Semana 6 = cópia da 1, Semana 7 = cópia da 2, ..., Semana 11 = cópia da 1, etc.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioId } = await params
    const body = await request.json().catch(() => ({}))

    const cardapio = await db.cardapioNutricional.findUnique({
      where: { id: cardapioId },
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

    if (!cardapio) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    const ciclo = cardapio.ciclo_semanas || 5
    const semanasBase = cardapio.semanas.filter((s) => s.numero <= ciclo)

    if (semanasBase.length < ciclo) {
      return NextResponse.json(
        {
          error: `Cardápio precisa ter ao menos ${ciclo} semanas base preenchidas. Atual: ${semanasBase.length}`,
        },
        { status: 400 }
      )
    }

    const totalSemanas = body.total_semanas || SEMANAS_SEMESTRE

    // Calcular datas
    const dataInicioBase = body.data_inicio
      ? new Date(body.data_inicio + 'T12:00:00')
      : (cardapio.semanas[0]?.data_inicio
          ? new Date(cardapio.semanas[0].data_inicio + 'T12:00:00')
          : new Date())
    const datasSemanas = gerarDatasSemanasSemestre(dataInicioBase, totalSemanas)

    const criadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)

    const result = await db.$transaction(async (tx) => {
      // Atualizar datas das semanas existentes (1..ciclo)
      for (let i = 0; i < semanasBase.length; i++) {
        const sem = semanasBase[i]
        const d = datasSemanas[i]
        if (d && (sem.data_inicio !== d.data_inicio || sem.data_fim !== d.data_fim)) {
          await tx.cardapioSemanaNutri.update({
            where: { id: sem.id },
            data: { data_inicio: d.data_inicio, data_fim: d.data_fim },
          })
        }
      }

      // Deletar semanas além do ciclo (se houver) — serão recriadas
      const semanasParaDeletar = cardapio.semanas.filter((s) => s.numero > ciclo)
      for (const s of semanasParaDeletar) {
        await tx.cardapioSemanaNutri.delete({ where: { id: s.id } })
      }

      // Gerar semanas ciclo+1..totalSemanas como cópia da semana (num-1)%ciclo+1
      const semanasCriadas: number[] = []
      for (let num = ciclo + 1; num <= totalSemanas; num++) {
        const numBase = ((num - 1) % ciclo) + 1
        const baseSemana = semanasBase.find((s) => s.numero === numBase)
        if (!baseSemana) continue

        const d = datasSemanas[num - 1]

        const novaSemana = await tx.cardapioSemanaNutri.create({
          data: {
            cardapio_id: cardapio.id,
            numero: num,
            data_inicio: d.data_inicio,
            data_fim: d.data_fim,
          },
        })

        for (const dia of baseSemana.dias) {
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
                ordem: item.ordem || 0,  // v5: PROPAGAR ordem (era perdida)
              },
            })
          }
        }
        semanasCriadas.push(num)
      }

      // Atualizar flag repetir_ciclo = true no cardápio
      await tx.cardapioNutricional.update({
        where: { id: cardapio.id },
        data: { atualizado_em: criadoEm, repetir_ciclo: true },
      })

      return {
        ciclo_semanas: ciclo,
        semanas_base: semanasBase.length,
        semanas_geradas: semanasCriadas.length,
        semanas_criadas_nums: semanasCriadas,
        total_semanas: totalSemanas,
        mapeamento: Array.from({ length: totalSemanas }, (_, i) => ({
          semana: i + 1,
          base: ((i) % ciclo) + 1,
          is_replica: i + 1 > ciclo,
        })),
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Erro ao gerar ciclo PNAE:', error)
    return NextResponse.json({ error: 'Erro ao gerar ciclo PNAE' }, { status: 500 })
  }
}
