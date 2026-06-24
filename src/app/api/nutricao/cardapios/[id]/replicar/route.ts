import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SEMANAS_SEMESTRE, gerarDatasSemanasSemestre } from '@/lib/cardapio-base-utils'
import { isoToPt } from '@/lib/preparacao-categorias'

// ============================================================
// POST /api/nutricao/cardapios/[id]/replicar
// ============================================================
// Replica um CARDÁPIO BASE (escola_id = null) para múltiplas escolas,
// aplicando a realocação de pão/lanche para o dia definido pela escola.
//
// Body:
//   {
//     escolas: [
//       { escola_id: string, dia_pao: "SEG"|"TER"|...|null, dia_lanche: "SEG"|...|null }
//     ],
//     expandir_para_semestre: boolean,  // true = gera 22 semanas (5 base + réplicas)
//                                       // false = só as semanas base (4-5)
//     sobrescrever_existente: boolean   // true = se já existe cardápio da escola no ano/sem, deleta e recria
//   }
//
// Lógica (v5):
//   1. Carrega o cardápio base completo (semanas, dias, itens com preparacao.categoria)
//   2. Detecta quais dias da semana têm preparações de categoria=PAO e categoria=LANCHE
//   3. Para cada escola destino:
//      - Cria um CardapioNutricional com dia_pao_frances / dia_lanche preenchidos
//      - Clona as semanas base PROPAGANDO o campo `ordem` (bug v5: era perdido)
//      - Para cada semana clonada: REALOCA o pão/lanche para o dia configurado
//        usando DESLOCAMENTO para o dia útil mais próximo (em vez de swap puro)
//        — ex: base tem pão na terça, escola quer na sexta; o conteúdo da sexta
//        é deslocado para a quinta (ou quarta se quinta estiver ocupada em outra
//        troca), abrindo espaço para o pão na sexta.
//      - Se expandir_para_semestre=true: gera as semanas 6..22 como réplicas
//   4. Retorna lista de cardápios criados com detalhes das trocas
// ============================================================

interface EscolaDestino {
  escola_id: string
  dia_pao: string | null
  dia_lanche: string | null
}

interface BodyRequest {
  escolas: EscolaDestino[]
  expandir_para_semestre?: boolean
  sobrescrever_existente?: boolean
}

