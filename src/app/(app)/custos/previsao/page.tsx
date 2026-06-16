'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { SeletorSemana } from '@/components/seletor-semana'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Calendar,
  ShoppingCart,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────

interface SemanaData {
  semana: number
  ano: number
  periodo: string
  tipoPao: string
  nomePao: string
  lancheRegular: string | null
  lancheBifasica: string | null
  total_pf: number
  total_pcq: number
  total_lanche: number
}

interface InsumoPrevisao {
  insumo_id: string
  nome: string
  unidade: string
  preco_unitario: number
  estoque_atual: number
  quantidade_semanal: number[]
  quantidade_total: number
  custo_total: number
  deficit: number
  semanas_cobertas: number
  sugerido_pedir: number
}

interface PrevisaoData {
  semanas_cobertas: number
  data_inicio: string
  data_fim: string
  semanas: SemanaData[]
  insumos: InsumoPrevisao[]
  resumo: {
    custo_total_periodo: number
    total_deficit: number
    insumos_com_deficit: number
  }
}

// ── Helpers ────────────────────────────────────────────────

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatQty = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)

// ── Component ──────────────────────────────────────────────

export default function PrevisaoPage() {
  const [dados, setDados] = useState<PrevisaoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numSemanas, setNumSemanas] = useState(4)
  const [gerandoPedido, setGerandoPedido] = useState(false)
  const { semanaReferencia } = useAppStore()

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = semanaReferencia
        ? `?data=${semanaReferencia}&semanas=${numSemanas}`
        : `?semanas=${numSemanas}`
      const res = await fetch(`/api/custos/previsao${params}`)
      if (!res.ok) throw new Error('Erro ao carregar previsão')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDados(data)
    } catch (err) {
      console.error('Erro:', err)
      setError('Erro ao carregar previsão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [semanaReferencia, numSemanas])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleGerarPedido = async () => {
    if (!dados) return

    const deficitItens = dados.insumos.filter((i) => i.sugerido_pedir > 0)
    if (deficitItens.length === 0) {
      toast.info('Nenhum insumo com déficit para pedir.')
      return
    }

    setGerandoPedido(true)
    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornecedor: 'A definir',
          obs: `Pedido gerado pela previsão de demanda (${numSemanas} semanas)`,
          itens: deficitItens.map((i) => ({
            insumo_id: i.insumo_id,
            quantidade: Math.ceil(i.sugerido_pedir),
            preco_unitario: i.preco_unitario,
          })),
        }),
      })

      if (res.ok) {
        toast.success(`Pedido de compra criado com ${deficitItens.length} itens!`)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao criar pedido')
      }
    } catch {
      toast.error('Erro ao criar pedido de compra')
    } finally {
      setGerandoPedido(false)
    }
  }

  // ── Loading ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Calculando previsão...</span>
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

  const { resumo, insumos, semanas } = dados

  // Min semanas cobertas
  const minSemanasCobertas = insumos.length > 0
    ? Math.min(...insumos.filter((i) => i.quantidade_total > 0).map((i) => i.semanas_cobertas))
    : 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Previsão de Demanda</h1>
          <p className="text-sm text-muted-foreground">Baseada no cardápio cadastrado</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SeletorSemana />
          {/* Week count selector */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {[2, 4, 6, 8].map((n) => (
              <Button
                key={n}
                size="sm"
                variant={numSemanas === n ? 'default' : 'ghost'}
                onClick={() => setNumSemanas(n)}
                className={`h-7 text-xs ${numSemanas === n ? 'bg-[#1A3A5C] text-white' : ''}`}
              >
                {n} sem
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600">Custo Total do Período</p>
                <p className="text-lg font-bold text-amber-900">{formatBRL(resumo.custo_total_periodo)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className={resumo.insumos_com_deficit > 0 ? 'border-red-200 bg-gradient-to-br from-red-50 to-white' : 'border-green-200 bg-gradient-to-br from-green-50 to-white'}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${resumo.insumos_com_deficit > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <AlertTriangle className={`w-5 h-5 ${resumo.insumos_com_deficit > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <p className={`text-xs ${resumo.insumos_com_deficit > 0 ? 'text-red-600' : 'text-green-600'}`}>Insumos com Déficit</p>
                <p className={`text-lg font-bold ${resumo.insumos_com_deficit > 0 ? 'text-red-900' : 'text-green-900'}`}>{resumo.insumos_com_deficit}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-orange-600">Valor Total a Pedir</p>
                <p className="text-lg font-bold text-orange-900">{formatBRL(resumo.total_deficit)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-emerald-600">Semanas Cobertas</p>
                <p className="text-lg font-bold text-emerald-900">{minSemanasCobertas} de {numSemanas}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Weeks overview */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#1A3A5C]" />
              Semanas do Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {semanas.map((sem, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-muted/50">
                  <div className="text-xs text-muted-foreground">Semana {sem.semana}</div>
                  <div className="text-sm font-semibold text-[#1A3A5C]">{sem.periodo}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{sem.nomePao}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    PF: {sem.total_pf.toLocaleString('pt-BR')} · PCQ: {sem.total_pcq.toLocaleString('pt-BR')} · L: {sem.total_lanche.toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Forecast Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#1A3A5C]" />
              Previsão de Insumos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[55vh] overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground min-w-[130px]">Insumo</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground w-12">Un.</th>
                    {semanas.map((sem, idx) => (
                      <th key={idx} className="text-right p-3 text-xs font-medium text-muted-foreground w-20">
                        Sem {idx + 1}
                      </th>
                    ))}
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24 bg-muted/30">Total</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24">Estoque</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24">Déficit</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24">Pedir</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {insumos.map((insumo) => (
                    <tr key={insumo.insumo_id} className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="p-3 font-medium text-[#1A3A5C]">{insumo.nome}</td>
                      <td className="p-3 text-center text-muted-foreground text-xs">{insumo.unidade}</td>
                      {insumo.quantidade_semanal.map((q, idx) => (
                        <td key={idx} className="p-3 text-right font-mono text-xs">
                          {q > 0 ? formatQty(q) : <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                      <td className="p-3 text-right font-mono font-semibold bg-muted/30">
                        {formatQty(insumo.quantidade_total)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatQty(insumo.estoque_atual)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className={insumo.deficit < 0 ? 'text-red-700 font-semibold' : 'text-green-700'}>
                          {insumo.deficit < 0 ? formatQty(insumo.deficit) : formatQty(insumo.deficit)}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        {insumo.sugerido_pedir > 0 ? (
                          <span className="font-semibold text-orange-700">{formatQty(insumo.sugerido_pedir)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {insumo.sugerido_pedir > 0 ? (
                          <span className="font-semibold">{formatBRL(insumo.sugerido_pedir * insumo.preco_unitario)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-[#1A3A5C] text-white">
                    <td className="p-3 font-bold">Total</td>
                    <td></td>
                    {semanas.map((_, idx) => (
                      <td key={idx}></td>
                    ))}
                    <td className="p-3 text-right font-mono font-bold bg-[#1A3A5C]">
                      {formatBRL(resumo.custo_total_periodo)}
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="p-3 text-right font-mono font-bold">
                      {formatBRL(resumo.total_deficit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Action: Generate Purchase Order */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
          <div>
            <p className="font-semibold text-[#1A3A5C]">Gerar Pedido de Compra</p>
            <p className="text-xs text-muted-foreground">
              Cria automaticamente um pedido com todos os insumos em déficit ({resumo.insumos_com_deficit} itens)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/custos/compras">
              <Button variant="outline" size="sm">
                Ver Compras
              </Button>
            </Link>
            <Button
              className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]"
              onClick={handleGerarPedido}
              disabled={gerandoPedido || resumo.insumos_com_deficit === 0}
            >
              {gerandoPedido ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4 mr-1" />
              )}
              Gerar Pedido
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
