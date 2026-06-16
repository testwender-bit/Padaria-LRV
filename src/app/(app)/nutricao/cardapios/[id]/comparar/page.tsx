'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft, GitCompare, RefreshCw, CheckCircle2, Plus, Minus, Edit3,
  Calendar, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { DIAS_SEMANA_NUTRI } from '@/lib/nutricao-utils'

// ── Types ────────────────────────────────────────────────────

interface PreparacaoRef { id: string; nome: string; categoria: string }
interface TipoRefeicaoRef { id: string; nome: string; horario: string }

interface ItemSlot {
  id: string
  tipo_refeicao_id: string
  preparacao_id: string
  porcoes: number
  preparacao: PreparacaoRef
  tipo_refeicao: TipoRefeicaoRef
}

interface DiaSlot {
  id: string
  dia_semana: string
  itens: ItemSlot[]
}

interface SemanaSlot {
  id: string
  numero: number
  diferenciada: boolean
  dias: DiaSlot[]
}

interface CardapioInfo {
  id: string
  nome: string
  escola_id: string | null
  cardapio_base_id: string | null
  ano: number
  semestre: number
  categoria_escola: string
  dia_pao_frances: string | null
  dia_lanche: string | null
  semanas: SemanaSlot[]
}

interface DiffItem {
  tipo_refeicao_id: string
  tipo_refeicao_nome: string
  horario: string
  // 'igual' = mesmo item no mesmo slot
  // 'adicionado' = existe na escola, não no base
  // 'removido' = existe no base, não na escola
  // 'modificado' = mesma preparação mas porções diferentes
  // 'trocado' = preparação diferente no mesmo slot
  diff: 'igual' | 'adicionado' | 'removido' | 'modificado' | 'trocado'
  base?: ItemSlot
  escola?: ItemSlot
}

interface DiffDia {
  dia_semana: string
  itens: DiffItem[]
  total_igual: number
  total_adicionado: number
  total_removido: number
  total_modificado: number
  total_trocado: number
}

interface DiffSemana {
  numero: number
  diferenciada: boolean
  dias: DiffDia[]
  resumo: { igual: number; adicionado: number; removido: number; modificado: number; trocado: number }
}

// ── Helpers ──────────────────────────────────────────────────

function diaLabel(dia: string): string {
  return DIAS_SEMANA_NUTRI.find((d) => d.value === dia)?.label || dia
}

function compararSemana(baseSemana: SemanaSlot, escolaSemana: SemanaSlot): DiffSemana {
  const diasDiff: DiffDia[] = []

  // Para cada dia da semana
  const todosDias = new Set<string>([
    ...baseSemana.dias.map((d) => d.dia_semana),
    ...escolaSemana.dias.map((d) => d.dia_semana),
  ])

  for (const diaSemana of todosDias) {
    const baseDia = baseSemana.dias.find((d) => d.dia_semana === diaSemana)
    const escolaDia = escolaSemana.dias.find((d) => d.dia_semana === diaSemana)

    // Mapa por tipo_refeicao_id
    const baseItens = new Map<string, ItemSlot>()
    if (baseDia) {
      for (const item of baseDia.itens) {
        baseItens.set(item.tipo_refeicao_id, item)
      }
    }
    const escolaItens = new Map<string, ItemSlot>()
    if (escolaDia) {
      for (const item of escolaDia.itens) {
        escolaItens.set(item.tipo_refeicao_id, item)
      }
    }

    // União de todos os tipo_refeicao_id presentes
    const todosTipos = new Set<string>([
      ...baseItens.keys(),
      ...escolaItens.keys(),
    ])

    const itensDiff: DiffItem[] = []
    let total_igual = 0, total_adicionado = 0, total_removido = 0, total_modificado = 0, total_trocado = 0

    for (const tipoId of todosTipos) {
      const baseItem = baseItens.get(tipoId)
      const escolaItem = escolaItens.get(tipoId)

      let diff: DiffItem['diff']
      if (baseItem && escolaItem) {
        if (baseItem.preparacao_id === escolaItem.preparacao_id) {
          if (baseItem.porcoes === escolaItem.porcoes) {
            diff = 'igual'
            total_igual++
          } else {
            diff = 'modificado'
            total_modificado++
          }
        } else {
          diff = 'trocado'
          total_trocado++
        }
      } else if (escolaItem && !baseItem) {
        diff = 'adicionado'
        total_adicionado++
      } else {
        diff = 'removido'
        total_removido++
      }

      itensDiff.push({
        tipo_refeicao_id: tipoId,
        tipo_refeicao_nome: (baseItem || escolaItem)?.tipo_refeicao.nome || tipoId,
        horario: (baseItem || escolaItem)?.tipo_refeicao.horario || '',
        diff,
        base: baseItem,
        escola: escolaItem,
      })
    }

    diasDiff.push({
      dia_semana: diaSemana,
      itens: itensDiff.sort((a, b) => a.horario.localeCompare(b.horario)),
      total_igual,
      total_adicionado,
      total_removido,
      total_modificado,
      total_trocado,
    })
  }

  const resumo = diasDiff.reduce(
    (acc, d) => ({
      igual: acc.igual + d.total_igual,
      adicionado: acc.adicionado + d.total_adicionado,
      removido: acc.removido + d.total_removido,
      modificado: acc.modificado + d.total_modificado,
      trocado: acc.trocado + d.total_trocado,
    }),
    { igual: 0, adicionado: 0, removido: 0, modificado: 0, trocado: 0 }
  )

  return {
    numero: escolaSemana.numero,
    diferenciada: escolaSemana.diferenciada,
    dias: diasDiff.sort((a, b) => {
      const order = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
      return order.indexOf(a.dia_semana) - order.indexOf(b.dia_semana)
    }),
    resumo,
  }
}

