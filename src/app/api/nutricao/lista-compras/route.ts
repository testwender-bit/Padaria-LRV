import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPercapitaPorFase, type FaseEscolar } from '@/lib/nutricao-utils'
import { isRefeicaoPrincipal } from '@/lib/cardapio-base-utils'

// ============================================================
// GET /api/nutricao/lista-compras
// ============================================================
// v9.3 — FLUXO SIMPLIFICADO:
//   Recebe: cardapio_ids (múltiplos) + semanas
//   Cada cardápio JÁ tem escola_id vinculado.
//   A API busca a escola de cada cardápio automaticamente.
//   Usa os alunos daquela escola + fase daquele cardápio.
//
// Query: cardapio_ids=id1,id2,id3 (obrigatório)
//        semanas="1,2,3" ou "all" (default: all)
//
// NÃO recebe mais escolas_ids — é redundante.
// ============================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const cardapioIdsParam = searchParams.get('cardapio_ids') || searchParams.get('cardapio_id')
    if (!cardapioIdsParam) {
      return NextResponse.json({ error: 'Query param obrigatório: cardapio_ids' }, { status: 400 })
    }
    const cardapioIds = cardapioIdsParam.split(',').map((s) => s.trim()).filter(Boolean)

    const semanasParam = searchParams.get('semanas') || 'all'
    const semanasLista = semanasParam === 'all'
      ? null
      : semanasParam.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0)

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

    // Busca TODOS os cardápios selecionados COM a escola vinculada
    const cardapios = await db.cardapioNutricional.findMany({
      where: { id: { in: cardapioIds } },
      include: {
        escola: { select: { id: true, nome: true, nome_curto: true, alunos_parcial: true, alunos_integral: true, mescla_parcial_integral: true } },
        semanas: semanasLista
          ? { where: { numero: { in: semanasLista } }, include: semanasInclude }
          : { include: semanasInclude },
      },
    })

    if (cardapios.length === 0) {
      return NextResponse.json({ error: 'Nenhum cardápio encontrado' }, { status: 404 })
    }

    // v9.3: Filtra só cardápios que têm escola vinculada (ignora bases sem escola)
    const cardapiosComEscola = cardapios.filter(c => c.escola_id && c.escola)
    if (cardapiosComEscola.length === 0) {
      return NextResponse.json({
        error: 'Os cardápios selecionados não têm escola vinculada. Selecione cardápios de escolas (não bases).'
      }, { status: 400 })
    }

    // v9.3: acumulador único para TODOS os cardápios
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

    // v9.3: processa CADA cardápio usando a SUA escola vinculada
    const todasSemanasConsideradas = new Set<number>()
    const escolasSnapshot: Array<{ id: string; nome: string; alunos_parcial: number; alunos_integral: number; mescla: boolean }> = []
    const escolasProcessadas = new Set<string>()

    for (const cardapio of cardapiosComEscola) {
      const escola = cardapio.escola!
      const faseEscolar = cardapio.fase_escolar as FaseEscolar

      // Snapshot da escola (só adiciona uma vez)
      if (!escolasProcessadas.has(escola.id)) {
        escolasProcessadas.add(escola.id)
        escolasSnapshot.push({
          id: escola.id,
          nome: escola.nome,
          alunos_parcial: escola.alunos_parcial || 0,
          alunos_integral: escola.alunos_integral || 0,
          mescla: escola.mescla_parcial_integral || false,
        })
      }

      // Para cada semana do cardápio
      for (const semana of cardapio.semanas) {
        todasSemanasConsideradas.add(semana.numero)
        // Para cada dia
        for (const dia of semana.dias) {
          // Para cada item (refeição × preparação)
          for (const item of dia.itens) {
            const isPrincipal = isRefeicaoPrincipal(item.tipo_refeicao.codigo)

            // Para cada ingrediente da preparação
            for (const ing of item.preparacao.ingredientes) {
              // Calcular percapita em gramas para a fase escolar DO CARDÁPIO
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

              // v9.3: Usa OS ALUNOS DA ESCOLA VINCULADA a este cardápio
              const total = calcularPercapitaTotalSimples(
                percapitaFinal,
                escola.alunos_parcial || 0,
                escola.alunos_integral || 0,
                escola.mescla_parcial_integral || false,
                isPrincipal
              )

              if (total <= 0) continue

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
              entry.qtd_total_gramas += total

              if (!entry.por_escola.has(escola.id)) {
                entry.por_escola.set(escola.id, {
                  escola_id: escola.id,
                  escola_nome: escola.nome,
                  gramas: 0,
                })
              }
              entry.por_escola.get(escola.id)!.gramas += total
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

    // Resumo por grupo alimentar
    const porGrupo: Record<string, number> = {}
    for (const item of itens) {
      const g = item.alimento_grupo || 'Outros'
      porGrupo[g] = (porGrupo[g] || 0) + item.qtd_total_gramas
    }

    return NextResponse.json({
      cardapio: {
        id: cardapiosComEscola.length === 1 ? cardapiosComEscola[0].id : '',
        nome: cardapiosComEscola.length === 1
          ? cardapiosComEscola[0].nome
          : `${cardapiosComEscola.length} cardápios`,
        fase_escolar: cardapiosComEscola.length === 1 ? cardapiosComEscola[0].fase_escolar : 'múltiplas',
        ano: cardapiosComEscola[0]?.ano || 0,
        semestre: cardapiosComEscola[0]?.semestre || 0,
      },
      cardapios_nomes: cardapiosComEscola.map((c) => `${c.nome} — ${c.escola?.nome || '?'}`),
      semanas_consideradas: Array.from(todasSemanasConsideradas).sort((a, b) => a - b),
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
// v9.3: Cálculo simplificado de percapita × alunos
// Corrige o bug do Caso 5 (× 2 para refeições não-principais)
// ============================================================
// Regras:
//   1. Só parcial: percapita × alunos_parcial
//   2. Só integral: percapita × alunos_integral (1× — não 2×)
//   3. Mescla + refeição principal: percapita × (parcial + integral)
//   4. Mescla + refeição não-principal: percapita × alunos_integral
//   5. Sem mescla (ambos > 0): percapita × parcial + percapita × integral (não × 2)
// ============================================================
function calcularPercapitaTotalSimples(
  percapitaGramas: number,
  alunosParcial: number,
  alunosIntegral: number,
  mescla: boolean,
  refeicaoPrincipal: boolean
): number {
  // Caso 1: só parcial
  if (alunosIntegral === 0) {
    return percapitaGramas * alunosParcial
  }

  // Caso 2: só integral (v9.3: 1× não 2×)
  if (alunosParcial === 0) {
    return percapitaGramas * alunosIntegral
  }

  // Caso 3: mescla + refeição principal
  if (mescla && refeicaoPrincipal) {
    return percapitaGramas * (alunosParcial + alunosIntegral)
  }

  // Caso 4: mescla + refeição não-principal (só integral)
  if (mescla && !refeicaoPrincipal) {
    return percapitaGramas * alunosIntegral
  }

  // Caso 5: sem mescla (ambos > 0) — v9.3: soma simples (não × 2)
  return percapitaGramas * alunosParcial + percapitaGramas * alunosIntegral
}

// ============================================================
// POST /api/nutricao/lista-compras
// Salva um snapshot da lista de compras gerada.
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
