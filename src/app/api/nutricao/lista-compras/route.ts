import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularPercapitaTotal,
  isRefeicaoPrincipal,
} from '@/lib/cardapio-base-utils'
import { calcularPercapitaPorFase, type FaseEscolar } from '@/lib/nutricao-utils'
import {
  normalizarNomeIngrediente,
  obterCategoria,
  obterUnidade,
  ordenarItens,
  CATEGORIAS_LISTA,
  CATEGORIA_LABELS,
  type CategoriaLista,
  type ItemListaComprasConsolidado,
  type ListaComprasResultado,
} from '@/lib/lista-compras-utils'

// ============================================================
// GET /api/nutricao/lista-compras
//
// Dois modos de operação:
//
// ── MODO 1: PREVISAO (prever para X tempo em toda a rede) ──
// Params:
//   modo=PREVISAO
//   escolas_ids=id1,id2,...    (omitir = todas as ativas)
//   data_inicio=YYYY-MM-DD     (obrigatório)
//   data_fim=YYYY-MM-DD        (obrigatório)
//
// O sistema busca todos os CardapioNutricional das escolas-alvo (ou os
// cardápios base por categoria), encontra as CardapioSemanaNutri cujo
// intervalo [data_inicio, data_fim] se sobrepõe ao período pedido,
// agrega todos os ingredientes × alunos e retorna a lista consolidada.
//
// ── MODO 2: PEDIDO (pedido semanal de UMA escola) ──
// Params:
//   modo=PEDIDO
//   escola_id=xxx               (obrigatório — UMA escola)
//   data_referencia=YYYY-MM-DD  (data dentro da semana desejada;
//                                 default: hoje)
//
// Regra de período (conforme categoria da escola):
//   - INTERIOR: quarta da semana atual → terça da semana seguinte
//   - Demais (REGULAR, INTEGRAL, BIFASICA, CRECHE, OUTROS):
//     terça da semana atual → segunda da semana seguinte
//
// ── MODO LEGADO (compatibilidade) ──
// Se `modo` for omitido, aceita os parâmetros antigos:
//   cardapio_id (obrigatório)
//   semanas=all|1,2,3
//   escolas_ids=id1,id2,...
// E retorna o formato antigo (sem normalização).
// ============================================================

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Adiciona dias a uma data
function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

// Retorna o dia da semana (0=domingo, 1=segunda, ..., 6=sábado)
function diaSemanaNum(d: Date): number {
  return d.getDay()
}

// Ajusta para o dia da semana desejado (0=dom, 1=seg, ..., 6=sáb) na mesma semana
function paraDiaSemana(d: Date, alvo: number): Date {
  const result = new Date(d)
  const diff = alvo - diaSemanaNum(d)
  result.setDate(result.getDate() + diff)
  return result
}

// Calcula período do pedido semanal conforme categoria da escola
function calcularPeriodoPedido(categoria: string, refDate: Date): { inicio: Date; fim: Date; descricao: string } {
  const isInterior = (categoria || '').toUpperCase() === 'INTERIOR'
  if (isInterior) {
    // Quarta da semana atual → terça da semana seguinte (7 dias)
    const inicio = paraDiaSemana(refDate, 3)  // 3 = quarta
    const fim = addDays(inicio, 6)  // terça da semana seguinte
    return {
      inicio,
      fim,
      descricao: `Pedido Semanal (Interior): Quarta ${toISO(inicio)} a Terça ${toISO(fim)}`,
    }
  } else {
    // Terça da semana atual → segunda da semana seguinte (7 dias)
    const inicio = paraDiaSemana(refDate, 2)  // 2 = terça
    const fim = addDays(inicio, 6)  // segunda da semana seguinte
    return {
      inicio,
      fim,
      descricao: `Pedido Semanal: Terça ${toISO(inicio)} a Segunda ${toISO(fim)}`,
    }
  }
}

// Include reutilizável para carregar cardápio completo
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