function diffColor(diff: DiffItem['diff']): string {
  switch (diff) {
    case 'igual': return 'text-emerald-600 bg-emerald-50 border-emerald-100'
    case 'adicionado': return 'text-blue-600 bg-blue-50 border-blue-100'
    case 'removido': return 'text-red-600 bg-red-50 border-red-100'
    case 'modificado': return 'text-amber-600 bg-amber-50 border-amber-100'
    case 'trocado': return 'text-purple-600 bg-purple-50 border-purple-100'
  }
}

function diffLabel(diff: DiffItem['diff']): string {
  switch (diff) {
    case 'igual': return 'Igual'
    case 'adicionado': return 'Adicionado'
    case 'removido': return 'Removido'
    case 'modificado': return 'Porções alteradas'
    case 'trocado': return 'Preparação trocada'
  }
}

function diffIcon(diff: DiffItem['diff']) {
  switch (diff) {
    case 'igual': return <CheckCircle2 className="w-3 h-3" />
    case 'adicionado': return <Plus className="w-3 h-3" />
    case 'removido': return <Minus className="w-3 h-3" />
    case 'modificado': return <Edit3 className="w-3 h-3" />
    case 'trocado': return <AlertCircle className="w-3 h-3" />
  }
}

// ── Component ────────────────────────────────────────────────

