'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SeletorSemana } from '@/components/seletor-semana'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  Package,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileText,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAppStore } from '@/store/app-store'

// ── Types ──────────────────────────────────────────────────

interface InsumoSemana {
  insumo_id: string
  nome: string
  unidade: string
  preco_unitario: number
  estoque_atual: number
  estoque_minimo: number
  detalhe: { PF: number; PCQ: number; LANCHE: number }
  quantidade_estimada: number
  custo_estimado: number
  pedidos_pendentes: number
  contagem_fisica: { quantidade: number; data: string; diferenca: number } | null
  deficit: number
}

interface DadosSemana {
  semana: number
  ano: number
  periodo: string
  tipoPao: string
  nomePao: string
  lancheRegular: string | null
  lancheBifasica: string | null
  totais_semana: { total_pf: number; total_pcq: number; total_lanche: number }
  insumos: InsumoSemana[]
  resumo: {
    total_estimado: number
    total_custo_estimado: number
    total_em_estoque_valor: number
    total_pedidos_pendentes_valor: number
    insumos_deficit: number
  }
}

// ── Helpers ────────────────────────────────────────────────

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatQty = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)

// ── Status Badge ───────────────────────────────────────────

function StatusBadge({ deficit, estoque, estimado }: { deficit: number; estoque: number; estimado: number }) {
  if (estimado === 0) {
    return <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-500">—</Badge>
  }
  // Covers the week (positive or zero deficit)
  if (deficit >= 0) {
    // Check if covers more than 1 week
    const semanasCobertas = estoque / estimado
    if (semanasCobertas >= 2) {
      return <Badge className="text-[10px] bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="w-3 h-3 mr-0.5" /> OK</Badge>
    }
    return <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200"><Clock className="w-3 h-3 mr-0.5" /> Atenção</Badge>
  }
  return <Badge className="text-[10px] bg-red-100 text-red-800 border-red-200"><XCircle className="w-3 h-3 mr-0.5" /> Crítico</Badge>
}

// ── Component ──────────────────────────────────────────────