// Ordem canônica dos dias úteis para cálculo de "dia mais próximo"
const ORDEM_DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardapioBaseId } = await params
    const body: BodyRequest = await request.json()

    // ── Validações ──
    if (!Array.isArray(body.escolas) || body.escolas.length === 0) {
      return NextResponse.json(
        { error: 'Informe ao menos uma escola em { escolas: [{ escola_id, dia_pao, dia_lanche }] }' },
        { status: 400 }
      )
    }

    for (const e of body.escolas) {
      if (!e.escola_id) {
        return NextResponse.json({ error: 'Cada escola precisa de escola_id' }, { status: 400 })
      }
      if (e.dia_pao && !['SEG', 'TER', 'QUA', 'QUI', 'SEX'].includes(e.dia_pao)) {
        return NextResponse.json(
          { error: `dia_pao inválido: ${e.dia_pao}. Use SEG, TER, QUA, QUI, SEX ou null` },
          { status: 400 }
        )
      }
      if (e.dia_lanche && !['SEG', 'TER', 'QUA', 'QUI', 'SEX'].includes(e.dia_lanche)) {
        return NextResponse.json(
          { error: `dia_lanche inválido: ${e.dia_lanche}. Use SEG, TER, QUA, QUI, SEX ou null` },
          { status: 400 }
        )
      }
    }

    // ── Carrega cardápio base ──
    const original = await db.cardapioNutricional.findUnique({
      where: { id: cardapioBaseId },
      include: {
        semanas: {
          include: {
            dias: {
              include: {
                itens: {
                  include: {
                    preparacao: { select: { id: true, nome: true, categoria: true } },
                  },
                },
              },
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
        { error: 'Cardápio de origem deve ser um MODELO BASE (escola_id = null). Para replicar uma instância, replique o base original.' },
        { status: 400 }
      )
    }

    // ── Detecta quais dias do base têm pão e lanche ──
    // (faz um scan das semanas base para saber em qual dia caiu o pão/lanche)
    const diasComPao = new Set<string>()      // dia_semana (pt: 'segunda', etc.)
    const diasComLanche = new Set<string>()

    for (const semana of original.semanas) {
      for (const dia of semana.dias) {
        for (const item of dia.itens) {
          if (item.preparacao.categoria === 'PAO') {
            diasComPao.add(dia.dia_semana)
          } else if (item.preparacao.categoria === 'LANCHE') {
            diasComLanche.add(dia.dia_semana)
          }
        }
      }
    }

    const diasPaoArray = Array.from(diasComPao)        // ex: ['segunda']
    const diasLancheArray = Array.from(diasComLanche)

    // ── Carrega escolas destino ──
    const escolasIds = body.escolas.map((e) => e.escola_id)
    const escolas = await db.escola.findMany({
      where: { id: { in: escolasIds }, ativo: true },
    })

    if (escolas.length === 0) {
      return NextResponse.json({ error: 'Nenhuma escola ativa encontrada' }, { status: 404 })
    }

    const criadoEm = new Date().toISOString().replace('T', ' ').substring(0, 19)
    const expandir = body.expandir_para_semestre !== false  // default: true
    const sobrescrever = body.sobrescrever_existente === true

    // ── Transação principal — timeout aumentado para 60s (deslocamento faz mais queries) ──
    const result = await db.$transaction(async (tx) => {
      const criados: Array<{
        escola_id: string
        escola_nome: string
        cardapio_id: string
        trocas: Array<{ tipo: 'PAO' | 'LANCHE'; dia_origem: string; dia_destino: string; dia_deslocado: string | null; semanas_afetadas: number }>
      }> = []
      const erros: Array<{ escola_id: string; motivo: string }> = []

      for (const escola of escolas) {
        try {
          const configEscola = body.escolas.find((e) => e.escola_id === escola.id)!

          // Verifica se já existe cardápio da escola + ano + semestre
          const existente = await tx.cardapioNutricional.findFirst({
            where: {
              escola_id: escola.id,
              ano: original.ano,
              semestre: original.semestre,
            },
          })

          if (existente && !sobrescrever) {
            erros.push({
              escola_id: escola.id,
              motivo: `Já existe cardápio ${original.ano}/${original.semestre} (id: ${existente.id}). Use sobrescrever_existente=true para recriar.`,
            })
            continue
          }
          if (existente) {
            await tx.cardapioNutricional.delete({ where: { id: existente.id } })
          }

          // Cria novo cardápio para a escola
          const nomeInstancia = `${original.nome} — ${escola.nome_curto || escola.nome}`
          const card = await tx.cardapioNutricional.create({
            data: {
              nome: nomeInstancia,
              escola_id: escola.id,
              nutricionista_id: original.nutricionista_id,
              categoria_escola: original.categoria_escola,
              fase_escolar: original.fase_escolar,
              ano: original.ano,
              semestre: original.semestre,
              status: 'RASCUNHO',
              origem_id: original.id,
              cardapio_base_id: original.id,
              ciclo_semanas: original.ciclo_semanas,
              repetir_ciclo: expandir,
              dia_pao_frances: configEscola.dia_pao,
              dia_lanche: configEscola.dia_lanche,
              criado_em: criadoEm,
              atualizado_em: criadoEm,
            },
          })

          // ── Clona as semanas base (apenas as primeiras N = ciclo_semanas) ──
          const ciclo = original.ciclo_semanas || 5
          const semanasBase = original.semanas.filter((s) => s.numero <= ciclo)

          // Pré-calcula as trocas para esta escola
          const trocas: Array<{ tipo: 'PAO' | 'LANCHE'; dia_origem: string; dia_destino: string; dia_deslocado: string | null; semanas_afetadas: number }> = []

          // Para pão: origem = primeiro dia com pão; destino = dia_pao configurado
          let diaOrigemPao: string | null = null
          if (configEscola.dia_pao && diasPaoArray.length > 0) {
            diaOrigemPao = diasPaoArray[0]  // pega o primeiro dia com pão no base
          }

          let diaOrigemLanche: string | null = null
          if (configEscola.dia_lanche && diasLancheArray.length > 0) {
            diaOrigemLanche = diasLancheArray[0]
          }

          // Dias envolvidos em trocas (para o algoritmo de deslocamento não escolher)
          const diasBloqueados = new Set<string>()
          if (diaOrigemPao && configEscola.dia_pao) {
            const destino = isoToPt(configEscola.dia_pao)
            diasBloqueados.add(diaOrigemPao)
            diasBloqueados.add(destino)
          }
          if (diaOrigemLanche && configEscola.dia_lanche) {
            const destino = isoToPt(configEscola.dia_lanche)
            diasBloqueados.add(diaOrigemLanche)
            diasBloqueados.add(destino)
          }

          // Clona semanas base
          for (const semana of semanasBase) {
            const novaSemana = await tx.cardapioSemanaNutri.create({
              data: {
                cardapio_id: card.id,
                numero: semana.numero,
                data_inicio: semana.data_inicio,
                data_fim: semana.data_fim,
                diferenciada: false,
              },
            })

            // Para cada dia da semana original, clona — PROPAGANDO ordem (v5)
            const diasClonados: Record<string, string> = {}  // dia_semana -> dia_id criado

            for (const dia of semana.dias) {
              const novoDia = await tx.cardapioDiaNutri.create({
                data: {
                  semana_id: novaSemana.id,
                  dia_semana: dia.dia_semana,
                },
              })
              diasClonados[dia.dia_semana] = novoDia.id

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

            // ── Aplica realocação de pão com DESLOCAMENTO (v5) ──
            if (diaOrigemPao && configEscola.dia_pao) {
              const diaDestinoPt = isoToPt(configEscola.dia_pao)
              if (diaOrigemPao !== diaDestinoPt) {
                await realocarComDeslocamento(tx, diasClonados, diaOrigemPao, diaDestinoPt, diasBloqueados)
              }
            }

            // ── Aplica realocação de lanche com DESLOCAMENTO (v5) ──
            if (diaOrigemLanche && configEscola.dia_lanche) {
              const diaDestinoPt = isoToPt(configEscola.dia_lanche)
              if (diaOrigemLanche !== diaDestinoPt && diaOrigemLanche !== diaOrigemPao) {
                await realocarComDeslocamento(tx, diasClonados, diaOrigemLanche, diaDestinoPt, diasBloqueados)
              }
            }
          }

          // Registra as trocas para retorno
          if (diaOrigemPao && configEscola.dia_pao) {
            const diaDestinoPt = isoToPt(configEscola.dia_pao)
            if (diaOrigemPao !== diaDestinoPt) {
              trocas.push({
                tipo: 'PAO',
                dia_origem: diaOrigemPao,
                dia_destino: diaDestinoPt,
                dia_deslocado: diaDestinoPt,  // o conteúdo do destino foi deslocado
                semanas_afetadas: semanasBase.length,
              })
            }
          }
          if (diaOrigemLanche && configEscola.dia_lanche) {
            const diaDestinoPt = isoToPt(configEscola.dia_lanche)
            if (diaOrigemLanche !== diaDestinoPt && diaOrigemLanche !== diaOrigemPao) {
              trocas.push({
                tipo: 'LANCHE',
                dia_origem: diaOrigemLanche,
                dia_destino: diaDestinoPt,
                dia_deslocado: diaDestinoPt,
                semanas_afetadas: semanasBase.length,
              })
            }
          }

          // ── Expande para 22 semanas (réplicas) se solicitado ──
          if (expandir && original.semanas.length >= ciclo) {
            const dataInicioBase = original.semanas[0]?.data_inicio
              ? new Date(original.semanas[0].data_inicio + 'T12:00:00')
              : new Date()
            const datasSemanas = gerarDatasSemanasSemestre(dataInicioBase, SEMANAS_SEMESTRE)

            // Atualiza datas das semanas base
            for (let i = 0; i < semanasBase.length; i++) {
              const d = datasSemanas[i]
              if (d) {
                await tx.cardapioSemanaNutri.updateMany({
                  where: { cardapio_id: card.id, numero: i + 1 },
                  data: { data_inicio: d.data_inicio, data_fim: d.data_fim },
                })
              }
            }

            // Gera semanas ciclo+1..22 como cópia
            for (let num = ciclo + 1; num <= SEMANAS_SEMESTRE; num++) {
              const numBase = ((num - 1) % ciclo) + 1
              const baseSemana = semanasBase.find((s) => s.numero === numBase)
              if (!baseSemana) continue

              const d = datasSemanas[num - 1]
              const novaSemana = await tx.cardapioSemanaNutri.create({
                data: {
                  cardapio_id: card.id,
                  numero: num,
                  data_inicio: d.data_inicio,
                  data_fim: d.data_fim,
                  diferenciada: false,
                },
              })

              // Clona dias e itens da semana base FINAL (já com trocas aplicadas)
              // PROPAGANDO ordem (v5)
              const semanaFinalBase = await tx.cardapioSemanaNutri.findFirst({
                where: { cardapio_id: card.id, numero: numBase },
                include: {
                  dias: {
                    include: { itens: true },
                  },
                },
              })
              if (!semanaFinalBase) continue

              for (const dia of semanaFinalBase.dias) {
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
            }
          }

          criados.push({
            escola_id: escola.id,
            escola_nome: escola.nome,
            cardapio_id: card.id,
            trocas,
          })
        } catch (err) {
          erros.push({
            escola_id: escola.id,
            motivo: err instanceof Error ? err.message : 'Erro ao replicar',
          })
        }
      }

      return { criados, erros, base_info: { tem_pao: diasPaoArray.length > 0, tem_lanche: diasLancheArray.length > 0, dias_pao_base: diasPaoArray, dias_lanche_base: diasLancheArray } }
    }, {
      timeout: 60000,  // 60s — deslocamento faz mais queries que swap
      maxWait: 10000,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Erro ao replicar cardápio:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao replicar cardápio' },
      { status: 500 }
    )
  }
}

// ============================================================
// Helper v5: Realoca o conteúdo de diaOrigem → diaDestino
// com DESLOCAMENTO do conteúdo atual de diaDestino para o dia
// útil mais próximo que não esteja bloqueado (envolvido em outra troca).
//
// Ex: base tem pão na terça, escola quer pão na sexta.
//   - Move o conteúdo da sexta (comida) para a quinta (ou quarta se quinta bloqueada)
//   - Move o pão da terça para a sexta
//   - Terça fica vazia do pão (continua com o resto que tinha)
//
// Se diaDestino estiver vazio, simplesmente move sem deslocar nada.
// ============================================================
async function realocarComDeslocamento(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  diasClonados: Record<string, string>,  // mapa dia_semana -> dia_id
  diaOrigem: string,
  diaDestino: string,
  diasBloqueados: Set<string>
): Promise<void> {
  const diaOrigemId = diasClonados[diaOrigem]
  const diaDestinoId = diasClonados[diaDestino]

  if (!diaOrigemId || !diaDestinoId) return

  // 1. Carrega itens do dia origem (vai para o destino)
  const itensOrigem = await tx.cardapioItem.findMany({ where: { dia_id: diaOrigemId } })

  // 2. Carrega itens do dia destino (vai ser deslocado para outro dia)
  const itensDestino = await tx.cardapioItem.findMany({ where: { dia_id: diaDestinoId } })

  // 3. Se destino está vazio, basta mover origem → destino (sem deslocamento)
  if (itensDestino.length === 0) {
    await tx.cardapioItem.deleteMany({ where: { dia_id: diaOrigemId } })
    for (const item of itensOrigem) {
      await tx.cardapioItem.create({
        data: {
          dia_id: diaDestinoId,
          tipo_refeicao_id: item.tipo_refeicao_id,
          preparacao_id: item.preparacao_id,
          porcoes: item.porcoes,
          ordem: item.ordem || 0,
        },
      })
    }
    return
  }

  // 4. Acha o dia útil mais próximo de diaDestino que NÃO esteja bloqueado
  //    Estratégia: alternar entre dia anterior e dia seguinte, expandindo raio.
  //    Ex: destino = sexta → tenta quinta (1 antes), depois segunda (4 antes, vai
  //    pra próxima semana? Não — semanal, então tenta segunda desta semana),
  //    depois quarta (2 antes), depois terça (3 antes).
  //
  //    Na prática, vamos simplesmente iterar em ordem de distância crescente
  //    considerando só dias úteis da mesma semana.
  const idxDestino = ORDEM_DIAS.indexOf(diaDestino)
  if (idxDestino === -1) return

  let diaDeslocado: string | null = null
  // distâncias 1, 2, 3, 4 (max em semana de 5 dias úteis)
  for (let dist = 1; dist < ORDEM_DIAS.length; dist++) {
    // tenta primeiro "antes" (preferência do usuário), depois "depois"
    const candidatos: string[] = []
    const antes = idxDestino - dist
    const depois = idxDestino + dist
    if (antes >= 0) candidatos.push(ORDEM_DIAS[antes])
    if (depois < ORDEM_DIAS.length) candidatos.push(ORDEM_DIAS[depois])

    for (const candidato of candidatos) {
      if (diasBloqueados.has(candidato)) continue
      // candidato é válido! Usa ele.
      diaDeslocado = candidato
      break
    }
    if (diaDeslocado) break
  }

  // 5. Se não achou dia disponível (todos bloqueados), faz swap puro como fallback
  //    (cobre caso extremo de pão na terça e lanche na quinta, escola quer pão na
  //    quinta e lanche na terça — dai destino do pão = origem do lanche e vice-versa)
  if (!diaDeslocado) {
    await trocarItensEntreDias(tx, diaOrigemId, diaDestinoId)
    return
  }

  // 6. Move o conteúdo do diaDestino → diaDeslocado (PROPAGANDO ordem)
  const diaDeslocadoId = diasClonados[diaDeslocado]
  if (!diaDeslocadoId) {
    //Dia deslocado não existe no mapa (improvável) — fallback para swap
    await trocarItensEntreDias(tx, diaOrigemId, diaDestinoId)
    return
  }

  // 6a. Limpa o dia deslocado (caso tenha algo — não deveria, mas por segurança)
  await tx.cardapioItem.deleteMany({ where: { dia_id: diaDeslocadoId } })

  // 6b. Move itensDestino → diaDeslocado
  for (const item of itensDestino) {
    await tx.cardapioItem.create({
      data: {
        dia_id: diaDeslocadoId,
        tipo_refeicao_id: item.tipo_refeicao_id,
        preparacao_id: item.preparacao_id,
        porcoes: item.porcoes,
        ordem: item.ordem || 0,
      },
    })
  }

  // 7. Limpa diaDestino (já foi movido para diaDeslocado) e move itensOrigem → diaDestino
  await tx.cardapioItem.deleteMany({ where: { dia_id: diaDestinoId } })
  await tx.cardapioItem.deleteMany({ where: { dia_id: diaOrigemId } })
  for (const item of itensOrigem) {
    await tx.cardapioItem.create({
      data: {
        dia_id: diaDestinoId,
        tipo_refeicao_id: item.tipo_refeicao_id,
        preparacao_id: item.preparacao_id,
        porcoes: item.porcoes,
        ordem: item.ordem || 0,
      },
    })
  }
}

// ── Helper legado: swap puro entre dois dias (usado como fallback) ──
// Como CardapioItem tem unique (dia_id, tipo_refeicao_id, preparacao_id),
// fazemos via delete + re-create usando IDs temporários.
async function trocarItensEntreDias(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  diaAId: string,
  diaBId: string
): Promise<void> {
  // 1. Carrega itens dos dois dias
  const itensA = await tx.cardapioItem.findMany({ where: { dia_id: diaAId } })
  const itensB = await tx.cardapioItem.findMany({ where: { dia_id: diaBId } })

  // 2. Deleta todos os itens dos dois dias
  await tx.cardapioItem.deleteMany({ where: { dia_id: diaAId } })
  await tx.cardapioItem.deleteMany({ where: { dia_id: diaBId } })

  // 3. Recria itens de A no dia B (preservando ordem — v5)
  for (const item of itensA) {
    await tx.cardapioItem.create({
      data: {
        dia_id: diaBId,
        tipo_refeicao_id: item.tipo_refeicao_id,
        preparacao_id: item.preparacao_id,
        porcoes: item.porcoes,
        ordem: item.ordem || 0,
      },
    })
  }

  // 4. Recria itens de B no dia A (preservando ordem — v5)
  for (const item of itensB) {
    await tx.cardapioItem.create({
      data: {
        dia_id: diaAId,
        tipo_refeicao_id: item.tipo_refeicao_id,
        preparacao_id: item.preparacao_id,
        porcoes: item.porcoes,
        ordem: item.ordem || 0,
      },
    })
  }
}