// ──────────────────────────────────────────────────────────────
// MODO PREVISAO — agrega ingredientes de múltiplas escolas num período
// ──────────────────────────────────────────────────────────────
async function handlePrevisao(
  dataInicio: Date,
  dataFim: Date,
  escolasIds: string[] | null,
) {
  // Buscar escolas-alvo
  const escolas = await db.escola.findMany({
    where: {
      ativo: true,
      ...(escolasIds && escolasIds.length > 0 ? { id: { in: escolasIds } } : {}),
    },
    orderBy: [{ ordem_rota: 'asc' }, { nome_curto: 'asc' }],
  })

  if (escolas.length === 0) {
    return NextResponse.json({ error: 'Nenhuma escola encontrada' }, { status: 404 })
  }

  // Buscar TODOS os cardápios que tenham semanas cujo período se sobrepõe
  // ao período solicitado [dataInicio, dataFim].
  // Estratégia: buscar todas as CardapioSemanaNutri onde
  //   data_inicio <= dataFim AND data_fim >= dataInicio
  // depois agrupar por cardapio_id.
  const dataInicioStr = toISO(dataInicio)
  const dataFimStr = toISO(dataFim)

  // Primeiro: buscar IDs de semanas que se sobrepõem
  const semanasOcorrencias = await db.cardapioSemanaNutri.findMany({
    where: {
      AND: [
        { data_inicio: { lte: dataFimStr } },
        { data_fim: { gte: dataInicioStr } },
      ],
    },
    select: { id: true, cardapio_id: true, numero: true, data_inicio: true, data_fim: true },
  })

  if (semanasOcorrencias.length === 0) {
    return NextResponse.json({
      modo: 'PREVISAO',
      periodo: {
        data_inicio: dataInicioStr,
        data_fim: dataFimStr,
        descricao: `Previsão de ${dataInicioStr} a ${dataFimStr}`,
      },
      escolas: [],
      cardapios_utilizados: [],
      semanas_consideradas: [],
      totais: { total_escolas: escolas.length, total_alunos_parcial: 0, total_alunos_integral: 0, total_itens: 0, total_kg: 0 },
      por_categoria: [],
      itens: [],
    } satisfies ListaComprasResultado)
  }

  // Agrupar semanas por cardapio_id
  const cardapioParaSemanas = new Map<string, number[]>()
  for (const s of semanasOcorrencias) {
    if (!cardapioParaSemanas.has(s.cardapio_id)) {
      cardapioParaSemanas.set(s.cardapio_id, [])
    }
    cardapioParaSemanas.get(s.cardapio_id)!.push(s.numero)
  }

  // Carregar cardápios completos (com semanas filtradas)
  const cardapios = await Promise.all(
    Array.from(cardapioParaSemanas.keys()).map((cid) =>
      db.cardapioNutricional.findUnique({
        where: { id: cid },
        include: {
          semanas: {
            where: { numero: { in: cardapioParaSemanas.get(cid)! } },
            include: semanasInclude,
          },
        },
      })
    )
  )

  const cardapiosValidos = cardapios.filter(Boolean) as NonNullable<typeof cardapios[number]>[]

  // Para cada escola-alvo, determinar qual cardápio usar.
  // Regra: se a escola tem cardápio próprio (escola_id = escola.id), usar esse.
  // Senão, usar o cardápio base da categoria da escola (escola_id = null AND categoria_escola = escola.categoria).
  function encontrarCardapioDaEscola(escola: { id: string; categoria: string; categoria_escola?: string }) {
    // 1. Cardápio próprio da escola
    let card = cardapiosValidos.find((c) => c.escola_id === escola.id)
    if (card) return card
    // 2. Cardápio base da categoria
    const catEscola = (escola.categoria || '').toUpperCase()
    card = cardapiosValidos.find((c) =>
      c.escola_id === null && (c.categoria_escola || '').toUpperCase() === catEscola
    )
    if (card) return card
    // 3. Qualquer cardápio base (fallback)
    card = cardapiosValidos.find((c) => c.escola_id === null)
    return card
  }

  // ── Acumulador ──
  // Chave: alimento_id (do banco) → consolidado por nome canônico
  const acumulador = new Map<string, {
    alimento_id: string
    nome_original: string
    nome_canonico: string
    qtd_total_gramas: number
    por_escola: Map<string, { escola_id: string; escola_nome: string; escola_curto: string; qtd_gramas: number }>
  }>()

  const cardapiosUtilizadosSet = new Set<string>()
  const semanasConsideradasSet = new Map<string, { numero: number; data_inicio: string; data_fim: string }>()

  for (const escola of escolas) {
    const cardapio = encontrarCardapioDaEscola(escola)
    if (!cardapio) continue

    cardapiosUtilizadosSet.add(cardapio.id)
    const faseEscolar = cardapio.fase_escolar as FaseEscolar

    for (const semana of cardapio.semanas) {
      semanasConsideradasSet.set(`${cardapio.id}_${semana.numero}`, {
        numero: semana.numero,
        data_inicio: semana.data_inicio,
        data_fim: semana.data_fim,
      })

      for (const dia of semana.dias) {
        for (const item of dia.itens) {
          const isPrincipal = isRefeicaoPrincipal(item.tipo_refeicao.codigo)

          for (const ing of item.preparacao.ingredientes) {
            let percapitaGramas = ing.quantidade_gramas
            if (!ing.mesma_percapita) {
              const pc = ing.percapitas?.find((p) => p.fase_escolar === faseEscolar)
              if (pc) {
                percapitaGramas = pc.quantidade_gramas
              } else {
                percapitaGramas = calcularPercapitaPorFase(ing.quantidade_gramas, faseEscolar)
              }
            }
            const percapitaFinal = percapitaGramas * item.porcoes

            const total = calcularPercapitaTotal(percapitaFinal, isPrincipal, {
              alunos_parcial: escola.alunos_parcial || 0,
              alunos_integral: escola.alunos_integral || 0,
              mescla_parcial_integral: escola.mescla_parcial_integral,
            })

            if (total.total_gramas <= 0) continue

            const key = ing.alimento.id
            if (!acumulador.has(key)) {
              acumulador.set(key, {
                alimento_id: ing.alimento.id,
                nome_original: ing.alimento.nome,
                nome_canonico: normalizarNomeIngrediente(ing.alimento.nome),
                qtd_total_gramas: 0,
                por_escola: new Map(),
              })
            }
            const entry = acumulador.get(key)!
            entry.qtd_total_gramas += total.total_gramas

            if (!entry.por_escola.has(escola.id)) {
              entry.por_escola.set(escola.id, {
                escola_id: escola.id,
                escola_nome: escola.nome,
                escola_curto: escola.nome_curto,
                qtd_gramas: 0,
              })
            }
            entry.por_escola.get(escola.id)!.qtd_gramas += total.total_gramas
          }
        }
      }
    }
  }

  // Construir itens consolidados por NOME CANÔNICO (não por alimento_id)
  // Vários alimentos do banco podem mapear para o mesmo nome canônico (ex: variações)
  const porNomeCanonico = new Map<string, {
    nome_canonico: string
    nome_original_primario: string
    alimento_ids: string[]
    qtd_total_gramas: number
    por_escola: Map<string, { escola_id: string; escola_nome: string; escola_curto: string; qtd_gramas: number }>
  }>()

  for (const entry of acumulador.values()) {
    const nc = entry.nome_canonico
    if (!porNomeCanonico.has(nc)) {
      porNomeCanonico.set(nc, {
        nome_canonico: nc,
        nome_original_primario: entry.nome_original,
        alimento_ids: [],
        qtd_total_gramas: 0,
        por_escola: new Map(),
      })
    }
    const consolidado = porNomeCanonico.get(nc)!
    consolidado.qtd_total_gramas += entry.qtd_total_gramas
    consolidado.alimento_ids.push(entry.alimento_id)
    // Merge por_escola
    for (const pe of entry.por_escola.values()) {
      if (!consolidado.por_escola.has(pe.escola_id)) {
        consolidado.por_escola.set(pe.escola_id, { ...pe })
      } else {
        consolidado.por_escola.get(pe.escola_id)!.qtd_gramas += pe.qtd_gramas
      }
    }
  }

  // Construir array de itens, ordenar
  const itens: ItemListaComprasConsolidado[] = ordenarItens(
    Array.from(porNomeCanonico.values()).map((c) => {
      const gramas = Math.round(c.qtd_total_gramas)
      const unidade = obterUnidade(c.nome_canonico)
      // Converter para unidade canônica
      let qtd_total_unidade = gramas / 1000  // default: kg
      if (unidade === 'g') qtd_total_unidade = gramas
      else if (unidade === 'kg') qtd_total_unidade = gramas / 1000
      else if (unidade === 'L') qtd_total_unidade = gramas / 1000
      else qtd_total_unidade = gramas / 1000  // pacotes/baldes/etc — usar kg como aproximação
      return {
        alimento_id: c.alimento_ids[0] || '',
        nome_original: c.nome_original_primario,
        nome_canonico: c.nome_canonico,
        categoria: obterCategoria(c.nome_canonico),
        unidade,
        qtd_total_gramas: gramas,
        qtd_total_kg: Math.round(gramas / 10) / 100,
        qtd_total_unidade: Math.round(qtd_total_unidade * 100) / 100,
        por_escola: Array.from(c.por_escola.values()).map((pe) => ({
          escola_id: pe.escola_id,
          escola_nome: pe.escola_nome,
          escola_curto: pe.escola_curto,
          qtd_gramas: Math.round(pe.qtd_gramas),
        })),
      }
    })
  )

  // Resumo por categoria
  const porCategoriaMap = new Map<string, { itens: number; kg: number }>()
  for (const item of itens) {
    const cat = item.categoria
    if (!porCategoriaMap.has(cat)) porCategoriaMap.set(cat, { itens: 0, kg: 0 })
    porCategoriaMap.get(cat)!.itens += 1
    porCategoriaMap.get(cat)!.kg += item.qtd_total_kg
  }
  const por_categoria = [
    ...CATEGORIAS_LISTA.map((c) => {
      const v = porCategoriaMap.get(c)
      return v
        ? { categoria: c, label: CATEGORIA_LABELS[c], itens: v.itens, kg: Math.round(v.kg * 100) / 100 }
        : { categoria: c, label: CATEGORIA_LABELS[c], itens: 0, kg: 0 }
    }),
    ...(porCategoriaMap.has('OUTROS')
      ? [{ categoria: 'OUTROS' as const, label: 'Outros (não mapeados)', itens: porCategoriaMap.get('OUTROS')!.itens, kg: Math.round(porCategoriaMap.get('OUTROS')!.kg * 100) / 100 }]
      : []),
  ].filter((c) => c.itens > 0)

  const totalAlunosParcial = escolas.reduce((s, e) => s + (e.alunos_parcial || 0), 0)
  const totalAlunosIntegral = escolas.reduce((s, e) => s + (e.alunos_integral || 0), 0)
  const totalKg = itens.reduce((s, i) => s + i.qtd_total_kg, 0)

  return NextResponse.json({
    modo: 'PREVISAO',
    periodo: {
      data_inicio: dataInicioStr,
      data_fim: dataFimStr,
      descricao: `Previsão de Rede: ${dataInicioStr.split('-').reverse().join('/')} a ${dataFimStr.split('-').reverse().join('/')}`,
    },
    escolas: escolas.map((e) => ({
      id: e.id,
      nome: e.nome,
      nome_curto: e.nome_curto,
      categoria: e.categoria,
      rota: e.rota,
      alunos_parcial: e.alunos_parcial || 0,
      alunos_integral: e.alunos_integral || 0,
    })),
    cardapios_utilizados: Array.from(cardapiosUtilizadosSet).map((id) => {
      const c = cardapiosValidos.find((cv) => cv.id === id)
      return {
        id,
        nome: c?.nome || '',
        categoria_escola: c?.categoria_escola || '',
        fase_escolar: c?.fase_escolar || '',
      }
    }),
    semanas_consideradas: Array.from(semanasConsideradasSet.values()),
    totais: {
      total_escolas: escolas.length,
      total_alunos_parcial: totalAlunosParcial,
      total_alunos_integral: totalAlunosIntegral,
      total_itens: itens.length,
      total_kg: Math.round(totalKg * 100) / 100,
    },
    por_categoria,
    itens,
  } satisfies ListaComprasResultado)
}

