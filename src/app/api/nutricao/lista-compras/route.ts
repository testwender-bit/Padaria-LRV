import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularPercapitaTotal,
  isRefeicaoPrincipal,
  semanaSemestreParaCiclo,
} from '@/lib/cardapio-base-utils'
import { calcularPercapitaPorFase, type FaseEscolar } from '@/lib/nutricao-utils'

// ============================================================
// GET /api/nutricao/lista-compras
// Query: cardapio_id (obrigatório), semanas (ex.: "1,2,3" ou "all"),
//        escolas_ids (ex.: "id1,id2" — se omitido, usa todas as escolas ativas)
// Retorna a lista de compras consolidada por ingrediente.
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cardapioId = searchParams.get('cardapio_id')
    if (!cardapioId) {
      return NextResponse.json({ error: 'Query param obrigatório: cardapio_id' }, { status: 400 })
    }

    const semanasParam = searchParams.get('semanas') || 'all'
    const semanasLista = semanasParam === 'all'
      ? null
      : semanasParam.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0)

    const escolasIdsParam = searchParams.get('escolas_ids')
    const escolasIds = escolasIdsParam
      ? escolasIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : null

    // Buscar cardápio completo
        // Define o include completo (reutilizável)
    const semanasInclude = {
      dias: {
        include: {
          itens: {
            include: {
              tipo_refeicao: true,
              preparacao: {
                include: {
                  ingredientes: {
                    include: {
                      alimento: true,
                      percapitas: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    }

    const cardapio = await db.cardapioNutricional.findUnique({
      where: { id: cardapioId },
      include: {
        semanas: semanasLista
          ? { where: { numero: { in: semanasLista } }, include: semanasInclude }
          : { include: semanasInclude },
      },
    })

    if (!cardapio) {
      return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
    }

    // Buscar escolas-alvo (todas as ativas se não filtradas)
    const escolas = await db.escola.findMany({
      where: {
        ativo: true,
        ...(escolasIds ? { id: { in: escolasIds } } : {}),
      },
    })

    if (escolas.length === 0) {
      return NextResponse.json({ error: 'Nenhuma escola encontrada' }, { status: 404 })
    }

    const faseEscolar = cardapio.fase_escolar as FaseEscolar

    // ── Acumulador: alimento_id → { alimento, qtd_total_gramas, qtd_por_escola: Map } ──
    const acumulador = new Map<string, {
      alimento_id: string
      alimento_nome: string
      alimento_grupo: string
      alimento_unidade: string
      alimento_medida_caseira: string
      gramas_por_medida: number
      qtd_total_gramas: number
      qtd_total_medidas: number
      por_escola: Map<string, { escola_id: string; escola_nome: string; gramas: number }>
    }>()

    // Para cada semana do cardápio
    for (const semana of cardapio.semanas) {
      // Para cada dia
      for (const dia of semana.dias) {
        // Para cada item (refeição × preparação)
        for (const item of dia.itens) {
          const isPrincipal = isRefeicaoPrincipal(item.tipo_refeicao.codigo)

          // Para cada ingrediente da preparação
          for (const ing of item.preparacao.ingredientes) {
            // Calcular percapita em gramas para a fase escolar
            let percapitaGramas = ing.quantidade_gramas
            if (!ing.mesma_percapita) {
              const pc = ing.percapitas?.find((p) => p.fase_escolar === faseEscolar)
              if (pc) {
                percapitaGramas = pc.quantidade_gramas
              } else {
                percapitaGramas = calcularPercapitaPorFase(ing.quantidade_gramas, faseEscolar)
              }
            }
            // Multiplica por porções
            const percapitaFinal = percapitaGramas * item.porcoes

            // Para cada escola-alvo, calcular o total
            for (const escola of escolas) {
              const total = calcularPercapitaTotal(percapitaFinal, isPrincipal, {
                alunos_parcial: escola.alunos_parcial || 0,
                alunos_integral: escola.alunos_integral || 0,
                mescla_parcial_integral: escola.mescla_parcial_integral,
              })

              if (total.total_gramas <= 0) continue

              // Atualizar acumulador
              const key = ing.alimento.id
              if (!acumulador.has(key)) {
                acumulador.set(key, {
                  alimento_id: ing.alimento.id,
                  alimento_nome: ing.alimento.nome,
                  alimento_grupo: ing.alimento.grupo,
                  alimento_unidade: 'g',
                  alimento_medida_caseira: ing.alimento.medida_caseira,
                  gramas_por_medida: ing.alimento.gramas_por_medida || 0,
                  qtd_total_gramas: 0,
                  qtd_total_medidas: 0,
                  por_escola: new Map(),
                })
              }
              const entry = acumulador.get(key)!
              entry.qtd_total_gramas += total.total_gramas

              const escolaKey = escola.id
              if (!entry.por_escola.has(escolaKey)) {
                entry.por_escola.set(escolaKey, {
                  escola_id: escola.id,
                  escola_nome: escola.nome,
                  gramas: 0,
                })
              }
              entry.por_escola.get(escolaKey)!.gramas += total.total_gramas
            }
          }
        }
      }
    }

    // Construir resposta final
    const itens = Array.from(acumulador.values())
      .map((entry) => {
        const gramas = Math.round(entry.qtd_total_gramas)
        const medidas = entry.gramas_por_medida > 0
          ? Math.round((entry.qtd_total_gramas / entry.gramas_por_medida) * 10) / 10
          : 0
        return {
          alimento_id: entry.alimento_id,
          alimento_nome: entry.alimento_nome,
          alimento_grupo: entry.alimento_grupo,
          unidade: 'g',
          medida_caseira: entry.alimento_medida_caseira,
          gramas_por_medida: entry.gramas_por_medida,
          qtd_total_gramas: gramas,
          qtd_total_kg: Math.round(gramas / 10) / 100,
          qtd_total_medidas: medidas,
          por_escola: Array.from(entry.por_escola.values()).map((e) => ({
            escola_id: e.escola_id,
            escola_nome: e.escola_nome,
            gramas: Math.round(e.gramas),
            kg: Math.round(e.gramas / 10) / 100,
          })),
        }
      })
      .sort((a, b) => b.qtd_total_gramas - a.qtd_total_gramas)

    // Snapshot de escolas consideradas
    const escolasSnapshot = escolas.map((e) => ({
      id: e.id,
      nome: e.nome,
      categoria: e.categoria,
      alunos_parcial: e.alunos_parcial || 0,
      alunos_integral: e.alunos_integral || 0,
      mescla: e.mescla_parcial_integral,
    }))

    // Resumo por grupo alimentar
    const porGrupo: Record<string, number> = {}
    for (const item of itens) {
      const g = item.alimento_grupo || 'Outros'
      porGrupo[g] = (porGrupo[g] || 0) + item.qtd_total_gramas
    }

    return NextResponse.json({
      cardapio: {
        id: cardapio.id,
        nome: cardapio.nome,
        fase_escolar: cardapio.fase_escolar,
        ano: cardapio.ano,
        semestre: cardapio.semestre,
      },
      semanas_consideradas: cardapio.semanas.map((s) => s.numero),
      escolas: escolasSnapshot,
      total_alunos_parcial: escolasSnapshot.reduce((acc, e) => acc + e.alunos_parcial, 0),
      total_alunos_integral: escolasSnapshot.reduce((acc, e) => acc + e.alunos_integral, 0),
      total_itens: itens.length,
      total_gramas: itens.reduce((acc, i) => acc + i.qtd_total_gramas, 0),
      total_kg: Math.round(itens.reduce((acc, i) => acc + i.qtd_total_gramas, 0) / 100) / 10,
      por_grupo: porGrupo,
      itens,
    })
  } catch (error) {
    console.error('Erro ao gerar lista de compras:', error)
    return NextResponse.json({ error: 'Erro ao gerar lista de compras' }, { status: 500 })
  }
}

// ============================================================
// POST /api/nutricao/lista-compras
// Salva um snapshot da lista de compras gerada.
// Body: { nome, cardapio_id, escolas_snapshot, itens_json }
// ============================================================
export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.nome || !body.cardapio_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome, cardapio_id' },
        { status: 400 }
      )
    }

    const geradaEm = new Date().toISOString().replace('T', ' ').substring(0, 19)

    const lista = await db.listaCompras.create({
      data: {
        nome: body.nome,
        cardapio_id: body.cardapio_id,
        gerada_em: geradaEm,
        escolas_snapshot: JSON.stringify(body.escolas_snapshot || []),
        itens_json: JSON.stringify(body.itens_json || []),
        status: 'GERADA',
      },
    })

    return NextResponse.json(lista, { status: 201 })
  } catch (error) {
    console.error('Erro ao salvar lista de compras:', error)
    return NextResponse.json({ error: 'Erro ao salvar lista de compras' }, { status: 500 })
  }
}
