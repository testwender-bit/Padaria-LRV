import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  SEMANAS_SEMESTRE,
  gerarDatasSemanasSemestre,
} from '@/lib/cardapio-base-utils'
// v9.10.0: ciclo REAL detectado pelo CONTEÚDO (não pelo campo ciclo_semanas)
import { detectarCicloReal } from '@/lib/cardapio-ciclo-utils'

// POST /api/nutricao/cardapios/[id]/gerar-ciclo
// Body: { data_inicio?: string (YYYY-MM-DD), total_semanas?: number }
//
// A partir de um cardápio já com as primeiras N semanas preenchidas,
// gera as semanas restantes (até 22) como réplicas automáticas da
// semana correspondente do ciclo.
//
// v9.10.0: o ciclo agora é detectado pelo CONTEÚDO (maior semana com
// itens), não pelo campo ciclo_semanas — que fica no default 5 quando o
// cardápio foi montado com 5, 6 ou N semanas no editor. Antes, um
// cardápio montado com 6 semanas teria a semana 6 DELETADA aqui
// (ciclo=5 deletava semanas > 5 e regenerava 6..22 a partir de 1..5).
//
// v9.10.1: NÃO usa mais $transaction — no Supabase (pooler 6543/pgbouncer,
// modo transaction) transações longas são mortas no meio com
// "Transaction API error: Transaction not found" (P2028), e gerar o ciclo
// envolve até 22 semanas × 6 dias × N itens = centenas de INSERTs.
// Mesmo padrão do /clonar (v8.14): escritas sequenciais com db. direto +
// createMany para os itens (1 query em vez de N). A deleção das semanas
// antigas ficou INTERCALADA com a criação (a semana `num` sai só quando a
// réplica está pronta para entrar no lugar): se algo falhar no meio, as
// semanas base (1..ciclo) ficam intactas e basta rodar "Gerar Ciclo" de
// novo — a operação é reexecutável e completa o que faltou.
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

    // ── v9.10.0: ciclo REAL pelo conteúdo ──
    const cicloReal = detectarCicloReal(cardapio.semanas)
    if (cicloReal === 0) {
      return NextResponse.json(
        { error: 'Nenhuma semana com conteúdo. Preencha ao menos uma semana do cardápio antes de gerar o ciclo.' },
        { status: 400 }
      )
    }
    const ciclo = cicloReal
    const semanasBase = cardapio.semanas.filter((s) => s.numero <= ciclo)

    // v9.10.0: semanas além do ciclo que já têm conteúdo — serão SUBSTITUÍDAS
    // pelo ciclo (aviso exibido no dialog antes de confirmar)
    const semanasSubstituidasComConteudo = cardapio.semanas
      .filter((s) => s.numero > ciclo)
      .filter((s) => (s.dias || []).some((d) => (d.itens || []).length > 0))
      .map((s) => s.numero)
      .sort((a, b) => a - b)

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

    // ── v9.10.1: escritas sequenciais SEM transação (pgbouncer-safe) ──

    // 1) Atualizar datas das semanas base existentes (1..ciclo) — poucas updates
    for (let i = 0; i < semanasBase.length; i++) {
      const sem = semanasBase[i]
      const d = datasSemanas[i]
      if (d && (sem.data_inicio !== d.data_inicio || sem.data_fim !== d.data_fim)) {
        await db.cardapioSemanaNutri.update({
          where: { id: sem.id },
          data: { data_inicio: d.data_inicio, data_fim: d.data_fim },
        })
      }
    }

    // 2) Gerar semanas ciclo+1..totalSemanas como cópia da semana (num-1)%ciclo+1
    const semanasCriadas: number[] = []
    for (let num = ciclo + 1; num <= totalSemanas; num++) {
      const numBase = ((num - 1) % ciclo) + 1
      const baseSemana = semanasBase.find((s) => s.numero === numBase)
      if (!baseSemana) continue

      const d = datasSemanas[num - 1]

      // v9.10.1: deleção INTERCALADA — a semana antiga do número `num` é
      // removida apenas quando a réplica está pronta para entrar no lugar
      // (cascade limpa dias/itens). Antes: delete-all-upfront dentro de uma
      // transação que o pgbouncer matava no meio (P2028).
      const existente = await db.cardapioSemanaNutri.findFirst({
        where: { cardapio_id: cardapio.id, numero: num },
      })
      if (existente) {
        await db.cardapioSemanaNutri.delete({ where: { id: existente.id } })
      }

      const novaSemana = await db.cardapioSemanaNutri.create({
        data: {
          cardapio_id: cardapio.id,
          numero: num,
          data_inicio: d.data_inicio,
          data_fim: d.data_fim,
        },
      })

      for (const dia of baseSemana.dias) {
        const novoDia = await db.cardapioDiaNutri.create({
          data: {
            semana_id: novaSemana.id,
            dia_semana: dia.dia_semana,
          },
        })
        // v9.10.1: createMany (1 query) em vez de create item a item —
        // centenas de round-trips eram o que estourava o tempo da transação
        if (dia.itens.length > 0) {
          await db.cardapioItem.createMany({
            data: dia.itens.map((item) => ({
              dia_id: novoDia.id,
              tipo_refeicao_id: item.tipo_refeicao_id,
              preparacao_id: item.preparacao_id,
              porcoes: item.porcoes,
              ordem: item.ordem || 0,  // v5: PROPAGAR ordem (era perdida)
            })),
          })
        }
      }
      semanasCriadas.push(num)
    }

    // 3) Atualizar flag repetir_ciclo = true + gravar o ciclo REAL no cardápio
    await db.cardapioNutricional.update({
      where: { id: cardapio.id },
      data: { atualizado_em: criadoEm, repetir_ciclo: true, ciclo_semanas: ciclo },
    })

    const result = {
      ciclo_semanas: ciclo,
      semanas_base: semanasBase.length,
      semanas_geradas: semanasCriadas.length,
      semanas_criadas_nums: semanasCriadas,
      total_semanas: totalSemanas,
      // v9.10.0: semanas além do ciclo que tinham conteúdo e foram substituídas
      semanas_substituidas_com_conteudo: semanasSubstituidasComConteudo,
      mapeamento: Array.from({ length: totalSemanas }, (_, i) => ({
        semana: i + 1,
        base: ((i) % ciclo) + 1,
        is_replica: i + 1 > ciclo,
      })),
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Erro ao gerar ciclo PNAE:', error)
    return NextResponse.json({ error: 'Erro ao gerar ciclo PNAE' }, { status: 500 })
  }
}
