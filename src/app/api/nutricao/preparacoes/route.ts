import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { FASES_ESCOLARES, calcularPercapitaPorFase, type FaseEscolar } from '@/lib/nutricao-utils'
import { detectarAlergenosPreparacao } from '@/lib/alergenos-utils'
import { normalizeText } from '@/lib/busca-utils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const busca = searchParams.get('busca')
    const soFavoritas = searchParams.get('favoritas') === 'true'
    const soRecentes = searchParams.get('recentes') === 'true'
    const limiteRecentes = Number(searchParams.get('limite_recentes') || 20)
    // sem_alergenos=L,O  → exclui preparações que contenham leite ou ovo
    const semAlergenosParam = searchParams.get('sem_alergenos')
    const semAlergenos = semAlergenosParam
      ? semAlergenosParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : []

    const where: Record<string, unknown> = {
      ativo: true,
    }

    if (soFavoritas) {
      where.favorita = true
    }

    let orderBy: Record<string, string> = { nome: 'asc' }
    if (soRecentes) {
      // Mais usadas primeiro
      orderBy = { vezes_usada: 'desc' }
    }

    let preparacoes = await db.preparacao.findMany({
      where,
      include: {
        ingredientes: {
          include: {
            alimento: true,
            percapitas: true,
          },
        },
      },
      orderBy,
      ...(soRecentes ? { take: limiteRecentes } : {}),
    })

    // ── Busca por nome SEM ACENTO ──
    if (busca) {
      const buscaNorm = normalizeText(busca)
      preparacoes = preparacoes.filter((p) =>
        normalizeText(p.nome).includes(buscaNorm)
      )
    }

    // Filtro por alérgenos (precisa processar ingredientes)
    if (semAlergenos.length > 0) {
      preparacoes = preparacoes.filter((p) => {
        const alergenos = detectarAlergenosPreparacao(
          p.ingredientes.map((ing) => ({
            nome: ing.alimento.nome,
            grupo: ing.alimento.grupo,
          }))
        )
        // Se a preparação tem QUALQUER alérgeno da lista de exclusão, remover
        return !alergenos.some((a) => semAlergenos.includes(a))
      })
    }

    return NextResponse.json(preparacoes)
  } catch (error) {
    console.error('Erro ao buscar preparações:', error)
    return NextResponse.json({ error: 'Erro ao buscar preparações' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.nome) {
      return NextResponse.json(
        { error: 'Campo obrigatório: nome' },
        { status: 400 }
      )
    }

    if (!body.ingredientes || !Array.isArray(body.ingredientes) || body.ingredientes.length === 0) {
      return NextResponse.json(
        { error: 'Informe pelo menos um ingrediente' },
        { status: 400 }
      )
    }

    // Validar alimentos
    const alimentoIds = body.ingredientes.map(
      (ing: { alimento_id: string }) => ing.alimento_id
    )
    const alimentos = await db.alimento.findMany({
      where: { id: { in: alimentoIds } },
    })
    const alimentoMap = new Map(alimentos.map((a) => [a.id, a]))

    for (const ing of body.ingredientes) {
      if (!alimentoMap.has(ing.alimento_id)) {
        return NextResponse.json(
          { error: `Alimento não encontrado: ${ing.alimento_id}` },
          { status: 400 }
        )
      }
    }

    const preparacao = await db.$transaction(async (tx) => {
      const prep = await tx.preparacao.create({
        data: {
          nome: body.nome,
          descricao: body.descricao || null,
          modo_preparo: body.modo_preparo || null,
          // v8: categoria (default PREPARACAO)
          categoria: body.categoria || 'PREPARACAO',
          ativo: true,
        },
      })

      for (const ing of body.ingredientes) {
        const quantidade_gramas = Number(ing.quantidade_gramas) || 0
        const mesma_percapita = Boolean(ing.mesma_percapita)

        const ingredienteCreated = await tx.preparacaoIngrediente.create({
          data: {
            preparacao_id: prep.id,
            alimento_id: ing.alimento_id,
            quantidade_gramas,
            mesma_percapita,
          },
        })

        // Criar percapitas por fase escolar
        if (!mesma_percapita) {
          // Se o frontend enviou percapitas, usar elas; senão, auto-calcular
          if (ing.percapitas && Array.isArray(ing.percapitas) && ing.percapitas.length > 0) {
            for (const pc of ing.percapitas) {
              if (pc.fase_escolar && pc.quantidade_gramas >= 0) {
                await tx.preparacaoPercapita.create({
                  data: {
                    ingrediente_id: ingredienteCreated.id,
                    fase_escolar: pc.fase_escolar,
                    quantidade_gramas: Number(pc.quantidade_gramas),
                    auto_calculado: Boolean(pc.auto_calculado),
                  },
                })
              }
            }
          } else {
            // Auto-calcular baseado nos percentuais padrão
            for (const fase of FASES_ESCOLARES) {
              const gramasFase = calcularPercapitaPorFase(quantidade_gramas, fase.value as FaseEscolar)
              await tx.preparacaoPercapita.create({
                data: {
                  ingrediente_id: ingredienteCreated.id,
                  fase_escolar: fase.value,
                  quantidade_gramas: gramasFase,
                  auto_calculado: true,
                },
              })
            }
          }
        }
      }

      return tx.preparacao.findUnique({
        where: { id: prep.id },
        include: {
          ingredientes: {
            include: {
              alimento: true,
              percapitas: true,
            },
          },
        },
      })
    })

    return NextResponse.json(preparacao, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar preparação:', error)
    return NextResponse.json({ error: 'Erro ao criar preparação' }, { status: 500 })
  }
}