// ──────────────────────────────────────────────────────────────
// MODO PEDIDO — lista para UMA escola em UMA semana
// ──────────────────────────────────────────────────────────────
async function handlePedido(escolaId: string, dataReferencia: Date) {
  const escola = await db.escola.findUnique({ where: { id: escolaId } })
  if (!escola) {
    return NextResponse.json({ error: 'Escola não encontrada' }, { status: 404 })
  }

  const periodo = calcularPeriodoPedido(escola.categoria, dataReferencia)
  // O pedido cobre 7 dias a partir de terça (regular) ou quarta (interior).
  // Como o cardápio só tem seg-sex, o pedido cobre 5 dias úteis distribuídos
  // em até 2 semanas do cardápio.
  // Estratégia: buscar CardapioSemanaNutri cujo período se sobrepõe ao do pedido.
  const dataInicioStr = toISO(periodo.inicio)
  const dataFimStr = toISO(periodo.fim)

  // Buscar cardápio da escola (próprio ou base da categoria)
  const catEscola = (escola.categoria || '').toUpperCase()
  let cardapio = await db.cardapioNutricional.findFirst({
    where: { escola_id: escola.id, status: 'APROVADO' },
    include: {
      semanas: {
        where: {
          AND: [
            { data_inicio: { lte: dataFimStr } },
            { data_fim: { gte: dataInicioStr } },
          ],
        },
        include: semanasInclude,
      },
    },
  })
  if (!cardapio) {
    // Fallback: cardápio base da categoria
    cardapio = await db.cardapioNutricional.findFirst({
      where: { escola_id: null, categoria_escola: catEscola, status: 'APROVADO' },
      include: {
        semanas: {
          where: {
            AND: [
              { data_inicio: { lte: dataFimStr } },
              { data_fim: { gte: dataInicioStr } },
            ],
          },
          include: semanasInclude,
        },
      },
    })
  }
  if (!cardapio) {
    // Último fallback: qualquer cardápio base
    cardapio = await db.cardapioNutricional.findFirst({
      where: { escola_id: null, status: 'APROVADO' },
      include: {
        semanas: {
          where: {
            AND: [
              { data_inicio: { lte: dataFimStr } },
              { data_fim: { gte: dataInicioStr } },
            ],
          },
          include: semanasInclude,
        },
      },
    })
  }
  if (!cardapio || cardapio.semanas.length === 0) {
    return NextResponse.json({
      modo: 'PEDIDO',
      periodo: {
        data_inicio: dataInicioStr,
        data_fim: dataFimStr,
        descricao: periodo.descricao,
      },
      escolas: [{
        id: escola.id,
        nome: escola.nome,
        nome_curto: escola.nome_curto,
        categoria: escola.categoria,
        rota: escola.rota,
        alunos_parcial: escola.alunos_parcial || 0,
        alunos_integral: escola.alunos_integral || 0,
      }],
      cardapios_utilizados: [],
      semanas_consideradas: [],
      totais: { total_escolas: 1, total_alunos_parcial: escola.alunos_parcial || 0, total_alunos_integral: escola.alunos_integral || 0, total_itens: 0, total_kg: 0 },
      por_categoria: [],
      itens: [],
    } satisfies ListaComprasResultado)
  }

  const faseEscolar = cardapio.fase_escolar as FaseEscolar

  // Acumulador (mesma estrutura do modo previsão, mas só 1 escola)
  const acumulador = new Map<string, {
    alimento_id: string
    nome_original: string
    nome_canonico: string
    qtd_total_gramas: number
  }>()

  for (const semana of cardapio.semanas) {
    for (const dia of semana.dias) {
      for (const item of dia.itens) {
        const isPrincipal = isRefeicaoPrincipal(item.tipo_refeicao.codigo)

        for (const ing of item.preparacao.ingredientes) {
          let percapitaGramas = ing.quantidade_gramas
          if (!ing.mesma_percapita) {
            const pc = ing.percapitas?.find((p) => p.fase_escolar === faseEscolar)
            if (pc) {
              percapitaGramas = pc.quantidade_gramas
            } else {
              percapitaGramas = calcularPercapitaPorFase(ing.quantidade_gramas, faseEscolar)
            }
          }
          const percapitaFinal = percapitaGramas * item.porcoes

          const total = calcularPercapitaTotal(percapitaFinal, isPrincipal, {
            alunos_parcial: escola.alunos_parcial || 0,
            alunos_integral: escola.alunos_integral || 0,
            mescla_parcial_integral: escola.mescla_parcial_integral,
          })

          if (total.total_gramas <= 0) continue

          const key = ing.alimento.id
          if (!acumulador.has(key)) {
            acumulador.set(key, {
              alimento_id: ing.alimento.id,
              nome_original: ing.alimento.nome,
              nome_canonico: normalizarNomeIngrediente(ing.alimento.nome),
              qtd_total_gramas: 0,
            })
          }
          acumulador.get(key)!.qtd_total_gramas += total.total_gramas
        }
      }
    }
  }

  // Consolidar por nome canônico
  const porNomeCanonico = new Map<string, { nome_canonico: string; nome_original_primario: string; qtd_total_gramas: number }>()
  for (const entry of acumulador.values()) {
    const nc = entry.nome_canonico
    if (!porNomeCanonico.has(nc)) {
      porNomeCanonico.set(nc, {
        nome_canonico: nc,
        nome_original_primario: entry.nome_original,
        qtd_total_gramas: 0,
      })
    }
    porNomeCanonico.get(nc)!.qtd_total_gramas += entry.qtd_total_gramas
  }

  const itens: ItemListaComprasConsolidado[] = ordenarItens(
    Array.from(porNomeCanonico.values()).map((c) => {
      const gramas = Math.round(c.qtd_total_gramas)
      const unidade = obterUnidade(c.nome_canonico)
      let qtd_total_unidade = gramas / 1000
      if (unidade === 'g') qtd_total_unidade = gramas
      return {
        alimento_id: '',
        nome_original: c.nome_original_primario,
        nome_canonico: c.nome_canonico,
        categoria: obterCategoria(c.nome_canonico),
        unidade,
        qtd_total_gramas: gramas,
        qtd_total_kg: Math.round(gramas / 10) / 100,
        qtd_total_unidade: Math.round(qtd_total_unidade * 100) / 100,
        por_escola: [{
          escola_id: escola.id,
          escola_nome: escola.nome,
          escola_curto: escola.nome_curto,
          qtd_gramas: gramas,
        }],
      }
    })
  )

  const porCategoriaMap = new Map<string, { itens: number; kg: number }>()
  for (const item of itens) {
    const cat = item.categoria
    if (!porCategoriaMap.has(cat)) porCategoriaMap.set(cat, { itens: 0, kg: 0 })
    porCategoriaMap.get(cat)!.itens += 1
    porCategoriaMap.get(cat)!.kg += item.qtd_total_kg
  }
  const por_categoria = [
    ...CATEGORIAS_LISTA.map((c) => {
      const v = porCategoriaMap.get(c)
      return v
        ? { categoria: c, label: CATEGORIA_LABELS[c], itens: v.itens, kg: Math.round(v.kg * 100) / 100 }
        : null
    }),
    ...(porCategoriaMap.has('OUTROS')
      ? [{ categoria: 'OUTROS' as const, label: 'Outros (não mapeados)', itens: porCategoriaMap.get('OUTROS')!.itens, kg: Math.round(porCategoriaMap.get('OUTROS')!.kg * 100) / 100 }]
      : []),
  ].filter(Boolean) as Array<{ categoria: CategoriaLista | 'OUTROS'; label: string; itens: number; kg: number }>

  const totalKg = itens.reduce((s, i) => s + i.qtd_total_kg, 0)

  return NextResponse.json({
    modo: 'PEDIDO',
    periodo: {
      data_inicio: dataInicioStr,
      data_fim: dataFimStr,
      descricao: periodo.descricao,
    },
    escolas: [{
      id: escola.id,
      nome: escola.nome,
      nome_curto: escola.nome_curto,
      categoria: escola.categoria,
      rota: escola.rota,
      alunos_parcial: escola.alunos_parcial || 0,
      alunos_integral: escola.alunos_integral || 0,
    }],
    cardapios_utilizados: [{
      id: cardapio.id,
      nome: cardapio.nome,
      categoria_escola: cardapio.categoria_escola,
      fase_escolar: cardapio.fase_escolar,
    }],
    semanas_consideradas: cardapio.semanas.map((s) => ({
      numero: s.numero,
      data_inicio: s.data_inicio,
      data_fim: s.data_fim,
    })),
    totais: {
      total_escolas: 1,
      total_alunos_parcial: escola.alunos_parcial || 0,
      total_alunos_integral: escola.alunos_integral || 0,
      total_itens: itens.length,
      total_kg: Math.round(totalKg * 100) / 100,
    },
    por_categoria,
    itens,
  } satisfies ListaComprasResultado)
}