export default function CustosPage() {
  const [dados, setDados] = useState<DadosSemana | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const { semanaReferencia } = useAppStore()

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = semanaReferencia ? `?data=${semanaReferencia}` : ''
      const res = await fetch(`/api/custos/insumos-semana${params}`)
      if (!res.ok) throw new Error('Erro ao carregar dados')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDados(data)
    } catch (err) {
      console.error('Erro:', err)
      setError('Erro ao carregar dados de insumos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [semanaReferencia])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Loading ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Calculando insumos...</span>
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-red-600 font-medium">{error}</p>
          <Button variant="outline" onClick={loadData}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    )
  }

  if (!dados) return null

  const { resumo, insumos, totais_semana } = dados

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Controle de Insumos</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhamento de consumo, estoque e previsão
          </p>
        </div>
        <SeletorSemana />
      </div>

      {/* Production Summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 flex-wrap"
      >
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#1A3A5C] to-[#2C5282] text-white px-4 py-2 rounded-lg shadow-md">
          <span className="text-sm font-semibold">Semana {dados.semana}</span>
          <span className="text-xs text-blue-200">— {dados.periodo}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">{dados.nomePao}</Badge>
          {dados.lancheRegular && (
            <Badge variant="outline" className="text-[10px] border-pink-200 text-pink-700">
              Lanche: {dados.lancheRegular}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
          <span>PF: <strong className="text-[#1A3A5C]">{totais_semana.total_pf.toLocaleString('pt-BR')}</strong></span>
          <span>PCQ: <strong className="text-[#1A3A5C]">{totais_semana.total_pcq.toLocaleString('pt-BR')}</strong></span>
          <span>Lanche: <strong className="text-[#1A3A5C]">{totais_semana.total_lanche.toLocaleString('pt-BR')}</strong></span>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-emerald-600">Valor em Estoque</p>
                <p className="text-lg font-bold text-emerald-900">{formatBRL(resumo.total_em_estoque_valor)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600">Custo Estimado Semana</p>
                <p className="text-lg font-bold text-amber-900">{formatBRL(resumo.total_custo_estimado)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className={resumo.insumos_deficit > 0 ? 'border-red-200 bg-gradient-to-br from-red-50 to-white' : 'border-green-200 bg-gradient-to-br from-green-50 to-white'}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${resumo.insumos_deficit > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <AlertTriangle className={`w-5 h-5 ${resumo.insumos_deficit > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <p className={`text-xs ${resumo.insumos_deficit > 0 ? 'text-red-600' : 'text-green-600'}`}>Insumos com Déficit</p>
                <p className={`text-lg font-bold ${resumo.insumos_deficit > 0 ? 'text-red-900' : 'text-green-900'}`}>{resumo.insumos_deficit}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-sky-600">Pedidos Pendentes</p>
                <p className="text-lg font-bold text-sky-900">{formatBRL(resumo.total_pedidos_pendentes_valor)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Comparison Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#1A3A5C]" />
              Comparativo: Estimado × Pedido × Estoque × Físico
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {insumos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Nenhum insumo cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[55vh] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background z-10 border-b">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground min-w-[140px]">Insumo</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground w-16">Un.</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground w-28">Estimado</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground w-28">Ped. Pendente</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground w-28">Estoque</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground w-28">Contagem Física</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24">Variação</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground w-24">Status</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {insumos.map((insumo) => {
                      const isExpanded = expandedRows.has(insumo.insumo_id)
                      const variacao = insumo.estoque_atual - insumo.quantidade_estimada
                      const hasDetail = insumo.detalhe.PF > 0 || insumo.detalhe.PCQ > 0 || insumo.detalhe.LANCHE > 0

                      return (
                        <AnimatePresence key={insumo.insumo_id}>
                          <motion.tr
                            className="border-b border-muted/30 hover:bg-muted/20 cursor-pointer"
                            onClick={() => hasDetail && toggleRow(insumo.insumo_id)}
                            layout
                          >
                            <td className="p-3 font-medium text-[#1A3A5C]">{insumo.nome}</td>
                            <td className="p-3 text-center text-muted-foreground text-xs">{insumo.unidade}</td>
                            <td className="p-3 text-right font-mono font-semibold">
                              {formatQty(insumo.quantidade_estimada)}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {insumo.pedidos_pendentes > 0 ? (
                                <span className="text-sky-700">{formatQty(insumo.pedidos_pendentes)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono">{formatQty(insumo.estoque_atual)}</td>
                            <td className="p-3 text-right font-mono">
                              {insumo.contagem_fisica ? (
                                <div>
                                  <span>{formatQty(insumo.contagem_fisica.quantidade)}</span>
                                  <span className="block text-[10px] text-muted-foreground">
                                    {insumo.contagem_fisica.data.split('-').reverse().join('/')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono">
                              <span className={variacao >= 0 ? 'text-green-700' : 'text-red-700'}>
                                {variacao >= 0 ? '+' : ''}{formatQty(variacao)}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <StatusBadge
                                deficit={insumo.deficit}
                                estoque={insumo.estoque_atual}
                                estimado={insumo.quantidade_estimada}
                              />
                            </td>
                            <td className="p-3">
                              {hasDetail && (
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </Button>
                              )}
                            </td>
                          </motion.tr>

                          {/* Expanded detail row */}
                          {isExpanded && (
                            <motion.tr
                              key={`detail-${insumo.insumo_id}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="bg-muted/10"
                            >
                              <td colSpan={9} className="p-3 pl-12">
                                <div className="flex items-center gap-6 text-xs">
                                  {insumo.detalhe.PF > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">PF</Badge>
                                      <span className="font-mono">{formatQty(insumo.detalhe.PF)} {insumo.unidade}</span>
                                    </div>
                                  )}
                                  {insumo.detalhe.PCQ > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700">PCQ</Badge>
                                      <span className="font-mono">{formatQty(insumo.detalhe.PCQ)} {insumo.unidade}</span>
                                    </div>
                                  )}
                                  {insumo.detalhe.LANCHE > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Badge variant="outline" className="text-[10px] border-pink-300 text-pink-700">Lanche</Badge>
                                      <span className="font-mono">{formatQty(insumo.detalhe.LANCHE)} {insumo.unidade}</span>
                                    </div>
                                  )}
                                  <span className="text-muted-foreground">
                                    Custo estimado: <strong>{formatBRL(insumo.custo_estimado)}</strong>
                                  </span>
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-[#1A3A5C] text-white">
                      <td className="p-3 font-bold">Total</td>
                      <td></td>
                      <td className="p-3 text-right font-mono font-bold">{formatQty(resumo.total_estimado)}</td>
                      <td></td>
                      <td className="p-3 text-right font-mono font-bold">{formatBRL(resumo.total_em_estoque_valor)}</td>
                      <td></td>
                      <td></td>
                      <td className="p-3 text-center">
                        {resumo.insumos_deficit > 0 ? (
                          <Badge className="text-[10px] bg-red-200 text-red-900 border-red-300">{resumo.insumos_deficit} déficit</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-green-200 text-green-900 border-green-300">Todos OK</Badge>
                        )}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Sub-page links */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Link href="/custos/previsao">
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 hover:shadow-md transition-all cursor-pointer group">
            <TrendingUp className="w-6 h-6 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-sm font-semibold text-amber-900">Previsão</p>
            <p className="text-xs text-amber-600">Demanda</p>
          </div>
        </Link>
        <Link href="/custos/contagem">
          <div className="p-4 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100/50 border border-teal-200 hover:shadow-md transition-all cursor-pointer group">
            <ClipboardCheck className="w-6 h-6 text-teal-600 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-sm font-semibold text-teal-900">Contagem</p>
            <p className="text-xs text-teal-600">Estoque Físico</p>
          </div>
        </Link>
        <Link href="/custos/receitas">
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 hover:shadow-md transition-all cursor-pointer group">
            <BarChart3 className="w-6 h-6 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-sm font-semibold text-purple-900">Receitas</p>
            <p className="text-xs text-purple-600">Composição</p>
          </div>
        </Link>
        <Link href="/custos/compras">
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 hover:shadow-md transition-all cursor-pointer group">
            <ShoppingCart className="w-6 h-6 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-sm font-semibold text-green-900">Compras</p>
            <p className="text-xs text-green-600">Pedidos</p>
          </div>
        </Link>
        <Link href="/custos/movimentacoes">
          <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/50 border border-sky-200 hover:shadow-md transition-all cursor-pointer group">
            <FileText className="w-6 h-6 text-sky-600 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-sm font-semibold text-sky-900">Movimentações</p>
            <p className="text-xs text-sky-600">Entrada/Saída</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