export default function CompararCardapioPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const cardapioEscolaId = params.id as string
  const baseIdFromUrl = searchParams.get('base')

  const [escolaCardapio, setEscolaCardapio] = useState<CardapioInfo | null>(null)
  const [baseCardapio, setBaseCardapio] = useState<CardapioInfo | null>(null)
  const [basesDisponiveis, setBasesDisponiveis] = useState<CardapioInfo[]>([])
  const [baseIdSelecionada, setBaseIdSelecionada] = useState<string>(baseIdFromUrl || '')
  const [loading, setLoading] = useState(true)
  const [semanaSelecionada, setSemanaSelecionada] = useState<number>(1)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Carrega cardápio da escola
        const res = await fetch(`/api/nutricao/cardapios/${cardapioEscolaId}`)
        if (!res.ok) throw new Error('Erro ao carregar cardápio')
        const data: CardapioInfo = await res.json()
        setEscolaCardapio(data)

        // Se veio base da URL ou cardápio tem cardapio_base_id, usa esse
        const baseId = baseIdFromUrl || data.cardapio_base_id
        if (baseId) {
          setBaseIdSelecionada(baseId)
          const baseRes = await fetch(`/api/nutricao/cardapios/${baseId}`)
          if (baseRes.ok) {
            const baseData: CardapioInfo = await baseRes.json()
            setBaseCardapio(baseData)
          }
        }

        // Carrega todos os cardápios base (escola_id = null) para o seletor
        const basesRes = await fetch('/api/nutricao/cardapios')
        if (basesRes.ok) {
          const allCards = await basesRes.json()
          const bases = (Array.isArray(allCards) ? allCards : []).filter((c: CardapioInfo) => c.escola_id === null)
          setBasesDisponiveis(bases)
        }
      } catch (err) {
        console.error(err)
        toast.error('Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [cardapioEscolaId, baseIdFromUrl])

  // Quando usuário muda o seletor de base
  async function handleTrocarBase(novoBaseId: string) {
    setBaseIdSelecionada(novoBaseId)
    if (!novoBaseId) {
      setBaseCardapio(null)
      return
    }
    try {
      const res = await fetch(`/api/nutricao/cardapios/${novoBaseId}`)
      if (!res.ok) throw new Error('Erro ao carregar base')
      const data: CardapioInfo = await res.json()
      setBaseCardapio(data)
    } catch {
      toast.error('Erro ao carregar cardápio base')
    }
  }

  // Calcular diff completo
  const diffs = useMemo<DiffSemana[]>(() => {
    if (!escolaCardapio || !baseCardapio) return []
    const resultado: DiffSemana[] = []
    for (const semanaEscola of escolaCardapio.semanas) {
      const semanaBase = baseCardapio.semanas.find((s) => s.numero === semanaEscola.numero)
      if (!semanaBase) {
        // Semana não existe no base — adicionar como totalmente nova
        resultado.push({
          numero: semanaEscola.numero,
          diferenciada: semanaEscola.diferenciada,
          dias: semanaEscola.dias.map((d) => ({
            dia_semana: d.dia_semana,
            itens: d.itens.map((item) => ({
              tipo_refeicao_id: item.tipo_refeicao_id,
              tipo_refeicao_nome: item.tipo_refeicao.nome,
              horario: item.tipo_refeicao.horario,
              diff: 'adicionado' as const,
              escola: item,
            })),
            total_igual: 0,
            total_adicionado: d.itens.length,
            total_removido: 0,
            total_modificado: 0,
            total_trocado: 0,
          })),
          resumo: { igual: 0, adicionado: semanaEscola.dias.reduce((a, d) => a + d.itens.length, 0), removido: 0, modificado: 0, trocado: 0 },
        })
        continue
      }
      resultado.push(compararSemana(semanaBase, semanaEscola))
    }
    return resultado
  }, [escolaCardapio, baseCardapio])

  const diffSemanaAtual = diffs.find((d) => d.numero === semanaSelecionada)

  // Stats globais
  const statsGlobais = useMemo(() => {
    return diffs.reduce(
      (acc, d) => ({
        igual: acc.igual + d.resumo.igual,
        adicionado: acc.adicionado + d.resumo.adicionado,
        removido: acc.removido + d.resumo.removido,
        modificado: acc.modificado + d.resumo.modificado,
        trocado: acc.trocado + d.resumo.trocado,
      }),
      { igual: 0, adicionado: 0, removido: 0, modificado: 0, trocado: 0 }
    )
  }, [diffs])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  if (!escolaCardapio) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-500">Cardápio não encontrado</p>
        <Link href="/nutricao/cardapios">
          <Button variant="outline" size="sm" className="mt-3">Voltar</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <Link href={`/nutricao/cardapios/${cardapioEscolaId}`}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#1A3A5C] flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-[#D4A017]" />
              Comparar com Base
            </h1>
            <p className="text-xs text-muted-foreground">
              {escolaCardapio.nome} · {escolaCardapio.ano}/{escolaCardapio.semestre}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Comparar com:</span>
          <Select value={baseIdSelecionada} onValueChange={handleTrocarBase}>
            <SelectTrigger className="w-64 text-xs h-8">
              <SelectValue placeholder="Selecionar base" />
            </SelectTrigger>
            <SelectContent>
              {basesDisponiveis.length === 0 ? (
                <SelectItem value="__none__" disabled>Nenhuma base disponível</SelectItem>
              ) : (
                basesDisponiveis.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.nome} ({b.ano}/{b.semestre})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {!baseCardapio ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-amber-800">
              Selecione um cardápio base acima para iniciar a comparação.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats globais */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-2"
          >
            <Card className="border-emerald-200">
              <CardContent className="p-3 text-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground uppercase">Iguais</p>
                <p className="text-lg font-bold text-emerald-700">{statsGlobais.igual}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="p-3 text-center">
                <Plus className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground uppercase">Adicionados</p>
                <p className="text-lg font-bold text-blue-700">{statsGlobais.adicionado}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="p-3 text-center">
                <Minus className="w-4 h-4 text-red-500 mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground uppercase">Removidos</p>
                <p className="text-lg font-bold text-red-700">{statsGlobais.removido}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="p-3 text-center">
                <Edit3 className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground uppercase">Porções alteradas</p>
                <p className="text-lg font-bold text-amber-700">{statsGlobais.modificado}</p>
              </CardContent>
            </Card>
            <Card className="border-purple-200">
              <CardContent className="p-3 text-center">
                <AlertCircle className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground uppercase">Trocados</p>
                <p className="text-lg font-bold text-purple-700">{statsGlobais.trocado}</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Seletor de semana */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-[#1A3A5C]/10">
              <CardContent className="p-2 flex items-center gap-2 flex-wrap">
                <Calendar className="w-3.5 h-3.5 text-[#1A3A5C] flex-shrink-0" />
                <span className="text-xs font-semibold text-[#1A3A5C]">Semana:</span>
                {diffs.map((d) => {
                  const hasChanges = d.resumo.adicionado + d.resumo.removido + d.resumo.modificado + d.resumo.trocado > 0
                  return (
                    <button
                      key={d.numero}
                      onClick={() => setSemanaSelecionada(d.numero)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors ${
                        semanaSelecionada === d.numero
                          ? 'bg-[#1A3A5C] text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {d.numero}
                      {d.diferenciada && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4A017]" title="Modificada" />
                      )}
                      {!d.diferenciada && hasChanges && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Diferenças não marcadas" />
                      )}
                      {d.diferenciada && hasChanges && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Modificações marcadas" />
                      )}
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Detalhe da semana selecionada */}
          {diffSemanaAtual && (
            <motion.div
              key={semanaSelecionada}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {/* Resumo da semana */}
              <Card className="border-[#1A3A5C]/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-[#1A3A5C]">
                      Semana {diffSemanaAtual.numero}
                    </CardTitle>
                    {diffSemanaAtual.diferenciada ? (
                      <Badge className="bg-[#D4A017]/10 text-[#D4A017] border-[#D4A017]/30 text-[10px]">
                        Modificada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Cópia do base</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 flex-wrap text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-emerald-400" /> {diffSemanaAtual.resumo.igual} iguais
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-blue-400" /> {diffSemanaAtual.resumo.adicionado} adicionados
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-red-400" /> {diffSemanaAtual.resumo.removido} removidos
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-amber-400" /> {diffSemanaAtual.resumo.modificado} porções alteradas
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-purple-400" /> {diffSemanaAtual.resumo.trocado} trocados
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Grid 5 dias */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                {diffSemanaAtual.dias.map((dia) => (
                  <Card key={dia.dia_semana} className="border-gray-200">
                    <div className="bg-[#1A3A5C] text-white py-1.5 px-2">
                      <span className="text-xs font-semibold">{diaLabel(dia.dia_semana)}</span>
                    </div>
                    <CardContent className="p-1.5 space-y-1.5">
                      {dia.itens.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-2">Sem refeições</p>
                      ) : (
                        dia.itens.map((item) => (
                          <div
                            key={item.tipo_refeicao_id}
                            className={`p-1.5 rounded-md border text-[10px] ${diffColor(item.diff)}`}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              {diffIcon(item.diff)}
                              <span className="font-semibold truncate flex-1">{item.tipo_refeicao_nome}</span>
                              <span className="text-[8px] opacity-70">{item.horario}</span>
                            </div>
                            <div className="pl-4 space-y-0.5">
                              {item.base && (
                                <div className="text-[9px] text-muted-foreground">
                                  Base: <span className="font-medium">{item.base.preparacao.nome}</span> ({item.base.porcoes}×)
                                </div>
                              )}
                              {item.escola && (
                                <div className="text-[9px]">
                                  Escola: <span className="font-medium">{item.escola.preparacao.nome}</span> ({item.escola.porcoes}×)
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Legenda */}
          <Card className="border-[#1A3A5C]/10 bg-gray-50">
            <CardContent className="p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Legenda</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span><strong>Igual:</strong> mesmo item e porções</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Plus className="w-3 h-3 text-blue-500" />
                  <span><strong>Adicionado:</strong> existe só na escola</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Minus className="w-3 h-3 text-red-500" />
                  <span><strong>Removido:</strong> existe só no base</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Edit3 className="w-3 h-3 text-amber-500" />
                  <span><strong>Porções:</strong> mesma prep, porções diferentes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-purple-500" />
                  <span><strong>Trocado:</strong> preparação diferente no slot</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