// ──────────────────────────────────────────────────────────────
// MODO LEGADO — compatibilidade com a página antiga
// ──────────────────────────────────────────────────────────────
async function handleLegado(
  cardapioId: string,
  semanasLista: number[] | null,
  escolasIds: string[] | null,
) {
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

  for (const semana of cardapio.semanas) {
    for (const dia of semana.dias) {
      for (const item of dia.itens) {
        const isPrincipal = isRefeicaoPrincipal(item.tipo_refeicao.codigo)

        for (const ing of item.preparacao.ingredientes) {
          let percapitaGramas = ing.quantidade_gramas
          if (!ing.mesma_percapita) {
            const pc = ing.percapitas?.find((p) => p.fase_escolar === faseEscolar)
            if (pc) {
              percapitaGramas = pc.quantidade_gramas
            } else {
              percapitaGramas = calcularPercapitaPorFase(ing.quantidade_gramas, faseEscolar)
            }
          }
          const percapitaFinal = percapitaGramas * item.porcoes

          for (const escola of escolas) {
            const total = calcularPercapitaTotal(percapitaFinal, isPrincipal, {
              alunos_parcial: escola.alunos_parcial || 0,
              alunos_integral: escola.alunos_integral || 0,
              mescla_parcial_integral: escola.mescla_parcial_integral,
            })

            if (total.total_gramas <= 0) continue

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

            if (!entry.por_escola.has(escola.id)) {
              entry.por_escola.set(escola.id, {
                escola_id: escola.id,
                escola_nome: escola.nome,
                gramas: 0,
              })
            }
            entry.por_escola.get(escola.id)!.gramas += total.total_gramas
          }
        }
      }
    }
  }

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

  const escolasSnapshot = escolas.map((e) => ({
    id: e.id,
    nome: e.nome,
    categoria: e.categoria,
    alunos_parcial: e.alunos_parcial || 0,
    alunos_integral: e.alunos_integral || 0,
    mescla: e.mescla_parcial_integral,
  }))

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
}

// ============================================================
// GET handler
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const modo = (searchParams.get('modo') || '').toUpperCase()

    if (modo === 'PREVISAO') {
      const dataInicio = parseDate(searchParams.get('data_inicio'))
      const dataFim = parseDate(searchParams.get('data_fim'))
      if (!dataInicio || !dataFim) {
        return NextResponse.json({ error: 'Params obrigatórios para PREVISAO: data_inicio, data_fim (YYYY-MM-DD)' }, { status: 400 })
      }
      if (dataInicio > dataFim) {
        return NextResponse.json({ error: 'data_inicio deve ser anterior a data_fim' }, { status: 400 })
      }
      const escolasIdsParam = searchParams.get('escolas_ids')
      const escolasIds = escolasIdsParam
        ? escolasIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
        : null
      return await handlePrevisao(dataInicio, dataFim, escolasIds)
    }

    if (modo === 'PEDIDO') {
      const escolaId = searchParams.get('escola_id')
      if (!escolaId) {
        return NextResponse.json({ error: 'Param obrigatório para PEDIDO: escola_id' }, { status: 400 })
      }
      const dataRef = parseDate(searchParams.get('data_referencia')) || new Date()
      return await handlePedido(escolaId, dataRef)
    }

    // Modo legado
    const cardapioId = searchParams.get('cardapio_id')
    if (!cardapioId) {
      return NextResponse.json({ error: 'Query param obrigatório: cardapio_id (ou modo=PREVISAO/PEDIDO)' }, { status: 400 })
    }
    const semanasParam = searchParams.get('semanas') || 'all'
    const semanasLista = semanasParam === 'all'
      ? null
      : semanasParam.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0)
    const escolasIdsParam = searchParams.get('escolas_ids')
    const escolasIds = escolasIdsParam
      ? escolasIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : null
    return await handleLegado(cardapioId, semanasLista, escolasIds)
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
